import { ROOT_TAGS, BLOCK_TAGS, FONT_SIZE_CLASSES } from './constants'

export const isElement = (node) => !!node && node.nodeType === Node.ELEMENT_NODE
export const isText = (node) => !!node && node.nodeType === Node.TEXT_NODE

export const tagOf = (node) => (isElement(node) ? node.tagName : null)

// Direct child of the root that contains the given node.
export function rootBlockOf(root, node) {
  let current = node
  while (current && current.parentNode !== root) {
    current = current.parentNode
    if (!current || current === document.body) return null
  }
  return isElement(current) ? current : null
}

// Closest editable block: p/h2/h3/h4/li, or a table cell.
export function closestBlock(root, node) {
  let current = isText(node) ? node.parentNode : node
  while (current && current !== root) {
    if (isElement(current)) {
      const tag = current.tagName
      if (BLOCK_TAGS.includes(tag) || tag === 'LI' || tag === 'TD' || tag === 'TH') return current
    }
    current = current.parentNode
  }
  return null
}

export function closestTag(root, node, tags) {
  const list = Array.isArray(tags) ? tags : [tags]
  let current = isText(node) ? node.parentNode : node
  while (current && current !== root) {
    if (isElement(current) && list.includes(current.tagName)) return current
    current = current.parentNode
  }
  return null
}

export function closestMatching(root, node, predicate) {
  let current = isText(node) ? node.parentNode : node
  while (current && current !== root) {
    if (isElement(current) && predicate(current)) return current
    current = current.parentNode
  }
  return null
}

export const isRootLevelTag = (node) => isElement(node) && ROOT_TAGS.includes(node.tagName)

export const isTableFigure = (node) =>
  isElement(node) && node.tagName === 'FIGURE' && node.classList.contains('table')

export const isImageFigure = (node) =>
  isElement(node) && node.tagName === 'FIGURE' && node.classList.contains('image')

export const isMention = (node) =>
  isElement(node) && node.tagName === 'SPAN' && node.classList.contains('mention')

export const isFontSizeSpan = (node) =>
  isElement(node) &&
  node.tagName === 'SPAN' &&
  FONT_SIZE_CLASSES.some((c) => node.classList.contains(c))

// A block counts as empty when it has neither text nor atomic content.
export function isEmptyBlock(el) {
  if (!isElement(el)) return false
  if (el.textContent.trim().length) return false
  return !el.querySelector('img, table')
}

export function createBlock(tag, align) {
  const el = document.createElement(tag)
  el.appendChild(document.createElement('br'))
  if (align) el.style.textAlign = align
  return el
}

// Replaces an element's tag, keeping its attributes and children.
export function replaceTag(el, tag) {
  if (el.tagName === tag.toUpperCase()) return el
  const next = document.createElement(tag)
  for (const attr of Array.from(el.attributes)) next.setAttribute(attr.name, attr.value)
  while (el.firstChild) next.appendChild(el.firstChild)
  el.parentNode.replaceChild(next, el)
  return next
}

// Drops the element, leaving its children in place. Returns the moved children.
export function unwrap(el) {
  const parent = el.parentNode
  if (!parent) return []
  const moved = Array.from(el.childNodes)
  while (el.firstChild) parent.insertBefore(el.firstChild, el)
  parent.removeChild(el)
  return moved
}

export function removeStyleProp(el, prop) {
  el.style.removeProperty(prop)
  if (!el.getAttribute('style')) el.removeAttribute('style')
}

// Removes the element if nothing useful is left inside it.
export function removeIfEmpty(el) {
  if (!el || !el.parentNode) return
  if (el.childNodes.length === 0 || (!el.textContent.length && !el.querySelector('br, img')))
    el.parentNode.removeChild(el)
}

export function forEachElement(root, selector, fn) {
  Array.from(root.querySelectorAll(selector)).forEach(fn)
}
