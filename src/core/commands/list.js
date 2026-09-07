import { replaceTag, isElement, closestTag } from '../dom'
import { rootBlocksInRange, blocksInRange, snapshotSelection, restoreSelection } from '../selection'
import { normalizeInlines } from '../normalize'

const LIST_TAGS = ['UL', 'OL']

const listItemsOf = (root, range) => blocksInRange(root, range).filter((el) => el.tagName === 'LI')

export function queryList(root, range) {
  const blocks = blocksInRange(root, range)
  if (!blocks.length) return null
  const tags = blocks.map((b) => {
    const list = closestTag(root, b, LIST_TAGS)
    return list ? list.tagName.toLowerCase() : null
  })
  return tags.every((t) => t === tags[0]) ? tags[0] : 'mixed'
}

/**
 * List toggle. Turns the blocks in the range into items of a new list, or back
 * into paragraphs when they already belong to a list of the same type.
 */
export function toggleList(root, range, tag) {
  const snapshot = snapshotSelection(root)
  const current = queryList(root, range)

  if (current === tag) {
    unwrapItems(root, listItemsOf(root, range))
  } else if (current && current !== 'mixed') {
    // Type change: the container is replaced, the items stay as they are.
    const items = listItemsOf(root, range)
    const lists = new Set(items.map((li) => li.parentNode).filter(Boolean))
    lists.forEach((list) => replaceTag(list, tag))
  } else {
    wrapBlocks(root, range, tag)
  }

  restoreSelection(root, snapshot)
  return true
}

function wrapBlocks(root, range, tag) {
  const blocks = rootBlocksInRange(root, range).filter(
    (el) => isElement(el) && ['P', 'H2', 'H3', 'H4'].includes(el.tagName)
  )
  if (!blocks.length) return

  const list = document.createElement(tag)
  root.insertBefore(list, blocks[0])
  for (const block of blocks) {
    const li = document.createElement('li')
    // Alignment travels from the block to the item.
    const align = block.getAttribute('style')
    if (align) li.setAttribute('style', align)
    while (block.firstChild) li.appendChild(block.firstChild)
    list.appendChild(li)
    block.parentNode.removeChild(block)
  }
  mergeSiblingLists(root, list)
}

// Turns items back into paragraphs, splitting the list when needed.
/** @returns {HTMLElement[]} the paragraphs created, in order. */
export function unwrapItems(root, items) {
  const created = []
  for (const li of items) {
    const list = li.parentNode
    if (!list || !LIST_TAGS.includes(list.tagName)) continue

    const p = document.createElement('p')
    const style = li.getAttribute('style')
    if (style) p.setAttribute('style', style)
    while (li.firstChild) p.appendChild(li.firstChild)
    if (!p.firstChild) p.appendChild(document.createElement('br'))

    const after = splitListAfter(list, li)
    list.parentNode.insertBefore(p, after || list.nextSibling)
    list.removeChild(li)

    if (!list.children.length) list.parentNode.removeChild(list)
    normalizeInlines(p)
    created.push(p)
  }
  return created
}

// Splits the list, moving the items after `li` into a new one.
// Returns that list, or null when `li` was the last item.
function splitListAfter(list, li) {
  const following = []
  let next = li.nextElementSibling
  while (next) {
    following.push(next)
    next = next.nextElementSibling
  }
  if (!following.length) return null

  const tail = document.createElement(list.tagName.toLowerCase())
  following.forEach((item) => tail.appendChild(item))
  list.parentNode.insertBefore(tail, list.nextSibling)
  return tail
}

// Two adjacent lists of the same type read as one, so they get merged.
function mergeSiblingLists(root, list) {
  const previous = list.previousElementSibling
  if (previous && previous.tagName === list.tagName) {
    while (list.firstChild) previous.appendChild(list.firstChild)
    list.parentNode.removeChild(list)
    return mergeSiblingLists(root, previous)
  }
  const next = list.nextElementSibling
  if (next && next.tagName === list.tagName) {
    while (next.firstChild) list.appendChild(next.firstChild)
    next.parentNode.removeChild(next)
  }
  return list
}

export { LIST_TAGS, mergeSiblingLists }
