import { sanitizeHtml } from './sanitize'
import { normalizeRoot, ensureNotEmpty, fillEmptyBlocks, normalizeWhitespace } from './normalize'
import { isElement, isText, isTableFigure, isImageFigure } from './dom'
import { FILLER_ATTR } from './constants'

const EDITING_CLASS_RE = /^fa-editor(-|__)/
const ZERO_WIDTH_RE = /\u200b/g

const BLOCKS = 'p, h2, h3, h4, li, td, th'

const isBlank = (el) =>
  !el.textContent.replace(/[\s\u00a0\u200b]/g, '').length && !el.querySelector('img, table')

// An empty document serializes to an empty string, not to <p></p>.
const isEmptyDocument = (root) =>
  root.children.length === 1 &&
  root.firstElementChild.tagName === 'P' &&
  isBlank(root.firstElementChild)

function stripEditingArtifacts(root) {
  for (const el of Array.from(root.querySelectorAll('*'))) {
    for (const cls of Array.from(el.classList)) {
      if (EDITING_CLASS_RE.test(cls)) el.classList.remove(cls)
    }
    if (!el.getAttribute('class')) el.removeAttribute('class')
    el.removeAttribute('contenteditable')
    el.removeAttribute('data-placeholder')
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  const texts = []
  let node = walker.nextNode()
  while (node) {
    texts.push(node)
    node = walker.nextNode()
  }
  for (const text of texts) {
    if (!ZERO_WIDTH_RE.test(text.data)) continue
    text.data = text.data.replace(ZERO_WIDTH_RE, '')
    if (!text.data.length) text.parentNode.removeChild(text)
  }
}

// Block closing, following the contract for line breaks exactly.
//
// An empty block is exported as <p>&nbsp;</p> and a block ending in a break as
// <p>text<br>&nbsp;</p>. While editing we add an extra <br> as filler so the
// line keeps its height, and that one has to be dropped here.
function closeBlocks(root) {
  for (const block of Array.from(root.querySelectorAll(BLOCKS))) {
    if (block.querySelector('img, table')) continue

    // 1. Filler <br>s are noise: they only gave the line its height. An
    //    unmarked trailing <br> is real content and is kept.
    for (const filler of Array.from(block.querySelectorAll(`br[${FILLER_ATTR}]`))) {
      filler.parentNode.removeChild(filler)
    }
    let last = block.lastChild
    while (last && isText(last) && !last.data.length) {
      const previous = last.previousSibling
      block.removeChild(last)
      last = previous
    }

    // 2. Block with no content: a single filler <br>, or nothing at all.
    const onlyBreak =
      block.childNodes.length === 1 &&
      isElement(block.firstChild) &&
      block.firstChild.tagName === 'BR'
    if (onlyBreak || (isBlank(block) && !block.querySelector('br'))) {
      block.innerHTML = '&nbsp;'
      continue
    }

    // 3. A trailing break needs the &nbsp; so the empty line also exists
    //    outside the editor.
    if (last && isElement(last) && last.tagName === 'BR') {
      block.appendChild(document.createTextNode('\u00a0'))
    }
  }
}

/**
 * Output HTML. Must follow the contract exactly.
 * @param {HTMLElement} root
 * @returns {string}
 */
export function getData(root) {
  const clone = root.cloneNode(true)
  clone.removeAttribute('contenteditable')

  stripEditingArtifacts(clone)
  normalizeRoot(clone)
  normalizeWhitespace(clone)

  if (isEmptyDocument(clone)) return ''

  closeBlocks(clone)

  return clone.innerHTML
}

/**
 * Loads HTML into the editable root. Must accept anything the contract allows.
 * @param {HTMLElement} root
 * @param {string} html
 */
export function setData(root, html) {
  root.innerHTML = sanitizeHtml(html || '', { source: 'data' })

  // A block holding only &nbsp; is an empty block: normalizing it keeps the
  // user from having to delete an invisible character.
  for (const block of Array.from(root.querySelectorAll(BLOCKS))) {
    if (block.textContent === '\u00a0' && !block.children.length) block.textContent = ''
  }

  normalizeRoot(root)
  normalizeWhitespace(root)
  fillEmptyBlocks(root)
  ensureNotEmpty(root)
  return root
}

export { isTableFigure, isImageFigure }
