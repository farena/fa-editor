<template>
  <div class="fa-editor__toolbar" role="toolbar">
    <template v-for="(item, index) in items" :key="keyOf(item, index)">
      <span v-if="item === '|'" class="fa-editor__separator"></span>

      <button
        v-else-if="item.type === 'button'"
        type="button"
        class="fa-editor__btn"
        :class="{ 'fa-editor__btn--on': isOn(item.name) }"
        :title="t(item.label)"
        :aria-label="t(item.label)"
        :aria-pressed="item.toggle ? String(isOn(item.name)) : null"
        :disabled="isDisabled(item.name)"
        @mousedown.prevent
        @click="$emit('command', item.name)"
      >
        <FaIcon :name="item.icon" />
      </button>

      <FaDropdown
        v-else
        :title="t(item.label)"
        :icon="iconFor(item)"
        :label="labelFor(item)"
        :wide="item.wide"
        :disabled="disabled"
      >
        <template #default="{ close }">
          <FaColorGrid
            v-if="item.panel === 'fontColor'"
            :modelValue="asValue(state.fontColor)"
            @select="run('fontColor', $event, close)"
          />

          <FaTableGrid
            v-else-if="item.panel === 'table'"
            @select="run('insertTable', $event, close)"
          />

          <ul v-else class="fa-editor-panel__list">
            <li v-for="option in optionsFor(item.panel)" :key="option.key">
              <button
                type="button"
                class="fa-editor-panel__item"
                :class="{ 'fa-editor-panel__item--on': option.on }"
                :style="option.style"
                @mousedown.prevent
                @click="run(item.name, option.value, close)"
              >
                <FaIcon v-if="option.icon" :name="option.icon" />
                <component :is="option.tag || 'span'" class="fa-editor-panel__item-text">
                  {{ option.title }}
                </component>
              </button>
            </li>
          </ul>
        </template>
      </FaDropdown>
    </template>
  </div>
</template>

<script>
import FaIcon from './FaIcon.vue'
import FaDropdown from './FaDropdown.vue'
import FaColorGrid from './FaColorGrid.vue'
import FaTableGrid from './FaTableGrid.vue'
import { TOOLBAR_ITEMS, HEADINGS, ALIGNMENTS, FONT_FAMILIES, FONT_SIZES } from './core/constants'
import { defaultTranslator } from './core/lang'

export default {
  components: { FaDropdown, FaColorGrid, FaTableGrid, FaIcon },
  inject: {
    t: { from: 'faEditorT', default: () => defaultTranslator }
  },
  props: {
    state: {
      type: Object,
      required: true
    },
    canUndo: Boolean,
    canRedo: Boolean,
    disabled: Boolean
  },
  emits: ['command'],
  data: () => ({
    items: TOOLBAR_ITEMS
  }),
  methods: {
    keyOf(item, index) {
      return item === '|' ? `sep-${index}` : item.name
    },
    // A 'mixed' value stands for no concrete state, so nothing is highlighted.
    asValue(value) {
      return value === 'mixed' ? null : value
    },
    isOn(name) {
      const map = {
        bold: this.state.bold,
        italic: this.state.italic,
        link: !!this.state.link,
        bulletedList: this.state.list === 'ul',
        numberedList: this.state.list === 'ol'
      }
      return !!map[name]
    },
    isDisabled(name) {
      if (this.disabled) return true
      if (name === 'undo') return !this.canUndo
      if (name === 'redo') return !this.canRedo
      return false
    },
    // The alignment button shows the icon of the current alignment.
    iconFor(item) {
      if (item.panel !== 'alignment') return item.icon
      const current = ALIGNMENTS.find((a) => a.model === this.asValue(this.state.align))
      return (current || ALIGNMENTS[0]).icon
    },
    labelFor(item) {
      if (item.panel === 'heading') {
        const current = HEADINGS.find((h) => h.model === this.asValue(this.state.blockTag))
        // With no recognized block, the paragraph option is the one shown.
        return this.titleOf(current || HEADINGS[0])
      }
      if (item.panel === 'fontFamily') {
        const current = FONT_FAMILIES.find((f) => f.model === this.asValue(this.state.fontFamily))
        return current ? this.titleOf(current) : this.t('defaultOption')
      }
      if (item.panel === 'fontSize') {
        const current = FONT_SIZES.find((s) => s.model === this.asValue(this.state.fontSize))
        return current ? this.titleOf(current) : this.t('defaultOption')
      }
      return null
    },
    // Font family names are proper nouns and carry a literal title; everything
    // else names a key in the language file.
    titleOf(option) {
      return option.label ? this.t(option.label) : option.title
    },
    optionsFor(panel) {
      if (panel === 'heading') {
        return HEADINGS.map((option) => ({
          key: option.model,
          value: option.model,
          title: this.titleOf(option),
          // Each option previews itself in its own typeface.
          tag: option.model === 'p' ? 'span' : option.model,
          on: option.model === this.asValue(this.state.blockTag)
        }))
      }
      if (panel === 'alignment') {
        return ALIGNMENTS.map((option) => ({
          key: option.model,
          value: option.model,
          title: this.titleOf(option),
          icon: option.icon,
          on: option.model === this.asValue(this.state.align)
        }))
      }
      if (panel === 'fontFamily') {
        return FONT_FAMILIES.map((option) => ({
          key: option.model || 'default',
          value: option.model,
          title: this.titleOf(option),
          style: option.model ? { fontFamily: option.model } : null,
          on: option.model === this.asValue(this.state.fontFamily)
        }))
      }
      if (panel === 'fontSize') {
        return FONT_SIZES.map((option) => ({
          key: option.model || 'default',
          value: option.model,
          title: this.titleOf(option),
          style: { fontSize: option.preview },
          on: option.model === this.asValue(this.state.fontSize)
        }))
      }
      return []
    },
    run(name, value, close) {
      close()
      this.$emit('command', name, value)
    }
  }
}
</script>

<style></style>
