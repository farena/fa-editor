<template>
  <div class="fa-editor__dropdown">
    <button
      type="button"
      class="fa-editor__btn fa-editor__btn--dropdown"
      :class="{ 'fa-editor__btn--on': open || active }"
      :title="title"
      :aria-label="title"
      :aria-expanded="open ? 'true' : 'false'"
      :disabled="disabled"
      ref="trigger"
      @mousedown.prevent
      @click="toggle"
    >
      <FaIcon :name="icon" />
      <span v-if="label" class="fa-editor__btn-label">{{ label }}</span>
      <FaIcon name="caret" class="fa-editor__caret" />
    </button>

    <teleport to="body">
      <div
        v-if="open"
        ref="panel"
        class="fa-editor-panel"
        :class="{ 'fa-editor-panel--wide': wide }"
        :style="panelStyle"
        @mousedown="onPanelMousedown"
      >
        <slot :close="close" />
      </div>
    </teleport>
  </div>
</template>

<script>
import FaIcon from './FaIcon.vue'
import { positionPanel } from './core/position'

export default {
  components: { FaIcon },
  props: {
    title: String,
    label: String,
    icon: String,
    wide: {
      type: Boolean,
      default: false
    },
    active: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  emits: ['open', 'close'],
  data: () => ({
    open: false,
    panelStyle: null
  }),
  beforeUnmount() {
    this.unbind()
  },
  methods: {
    /**
     * A click inside the panel must not steal the selection from the editable,
     * but `preventDefault` on mousedown also cancels focus: over a text field
     * (the color picker's hex input) that would make it unusable.
     */
    onPanelMousedown(event) {
      if (event.target.closest('input, textarea, select, [contenteditable]')) return
      event.preventDefault()
    },

    toggle() {
      if (this.disabled) return
      if (this.open) this.close()
      else this.show()
    },
    show() {
      this.open = true
      this.$emit('open')
      this.$nextTick(this.reposition)
      // Scroll is listened for on capture so a modal's own scroll is seen too.
      document.addEventListener('mousedown', this.onOutside, true)
      document.addEventListener('keydown', this.onKeydown, true)
      window.addEventListener('scroll', this.reposition, true)
      window.addEventListener('resize', this.reposition)
    },
    close() {
      if (!this.open) return
      this.open = false
      this.unbind()
      this.$emit('close')
    },
    unbind() {
      document.removeEventListener('mousedown', this.onOutside, true)
      document.removeEventListener('keydown', this.onKeydown, true)
      window.removeEventListener('scroll', this.reposition, true)
      window.removeEventListener('resize', this.reposition)
    },
    reposition() {
      const trigger = this.$refs.trigger
      const panel = this.$refs.panel
      if (!trigger || !panel) return
      const { top, left } = positionPanel(trigger.getBoundingClientRect(), panel, { margin: 2 })
      this.panelStyle = { top: `${top}px`, left: `${left}px` }
    },
    onOutside(event) {
      const panel = this.$refs.panel
      const trigger = this.$refs.trigger
      if (panel && panel.contains(event.target)) return
      if (trigger && trigger.contains(event.target)) return
      this.close()
    },
    onKeydown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        this.close()
      }
    }
  }
}
</script>

<style></style>
