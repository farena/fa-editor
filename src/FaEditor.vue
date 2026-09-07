<template>
  <div
    class="fa-editor"
    :class="{ 'fa-editor--disabled': disabled, 'fa-editor--focused': focused }"
  >
    <FaToolbar
      :state="state"
      :canUndo="canUndo"
      :canRedo="canRedo"
      :disabled="disabled"
      @command="onCommand"
    />

    <div
      ref="content"
      class="fa-editor__content"
      :class="{ 'fa-editor__content--empty': showPlaceholder }"
      :contenteditable="!disabled"
      :data-placeholder="placeholder || ''"
      role="textbox"
      aria-multiline="true"
      @beforeinput="onBeforeInput"
      @input="onInput"
      @keydown="onKeydown"
      @paste="onPaste"
      @drop.prevent
      @focus="focused = true"
      @blur="onBlur"
      @click="onClick"
      @compositionstart="composing = true"
      @compositionend="onCompositionEnd"
    ></div>

    <FaBalloon v-if="linkOpen" :anchor="linkRect">
      <FaLinkBalloon
        :value="linkHref"
        :initialEditing="linkEditing"
        @save="saveLink"
        @unlink="removeLink"
        @cancel="closeLinkBalloon"
      />
    </FaBalloon>

    <FaBalloon v-if="tableOpen" :anchor="tableRect" prefer="north">
      <FaTableBalloon @command="onTableCommand" />
    </FaBalloon>

    <FaBalloon v-if="mentionOpen" :anchor="mentionRect">
      <FaMentionList
        :items="mentionItems"
        :active="mentionActive"
        @select="applyMention"
        @activate="mentionActive = $event"
      />
    </FaBalloon>
  </div>
</template>

<script>
import FaToolbar from './FaToolbar.vue'
import FaBalloon from './FaBalloon.vue'
import FaLinkBalloon from './FaLinkBalloon.vue'
import FaTableBalloon from './FaTableBalloon.vue'
import FaMentionList from './FaMentionList.vue'

import debounce from './core/debounce'
import History from './core/history'
import { getData, setData } from './core/serialize'
import { guardStructure } from './core/normalize'
import { computeState, EMPTY_STATE } from './core/state'
import { translator, LANGS, DEFAULT_LANG } from './core/lang'
import { handlePaste } from './core/paste'
import { detectMention, filterFeed, insertMention } from './core/mentions'
import { isOutOfView } from './core/position'
import {
  getRange,
  setRange,
  caretRect,
  lastTextPosition,
  collapseTo,
  isSelectionInside
} from './core/selection'
import {
  handleEnter,
  handleSoftBreak,
  handleBackspaceAtStart,
  handleDeleteAtEnd
} from './core/keys'
import {
  applyInline,
  removeInline,
  boldSpec,
  italicSpec,
  fontFamilySpec,
  fontSizeSpec,
  fontColorSpec
} from './core/commands/inline'
import { setBlockTag, setAlignment } from './core/commands/block'
import { toggleList } from './core/commands/list'
import { applyLink, updateLink, unlink, findLink, autoLink } from './core/commands/link'
import * as table from './core/commands/table'

const EMIT_DEBOUNCE = 300
const ZWSP = '\u200b'

