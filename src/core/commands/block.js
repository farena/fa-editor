import { replaceTag, isElement } from '../dom'
import { blocksInRange, snapshotSelection, restoreSelection } from '../selection'
import { getStyle, setStyle } from '../css'
import { readIndent, writeIndent, clampLevel } from '../indent'
import { indentItems, outdentItems, itemDepth, canIndentItem, canOutdentItem } from './list'
import { BLOCK_TAGS, ALIGNMENTS, INDENTABLE_TAGS, MAX_INDENT } from '../constants'

const ALIGN_VALUES = ALIGNMENTS.map((a) => a.model)

const isConvertible = (el) => isElement(el) && BLOCK_TAGS.includes(el.tagName)

const isIndentable = (el) => isElement(el) && INDENTABLE_TAGS.includes(el.tagName)

const isItem = (el) => isElement(el) && el.tagName === 'LI'

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

/**
 * Moves the blocks in the range one level in or out. Each block moves from the
 * level it is at, so indenting a mixed selection keeps the relative steps.
 *
 * A list item is not indented with a margin: its level is how deep it is
 * nested, so it moves in and out of sublists instead.
 */
export function changeIndent(root, range, direction) {
  const blocks = blocksInRange(root, range).filter(isIndentable)
  if (!blocks.length) return false

  const snapshot = snapshotSelection(root)
  const items = blocks.filter(isItem)
  let changed = items.length
    ? direction > 0
      ? indentItems(root, items)
      : outdentItems(root, items)
    : false

  for (const block of blocks) {
    if (isItem(block)) {
      // Older content carries the margin an <li> used to be indented with.
      // Outdenting is what clears it; nesting replaced it.
      if (direction < 0 && readIndent(block)) {
        writeIndent(block, 0)
        changed = true
      }
      continue
    }
    const current = readIndent(block)
    const next = clampLevel(current + direction)
    if (next === current) continue
    writeIndent(block, next)
    changed = true
  }
  restoreSelection(root, snapshot)
  return changed
}

// An item's level is its nesting depth; every other block reads its margin.
const levelOf = (root, block) => (isItem(block) ? itemDepth(root, block) : readIndent(block))

/**
 * @returns {number|null} the level when uniform, `null` with nothing indentable
 *   under the caret, `'mixed'` when it varies.
 */
export function queryIndent(root, range) {
  const blocks = blocksInRange(root, range).filter(isIndentable)
  if (!blocks.length) return null
  const first = levelOf(root, blocks[0])
  return blocks.every((block) => levelOf(root, block) === first) ? first : 'mixed'
}

/**
 * Whether the buttons have anywhere to go. A mixed selection only needs one
 * block that can still move: the others stay where they are.
 *
 * @returns {{ canIndent: boolean, canOutdent: boolean }}
 */
export function queryIndentLimits(root, range) {
  const blocks = blocksInRange(root, range).filter(isIndentable)
  const canIndent = (block) =>
    isItem(block) ? canIndentItem(root, block) : readIndent(block) < MAX_INDENT
  const canOutdent = (block) =>
    isItem(block) ? canOutdentItem(root, block) || readIndent(block) > 0 : readIndent(block) > 0

  return {
    canIndent: blocks.some(canIndent),
    canOutdent: blocks.some(canOutdent)
  }
}
