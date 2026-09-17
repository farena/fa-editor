import {
  queryInline,
  boldSpec,
  italicSpec,
  underlineSpec,
  fontFamilySpec,
  fontSizeSpec,
  fontColorSpec
} from './commands/inline'
import { queryBlockTag, queryAlignment, queryIndent } from './commands/block'
import { queryList } from './commands/list'
import { findLink } from './commands/link'
import { cellOf, tableOf } from './commands/table'

export const EMPTY_STATE = {
  bold: false,
  italic: false,
  underline: false,
  fontFamily: null,
  fontSize: null,
  fontColor: null,
  blockTag: null,
  align: null,
  indent: null,
  list: null,
  link: null,
  cell: null,
  table: null
}

/**
 * Formatting state under the caret, used to paint the toolbar.
 * Recomputed on `selectionchange` and after every command.
 */
export function computeState(root, range) {
  if (!range) return { ...EMPTY_STATE }

  const node = range.startContainer
  return {
    bold: queryInline(root, range, boldSpec) === true,
    italic: queryInline(root, range, italicSpec) === true,
    underline: queryInline(root, range, underlineSpec) === true,
    fontFamily: queryInline(root, range, fontFamilySpec),
    fontSize: queryInline(root, range, fontSizeSpec),
    fontColor: queryInline(root, range, fontColorSpec),
    blockTag: queryBlockTag(root, range),
    align: queryAlignment(root, range),
    indent: queryIndent(root, range),
    list: queryList(root, range),
    link: findLink(root, node),
    cell: cellOf(root, node),
    table: tableOf(root, node)
  }
}