export default {
  components: { FaToolbar, FaBalloon, FaLinkBalloon, FaTableBalloon, FaMentionList },
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    placeholder: String,
    disabled: {
      type: Boolean,
      default: false
    },
    autocompleteOpts: {
      type: Array,
      default: null
    },
    lang: {
      type: String,
      default: DEFAULT_LANG,
      validator: (value) => LANGS.includes(value)
    }
  },
  emits: ['update:modelValue', 'focus', 'blur'],
  /**
   * The lookup handed down to the toolbar, the panels and the balloons. It is a
   * function and not the dictionary itself so it reads `this.lang` at call time:
   * that keeps the dependency tracked, and changing `lang` re-renders every
   * label, including the ones teleported to <body>.
   */
  provide() {
    return {
      faEditorT: (key) => translator(this.lang)(key)
    }
  },
  data: () => ({
    state: { ...EMPTY_STATE },
    focused: false,
    composing: false,
    empty: true,
    canUndo: false,
    canRedo: false,
    lastEmittedData: null,
    linkOpen: false,
    linkHref: '',
    linkEditing: false,
    tableOpen: false,
    mentionOpen: false,
    mentionItems: [],
    mentionActive: 0,
    mentionContext: null
  }),
  computed: {
    showPlaceholder() {
      return this.empty && !!this.placeholder
    },
    mentionFeed() {
      if (!this.autocompleteOpts) return null
      return this.autocompleteOpts.filter((option) => option.startsWith('#'))
    }
  },
  watch: {
    modelValue(value) {
      // Only reload when the change comes from outside; otherwise the caret jumps.
      if (value === this.lastEmittedData) return
      this.load(value)
    },
    disabled(value) {
      if (value) this.closeAllBalloons()
    }
  },
  created() {
    this.emitChange = debounce(this.flushChange, EMIT_DEBOUNCE, { leading: true })
    // The history entry is only created once typing stops, so canUndo has to be
    // re-read here: in `onInput` it still holds the previous value.
    this.recordTyping = debounce(() => {
      if (!this.history) return
      this.history.record('typing')
      this.syncFlags()
    }, 400)
    this.refreshState = () => {
      if (this.stateFrame) return
      this.stateFrame = requestAnimationFrame(() => {
        this.stateFrame = null
        this.updateState()
      })
    }
  },
  mounted() {
    // References to DOM nodes: kept out of `data` so they never become reactive.
    this.linkTarget = null
    this.tableFigure = null
    this.mentionAnchor = null
    this.savedRange = null
    this.mentionSpace = null
    this.lastRange = null

    const root = this.$refs.content
    setData(root, this.modelValue)
    this.history = new History(root)
    this.lastEmittedData = this.modelValue
    this.syncFlags()
    document.addEventListener('selectionchange', this.onSelectionChange)
  },
  beforeUnmount() {
    document.removeEventListener('selectionchange', this.onSelectionChange)
    if (this.stateFrame) cancelAnimationFrame(this.stateFrame)
    this.emitChange.cancel()
    this.recordTyping.cancel()
  },
  methods: {
    // --- Public API ---------------------------------------------------------

    focus() {
      const root = this.$refs.content
      if (!root) return
      root.focus()
      const last = root.lastElementChild
      if (!last) return
      const { node, offset } = lastTextPosition(last)
      collapseTo(node, offset)
    },

    getData() {
      return getData(this.$refs.content)
    },

    // --- Data cycle ---------------------------------------------------------

    load(value) {
      const root = this.$refs.content
      if (!root) return
      setData(root, value)
      this.history.reset(root.innerHTML)
      this.closeAllBalloons()
      this.syncFlags()

      // Data arriving from outside is re-emitted already normalized. Without
      // this the parent and the editor hold two different representations of the
      // same content, and the user's first keystroke produces a diff that does
      // not correspond to what they typed.
      const data = getData(root)
      this.lastEmittedData = data
      if (data !== value) this.$emit('update:modelValue', data)
    },

    flushChange() {
      const data = getData(this.$refs.content)
      this.lastEmittedData = data
      this.$emit('update:modelValue', data)
    },

    syncFlags() {
      const root = this.$refs.content
      this.empty = !root.textContent.replace(/[\s\u00a0\u200b]/g, '').length
      if (this.history) {
        this.canUndo = this.history.canUndo
        this.canRedo = this.history.canRedo
      }
    },

    // Called after every mutation we make ourselves.
    commit(kind = 'command') {
      guardStructure(this.$refs.content)
      this.history.record(kind)
      this.syncFlags()
      this.emitChange()
      this.refreshState()
    },

    // --- Content events -----------------------------------------------------

    onBeforeInput(event) {
      if (this.disabled || this.composing) return
      const root = this.$refs.content
      const range = getRange(root)
      if (!range) return

      const type = event.inputType

      // Browsers ship their own formatting shortcuts (Ctrl+U being the usual
      // one) that would produce <u> or <s>, tags the contract does not include.
      if (type.startsWith('format')) {
        event.preventDefault()
        return
      }

      if (type === 'insertParagraph') {
        event.preventDefault()
        autoLink(root, range)
        handleEnter(root, getRange(root) || range)
        this.commit()
        return
      }

      if (type === 'insertLineBreak') {
        event.preventDefault()
        handleSoftBreak(root, range)
        this.commit()
        return
      }

      if (type === 'deleteContentBackward' && handleBackspaceAtStart(root, range)) {
        event.preventDefault()
        this.commit()
        return
      }

      if (type === 'deleteContentForward' && handleDeleteAtEnd(root, range)) {
        event.preventDefault()
        this.commit()
      }
    },

    onInput(event) {
      if (this.composing) return
      const root = this.$refs.content
      if (this.history.isRestoring) return

      guardStructure(root)
      this.releaseMentionSpace()
      if (event && event.inputType === 'insertText' && event.data === ' ') this.tryAutoLink()
      this.recordTyping()
      this.syncFlags()
      this.emitChange()
      this.refreshState()
      this.updateMentions()
    },

    onCompositionEnd() {
      this.composing = false
      this.onInput()
    },

    onKeydown(event) {
      if (this.disabled) return

      // Mentions claim the arrow keys before any other handler.
      if (this.mentionOpen && this.onMentionKeydown(event)) return

      const meta = event.ctrlKey || event.metaKey

      if (meta && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault()
        return this.runHistory('undo')
      }
      if (
        meta &&
        (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))
      ) {
        event.preventDefault()
        return this.runHistory('redo')
      }
      if (meta && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        return this.onCommand('bold')
      }
      if (meta && event.key.toLowerCase() === 'i') {
        event.preventDefault()
        return this.onCommand('italic')
      }
      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        return this.onCommand('link')
      }
      if (event.key === 'Tab' && this.moveBetweenCells(event.shiftKey)) {
        event.preventDefault()
        return
      }
      // Both are supported: shift+enter is the muscle memory, ctrl+enter the label.
      if (event.key === 'Enter' && (meta || event.shiftKey)) {
        event.preventDefault()
        const range = getRange(this.$refs.content)
        if (!range) return
        handleSoftBreak(this.$refs.content, range)
        this.commit()
        return
      }
    },

    /**
     * Tab inside a table jumps to the next cell, and on the last one adds a
     * row. It is the only comfortable way to walk a table from the keyboard.
     *
     * @returns {boolean} true when the Tab was consumed
     */
    moveBetweenCells(backwards) {
      const root = this.$refs.content
      const range = getRange(root)
      if (!range) return false

      const cell = table.cellOf(root, range.startContainer)
      const tableEl = cell && table.tableOf(root, cell)
      if (!tableEl) return false

      const cells = Array.from(tableEl.querySelectorAll('td, th'))
      const index = cells.indexOf(cell)
      let target = cells[index + (backwards ? -1 : 1)]

      if (!target) {
        if (backwards) return true
        table.insertRow(tableEl, cell, 'below')
        const row = tableEl.rows[tableEl.rows.length - 1]
        target = row && row.cells[0]
      }
      if (!target) return true

      // The target cell's content is left selected rather than the caret placed
      // at the end: tabbing and typing replaces what was there.
      const selection = document.createRange()
      selection.selectNodeContents(target)
      setRange(selection)
      this.commit()
      return true
    },

    // Autolink runs from `input`, not from `keydown`: on keydown the space is
    // not in the DOM yet and the caret sits one character back, which cut the
    // URL short by a character.
    tryAutoLink() {
      const root = this.$refs.content
      const range = getRange(root)
      if (!range || !range.collapsed) return
      if (range.startContainer.nodeType !== Node.TEXT_NODE || range.startOffset === 0) return

      const probe = range.cloneRange()
      probe.setStart(probe.startContainer, probe.startOffset - 1)
      probe.collapse(true)
      if (autoLink(root, probe)) {
        setRange(range)
        this.commit()
      }
    },

    onClick(event) {
      // A link inside the editor must not navigate.
      const link = event.target.closest && event.target.closest('a')
      if (link && this.$refs.content.contains(link)) event.preventDefault()
      this.refreshState()
    },

    onBlur(event) {
      this.focused = false
      this.$emit('blur', event)
    },

    onPaste(event) {
      if (this.disabled) return
      event.preventDefault()
      const root = this.$refs.content
      const range = getRange(root)
      if (!range || !event.clipboardData) return
      if (handlePaste(root, range, event.clipboardData)) this.commit('paste')
    },

    onSelectionChange() {
      if (!this.$refs.content || !isSelectionInside(this.$refs.content)) return
      // The last valid selection is remembered: panels with a text field (the
      // color picker's hex input) take focus away from the editable, and the
      // selection with it, but the command still has to apply to whatever was
      // selected.
      this.lastRange = getRange(this.$refs.content)
      this.refreshState()
      this.updateMentions()
    },

    // --- State and balloons -------------------------------------------------

    updateState() {
      const root = this.$refs.content
      if (!root) return
      const range = getRange(root)
      this.state = computeState(root, range)
      this.syncLinkBalloon(range)
      this.syncTableBalloon()
    },

    syncLinkBalloon(range) {
      if (this.linkEditing) return
      const link = this.state.link
      if (!link || !range) {
        this.linkOpen = false
        this.linkTarget = null
        return
      }
      this.linkTarget = link
      this.linkHref = link.getAttribute('href') || ''
      this.linkOpen = true
    },

    syncTableBalloon() {
      const cell = this.state.cell
      if (!cell || this.disabled) {
        this.tableOpen = false
        this.tableFigure = null
        return
      }
      this.tableFigure = table.figureOf(this.$refs.content, cell) || this.state.table
      this.tableOpen = !!this.tableFigure
    },

    // Live anchors for the balloons. Returning null hides them, which is what
    // happens when the anchor scrolls out of the editor's visible area.
    linkRect() {
      if (this.linkTarget && this.linkTarget.isConnected) {
        return this.clampToContent(this.linkTarget.getBoundingClientRect())
      }
      return this.savedRange ? this.clampToContent(caretRect(this.savedRange)) : null
    },

    tableRect() {
      if (!this.tableFigure || !this.tableFigure.isConnected) return null
      return this.clampToContent(this.tableFigure.getBoundingClientRect())
    },

    mentionRect() {
      if (!this.mentionAnchor) return null
      try {
        return this.clampToContent(caretRect(this.mentionAnchor))
      } catch {
        return null
      }
    },

    clampToContent(rect) {
      const root = this.$refs.content
      if (!root) return null
      return isOutOfView(rect, root.getBoundingClientRect()) ? null : rect
    },

    closeAllBalloons() {
      this.linkOpen = false
      this.linkEditing = false
      this.linkTarget = null
      this.tableOpen = false
      this.tableFigure = null
      this.closeMentions()
    },

    // --- Toolbar commands ---------------------------------------------------

    // Gives the editable back the selection it had before a panel stole focus.
    // A live Range moves with the DOM, but once its container has left the tree
    // it is no longer usable.
    restoreLastRange() {
      const range = this.lastRange
      const root = this.$refs.content
      if (!range || !root || !root.contains(range.startContainer)) return
      setRange(range)
    },

    onCommand(name, value) {
      if (this.disabled) return
      if (name === 'undo' || name === 'redo') return this.runHistory(name)

      const root = this.$refs.content
      if (!isSelectionInside(root)) this.restoreLastRange()
      if (!isSelectionInside(root)) this.focus()
      const range = getRange(root)
      if (!range) return

      const handlers = {
        bold: () => this.toggleInline(range, boldSpec, true, this.state.bold),
        italic: () => this.toggleInline(range, italicSpec, true, this.state.italic),
        fontFamily: () => this.setInline(range, fontFamilySpec, value),
        fontSize: () => this.setInline(range, fontSizeSpec, value),
        fontColor: () => this.setInline(range, fontColorSpec, value),
        heading: () => setBlockTag(root, range, value),
        alignment: () => setAlignment(root, range, value),
        bulletedList: () => toggleList(root, range, 'ul'),
        numberedList: () => toggleList(root, range, 'ol'),
        insertTable: () => table.insertTable(root, range, value.rows, value.cols),
        link: () => this.openLinkBalloon(range)
      }

      const handler = handlers[name]
      if (!handler) return
      if (handler() !== false && name !== 'link') this.commit()
    },

    toggleInline(range, spec, value, isActive) {
      if (isActive) return removeInline(this.$refs.content, range, spec) || this.clearPending(spec)
      return this.applyOrPend(range, spec, value)
    },

    setInline(range, spec, value) {
      if (value == null) {
        return removeInline(this.$refs.content, range, spec) || this.clearPending(spec)
      }
      return this.applyOrPend(range, spec, value)
    },

    /**
     * With a collapsed selection there is no text to wrap: the empty wrapper is
     * inserted with an invisible character and the caret inside it, so the
     * format applies to whatever is typed next. getData drops the character.
     */
    applyOrPend(range, spec, value) {
      const root = this.$refs.content
      if (!range.collapsed) return applyInline(root, range, spec, value)

      const wrapper = spec.create(value)
      const text = document.createTextNode(ZWSP)
      wrapper.appendChild(text)
      range.insertNode(wrapper)
      collapseTo(text, 1)
      return true
    },

    clearPending() {
      return true
    },

    runHistory(action) {
      this.closeAllBalloons()
      if (!this.history[action]()) return
      this.syncFlags()
      this.emitChange()
      this.refreshState()
      this.$refs.content.focus()
    },

    // --- Links --------------------------------------------------------------

    openLinkBalloon(range) {
      const root = this.$refs.content
      const existing = findLink(root, range.startContainer)
      this.linkTarget = existing
      this.linkHref = existing ? existing.getAttribute('href') || '' : ''
      this.linkEditing = true
      this.savedRange = range.cloneRange()
      this.linkOpen = true
    },

    saveLink(href) {
      const root = this.$refs.content
      if (this.linkTarget) updateLink(root, this.linkTarget, href)
      else {
        if (this.savedRange) setRange(this.savedRange)
        const range = getRange(root)
        if (!range) return
        if (range.collapsed) {
          // With no text selected, the link uses the URL as its label.
          const text = document.createTextNode(href)
          range.insertNode(text)
          const wrap = document.createRange()
          wrap.selectNode(text)
          applyLink(root, wrap, href)
        } else {
          applyLink(root, range, href)
        }
      }
      this.linkEditing = false
      this.linkOpen = false
      this.commit()
    },

    removeLink() {
      const root = this.$refs.content
      unlink(root, getRange(root), this.linkTarget)
      this.linkEditing = false
      this.linkOpen = false
      this.linkTarget = null
      this.commit()
    },

    closeLinkBalloon() {
      this.linkEditing = false
      this.linkOpen = false
      this.$refs.content.focus()
    },

    // --- Tables -------------------------------------------------------------

    onTableCommand(command) {
      const root = this.$refs.content
      const cell = this.state.cell
      const tableEl = this.state.table
      if (!cell || !tableEl) return

      const actions = {
        columnInsertLeft: () => table.insertColumn(tableEl, cell, 'left'),
        columnInsertRight: () => table.insertColumn(tableEl, cell, 'right'),
        columnDelete: () => table.deleteColumn(tableEl, cell),
        columnHeader: () => table.toggleHeaderColumn(tableEl, cell),
        rowInsertAbove: () => table.insertRow(tableEl, cell, 'above'),
        rowInsertBelow: () => table.insertRow(tableEl, cell, 'below'),
        rowDelete: () => table.deleteRow(tableEl, cell),
        rowHeader: () => table.toggleHeaderRow(tableEl, cell),
        mergeUp: () => table.mergeCells(tableEl, cell, 'up'),
        mergeRight: () => table.mergeCells(tableEl, cell, 'right'),
        mergeDown: () => table.mergeCells(tableEl, cell, 'down'),
        mergeLeft: () => table.mergeCells(tableEl, cell, 'left'),
        splitHorizontally: () => table.splitCell(tableEl, cell, 'horizontally'),
        splitVertically: () => table.splitCell(tableEl, cell, 'vertically'),
        tableDelete: () => table.removeTable(root, tableEl)
      }

      const action = actions[command]
      if (!action) return
      action()
      this.commit()
    },

    // --- Mentions -----------------------------------------------------------

    updateMentions() {
      if (!this.mentionFeed) return
      const root = this.$refs.content
      const range = getRange(root)
      const context = range ? detectMention(root, range) : null

      if (!context) return this.closeMentions()

      const items = filterFeed(this.mentionFeed, context.query)
      if (!items.length) return this.closeMentions()

      const probe = document.createRange()
      probe.setStart(context.textNode, context.markerOffset)
      probe.collapse(true)

      this.mentionContext = context
      this.mentionAnchor = probe
      this.mentionItems = items
      this.mentionActive = Math.min(this.mentionActive, items.length - 1)
      this.mentionOpen = true
    },

    onMentionKeydown(event) {
      const total = this.mentionItems.length
      if (!total) return false

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        this.mentionActive = (this.mentionActive + 1) % total
        return true
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        this.mentionActive = (this.mentionActive - 1 + total) % total
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        this.applyMention(this.mentionItems[this.mentionActive])
        return true
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        this.closeMentions()
        return true
      }
      return false
    },

    applyMention(value) {
      if (!this.mentionContext) return
      const inserted = insertMention(this.$refs.content, this.mentionContext, value)
      this.mentionSpace = inserted ? inserted.space : null
      this.closeMentions()
      this.commit()
    },

    // The &nbsp; left behind a freshly inserted mention is only there to give
    // the caret somewhere to stand at the end of the block. Once it is no longer
    // last it becomes a plain space again, which is what the contract stores.
    // Only the one we inserted is touched: an &nbsp; that came in with the data
    // is content and is left alone.
    releaseMentionSpace() {
      const node = this.mentionSpace
      if (!node) return
      if (!node.parentNode || !node.data.startsWith('\u00a0')) {
        this.mentionSpace = null
        return
      }
      if (node.data.length === 1 && !node.nextSibling) return

      // Rewriting `data` resets the caret to offset 0 of the node, so it has to
      // be noted and put back. The length does not change, so the offset stays
      // valid.
      const current = getRange(this.$refs.content)
      const inside = current && current.startContainer === node
      const offset = inside ? current.startOffset : 0
      node.data = ` ${node.data.slice(1)}`
      if (inside) {
        const restored = document.createRange()
        restored.setStart(node, offset)
        restored.collapse(true)
        setRange(restored)
      }
      this.mentionSpace = null
    },

    closeMentions() {
      this.mentionOpen = false
      this.mentionAnchor = null
      this.mentionItems = []
      this.mentionActive = 0
      this.mentionContext = null
    }
  }
}
</script>

<style></style>
