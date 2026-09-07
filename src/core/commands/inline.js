import { closestBlock, unwrap, isElement, isFontSizeSpan, isMention } from '../dom'
import { textNodesInRange, setRange } from '../selection'
import { normalizeInlines } from '../normalize'
import { getStyle, setStyle } from '../css'
import { FONT_SIZES } from '../constants'
import { formatFontFamily } from '../sanitize'

/**
 * The single engine behind every inline format. A `spec` describes how the
 * format looks in the DOM:
 *
 *   matches(el)          -> the element carries this format
 *   create(value)        -> builds the wrapper
 *   sameValue(el, value) -> the element already holds exactly that value
 *   read(el)             -> the value the element carries
 */

// Pulls `node` out of `ancestor`, splitting it into as many pieces as needed.
// Fully contained nodes are moved, not cloned, so their identities survive.
function isolateFrom(node, ancestor) {
  const parent = ancestor.parentNode
  if (!parent) return

  const afterRange = document.createRange()
  afterRange.setStartAfter(node)
  afterRange.setEndAfter(ancestor)
  const after = afterRange.extractContents()

  const beforeRange = document.createRange()
  beforeRange.setStartBefore(ancestor)
  beforeRange.setEndBefore(node)
  const before = beforeRange.extractContents()

  parent.insertBefore(before, ancestor)
  parent.insertBefore(after, ancestor.nextSibling)
  unwrap(ancestor)
}

function matchingAncestor(root, node, spec) {
  let current = node.parentNode
  while (current && current !== root) {
    if (isElement(current) && spec.matches(current)) return current
    current = current.parentNode
  }
  return null
}

function stripSpec(root, text, spec) {
  let ancestor = matchingAncestor(root, text, spec)
  let guard = 0
  while (ancestor && guard++ < 20) {
    isolateFrom(text, ancestor)
    ancestor = matchingAncestor(root, text, spec)
  }
}

function selectTexts(texts) {
  if (!texts.length) return
  const range = document.createRange()
  range.setStart(texts[0], 0)
  const last = texts[texts.length - 1]
  range.setEnd(last, last.data.length)
  setRange(range)
}

function finish(root, texts) {
  const blocks = new Set()
  for (const text of texts) {
    if (!text.parentNode) continue
    blocks.add(closestBlock(root, text) || root)
  }
  blocks.forEach((block) => normalizeInlines(block))
}

export function applyInline(root, range, spec, value) {
  const texts = textNodesInRange(range)
  if (!texts.length) return false

  texts.forEach((text) => stripSpec(root, text, spec))

  for (const text of texts) {
    if (!text.parentNode) continue
    // A mention is an atom: format around it, never inside it.
    if (isMention(text.parentNode)) continue
    const wrapper = spec.create(value)
    text.parentNode.insertBefore(wrapper, text)
    wrapper.appendChild(text)
  }

  finish(root, texts)
  selectTexts(texts)
  return true
}

export function removeInline(root, range, spec) {
  const texts = textNodesInRange(range)
  if (!texts.length) return false

  texts.forEach((text) => stripSpec(root, text, spec))
  finish(root, texts)
  selectTexts(texts)
  return true
}

/**
 * @returns {*} the value when uniform, `null` when absent, `'mixed'` when it varies.
 */
export function queryInline(root, range, spec) {
  if (range.collapsed) {
    const container = range.startContainer
    const node =
      container.nodeType === Node.TEXT_NODE
        ? container
        : container.childNodes[range.startOffset] || container.lastChild || container
    const ancestor = matchingAncestor(root, node, spec)
    return ancestor ? spec.read(ancestor) : null
  }

  const probe = range.cloneRange()
  const container = probe.commonAncestorContainer
  const texts = []

  // A selection inside a single text node has that node as its
  // commonAncestorContainer, and a TreeWalker rooted at text yields nothing.
  if (container.nodeType === Node.TEXT_NODE) {
    texts.push(container)
  } else {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
    let node = walker.nextNode()
    while (node) {
      if (node.data.trim() && probe.intersectsNode(node)) texts.push(node)
      node = walker.nextNode()
    }
  }
  if (!texts.length) return null

  let result
  for (const text of texts) {
    const ancestor = matchingAncestor(root, text, spec)
    const value = ancestor ? spec.read(ancestor) : null
    if (result === undefined) result = value
    else if (result !== value) return 'mixed'
  }
  return result === undefined ? null : result
}

const tagSpec = (tag) => ({
  matches: (el) => el.tagName === tag.toUpperCase(),
  create: () => document.createElement(tag),
  read: () => true
})

export const boldSpec = tagSpec('strong')
export const italicSpec = tagSpec('i')

export const fontFamilySpec = {
  matches: (el) => el.tagName === 'SPAN' && !!getStyle(el, 'font-family'),
  create: (value) => {
    const span = document.createElement('span')
    setStyle(span, 'font-family', formatFontFamily(value))
    return span
  },
  read: (el) => getStyle(el, 'font-family')
}

export const fontColorSpec = {
  matches: (el) => el.tagName === 'SPAN' && !!getStyle(el, 'color'),
  create: (value) => {
    const span = document.createElement('span')
    setStyle(span, 'color', value)
    return span
  },
  read: (el) => getStyle(el, 'color')
}

export const fontSizeSpec = {
  matches: (el) => isFontSizeSpan(el),
  create: (value) => {
    const span = document.createElement('span')
    const size = FONT_SIZES.find((s) => s.model === value)
    span.className = size.className
    return span
  },
  read: (el) => {
    const size = FONT_SIZES.find((s) => s.className && el.classList.contains(s.className))
    return size ? size.model : null
  }
}

export const linkSpec = {
  matches: (el) => el.tagName === 'A',
  create: (value) => {
    const a = document.createElement('a')
    // Attribute order survives serialization, so it is part of the contract.
    if (value.target) a.setAttribute('target', value.target)
    if (value.rel) a.setAttribute('rel', value.rel)
    a.setAttribute('href', value.href)
    return a
  },
  read: (el) => el.getAttribute('href')
}
