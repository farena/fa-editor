import { closestBlock, rootBlockOf, isTableFigure, isImageFigure, isElement } from './dom'
import { isAtBlockStart, isAtBlockEnd, setRange, collapseTo, lastTextPosition } from './selection'
import { normalizeInlines } from './normalize'
import { getStyle, setStyle } from './css'
import { unwrapItems } from './commands/list'
import { FILLER_ATTR, BLOCK_TAGS } from './constants'

const caretAtStartOf = (el) => {
  const range = document.createRange()
  range.setStart(el, 0)
  range.collapse(true)
  setRange(range)
}

// Empties the selection before operating, so splitting cannot duplicate content.
function collapseSelection(root, range) {
  if (range.collapsed) return range
  range.deleteContents()
  const block = closestBlock(root, range.startContainer)
  if (block) normalizeInlines(block)
  range.collapse(true)
  setRange(range)
  return range
}

/**
 * Enter. Splits the block, keeping its tag and alignment — except at the end of
 * a heading, where the new block is a plain paragraph.
 */
export function handleEnter(root, range) {
  const working = collapseSelection(root, range)
  const block = closestBlock(root, working.startContainer)
  if (!block) return false

  if (block.tagName === 'LI') {
    if (!block.textContent.trim() && !block.querySelector('img')) {
      // The caret has to land in the new paragraph: otherwise the next thing
      // typed goes back into the previous item.
      const [paragraph] = unwrapItems(root, [block])
      if (paragraph) caretAtStartOf(paragraph)
      return true
    }
    return splitBlock(root, block, working, 'li')
  }

  if (block.tagName === 'TD' || block.tagName === 'TH') return splitInsideCell(block, working)

  const atEnd = isAtBlockEnd(block, working)
  const isHeading = ['H2', 'H3', 'H4'].includes(block.tagName)
  const tag = atEnd && isHeading ? 'p' : block.tagName.toLowerCase()
  return splitBlock(root, block, working, tag)
}

function splitBlock(root, block, range, tag) {
  const tail = document.createRange()
  tail.setStart(range.startContainer, range.startOffset)
  tail.setEnd(block, block.childNodes.length)
  const fragment = tail.extractContents()

  const created = document.createElement(tag)
  const align = getStyle(block, 'text-align')
  if (align) setStyle(created, 'text-align', align)
  created.appendChild(fragment)

  block.parentNode.insertBefore(created, block.nextSibling)

  if (!block.firstChild) block.appendChild(document.createElement('br'))
  if (!created.firstChild) created.appendChild(document.createElement('br'))

  normalizeInlines(block)
  normalizeInlines(created)
  caretAtStartOf(created)
  return true
}

// Inside a cell, Enter creates paragraphs: the cell is the container, not the block.
function splitInsideCell(cell, range) {
  const inner = Array.from(cell.children).find(
    (child) => child.tagName === 'P' && child.contains(range.startContainer)
  )

  if (!inner) {
    // Bare content: it gets wrapped in a paragraph first so it can be split.
    // Moving the nodes out of the cell relocates the live range to the start of
    // the cell (that is what the DOM removal steps do), so the boundary point
    // has to be noted and restored afterwards; without that, Enter always splits
    // at offset 0.
    const container = range.startContainer
    const offset = range.startOffset
    const wrapper = document.createElement('p')
    while (cell.firstChild) wrapper.appendChild(cell.firstChild)
    cell.appendChild(wrapper)

    const restored = document.createRange()
    if (container === cell) restored.setStart(wrapper, Math.min(offset, wrapper.childNodes.length))
    else restored.setStart(container, offset)
    restored.collapse(true)
    return splitBlock(cell, wrapper, restored, 'p')
  }
  return splitBlock(cell, inner, range, 'p')
}

/**
 * Shift+Enter and Ctrl+Enter. At the end of a block a second filler <br> is
 * needed so the new line has height. It carries an attribute to mark it: an
 * unmarked trailing <br> is real content and is preserved.
 */
