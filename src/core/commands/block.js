import { replaceTag, isElement } from '../dom'
import { blocksInRange, snapshotSelection, restoreSelection } from '../selection'
import { getStyle, setStyle } from '../css'
import { BLOCK_TAGS, ALIGNMENTS } from '../constants'

const ALIGN_VALUES = ALIGNMENTS.map((a) => a.model)

const isConvertible = (el) => isElement(el) && BLOCK_TAGS.includes(el.tagName)

/**
 * Changes the tag of the blocks in the range. List items and cells are left
 * alone: turning one into a heading means leaving the list first.
 */
export function setBlockTag(root, range, tag) {
  const blocks = blocksInRange(root, range).filter(isConvertible)
  if (!blocks.length) return false

  const snapshot = snapshotSelection(root)
  blocks.forEach((block) => replaceTag(block, tag))
  restoreSelection(root, snapshot)
  return true
}

/**
 * `left` is the default: it does not write the style, it removes it.
 */
export function setAlignment(root, range, align) {
  const blocks = blocksInRange(root, range)
  if (!blocks.length) return false

  // Alignment is a toggle: choosing the alignment already in effect clears it.
  // `left` is the default and is never serialized.
  const current = queryAlignment(root, range)
  const value = !align || align === 'left' || align === current ? null : align

  const snapshot = snapshotSelection(root)
  for (const block of blocks) setStyle(block, 'text-align', value)
  restoreSelection(root, snapshot)
  return true
}

export function queryBlockTag(root, range) {
  const blocks = blocksInRange(root, range).filter(isConvertible)
  if (!blocks.length) return null
  const first = blocks[0].tagName.toLowerCase()
  return blocks.every((b) => b.tagName.toLowerCase() === first) ? first : 'mixed'
}

export function queryAlignment(root, range) {
  const blocks = blocksInRange(root, range)
  if (!blocks.length) return null
  const read = (el) => {
    const value = (getStyle(el, 'text-align') || 'left').trim().toLowerCase()
    return ALIGN_VALUES.includes(value) ? value : 'left'
  }
  const first = read(blocks[0])
  return blocks.every((b) => read(b) === first) ? first : 'mixed'
}