export function handleSoftBreak(root, range) {
  const working = collapseSelection(root, range)
  const block = closestBlock(root, working.startContainer)
  if (!block) return false

  const br = document.createElement('br')
  working.insertNode(br)

  if (isAtBlockEnd(block, positionAfter(br))) {
    const filler = document.createElement('br')
    filler.setAttribute(FILLER_ATTR, '')
    br.parentNode.insertBefore(filler, br.nextSibling)
  }

  const next = document.createRange()
  next.setStartAfter(br)
  next.collapse(true)
  setRange(next)
  return true
}

function positionAfter(node) {
  const range = document.createRange()
  range.setStartAfter(node)
  range.collapse(true)
  return range
}

/**
 * Backspace at the start of a block: merges it into the previous block.
 */
export function handleBackspaceAtStart(root, range) {
  if (!range.collapsed) return false
  const block = closestBlock(root, range.startContainer)
  if (!block || !isAtBlockStart(block, range)) return false

  if (block.tagName === 'TD' || block.tagName === 'TH') return true // never destroy the cell

  if (block.tagName === 'LI') {
    // The first item leaves the list; the rest merge into the previous one,
    // which then holds two blocks. The paragraph break is not deleted, it is
    // kept inside the same <li>.
    const previousItem = block.previousElementSibling
    if (!previousItem) {
      const [paragraph] = unwrapItems(root, [block])
      if (paragraph) caretAtStartOf(paragraph)
      return true
    }
    return mergeListItems(previousItem, block)
  }

  const rootBlock = rootBlockOf(root, block) || block
  const previous = rootBlock.previousElementSibling
  if (!previous) return true

  if (isTableFigure(previous) || isImageFigure(previous)) {
    // A table is not deleted one character at a time: it gets selected.
    const selection = document.createRange()
    selection.selectNode(previous)
    setRange(selection)
    return true
  }

  return mergeInto(previous, rootBlock)
}

/**
 * Delete at the end of a block: merges the next block into the current one.
 */
export function handleDeleteAtEnd(root, range) {
  if (!range.collapsed) return false
  const block = closestBlock(root, range.startContainer)
  if (!block || !isAtBlockEnd(block, range)) return false
  if (block.tagName === 'TD' || block.tagName === 'TH') return true

  const rootBlock = rootBlockOf(root, block) || block
  const next = rootBlock.nextElementSibling
  if (!next) return true

  if (isTableFigure(next) || isImageFigure(next)) {
    const selection = document.createRange()
    selection.selectNode(next)
    setRange(selection)
    return true
  }

  return mergeInto(rootBlock, next)
}

// Moves `source`'s content to the end of `target` and leaves the caret at the seam.
function mergeInto(target, source) {
  const host = target.tagName === 'UL' || target.tagName === 'OL' ? target.lastElementChild : target
  const donor =
    source.tagName === 'UL' || source.tagName === 'OL' ? source.firstElementChild : source
  if (!host || !donor) return false

  const filler = host.lastChild
  if (isElement(filler) && filler.tagName === 'BR' && host.childNodes.length === 1) {
    host.removeChild(filler)
  }

  const { node, offset } = lastTextPosition(host)
  while (donor.firstChild) host.appendChild(donor.firstChild)

  donor.parentNode.removeChild(donor)
  if (source.parentNode && !source.childNodes.length) source.parentNode.removeChild(source)

  normalizeInlines(host)
  if (!host.firstChild) host.appendChild(document.createElement('br'))
  collapseTo(node, offset)
  return true
}

/**
 * Joins two list items while keeping the block break: each one's content ends
 * up in its own <p> inside the resulting item.
 */
function mergeListItems(previous, item) {
  const blocksOf = (li) => {
    const existing = Array.from(li.children).filter((c) => BLOCK_TAGS.includes(c.tagName))
    if (existing.length) return existing
    const paragraph = document.createElement('p')
    while (li.firstChild) paragraph.appendChild(li.firstChild)
    li.appendChild(paragraph)
    return [paragraph]
  }

  blocksOf(previous)
  const moved = blocksOf(item)
  const first = moved[0]
  for (const block of moved) previous.appendChild(block)
  item.parentNode.removeChild(item)
  caretAtStartOf(first)
  return true
}
