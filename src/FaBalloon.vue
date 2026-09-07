<template>
  <teleport to="body">
    <div
      v-show="!hidden"
      ref="balloon"
      class="fa-editor-balloon"
      :class="`fa-editor-balloon--${placement}`"
      :style="style"
      @mousedown="onMousedown"
    >
      <slot />
    </div>
  </teleport>
</template>

<script>
import { positionPanel } from './core/position'

const same = (a, b) =>
  !!a && a.top === b.top && a.left === b.left && a['--fa-arrow-left'] === b['--fa-arrow-left']

export default {
  props: {
    /**
     * Returns the viewport rect to anchor to, or null to hide.
     * It is a function and not a fixed rect because the anchor moves: when the
     * container scrolls (a modal, say) its position has to be read again.
     */
    anchor: {
      type: Function,
      required: true
    },
    prefer: {
      type: String,
      default: 'south'
    }
  },
  data: () => ({
    placement: 'south',
    hidden: true,
    style: null
  }),
  mounted() {
    this.reposition()
    // Capture phase: scroll does not bubble, but it does travel down on
    // capture. That is what makes the balloon follow content inside a modal.
    window.addEventListener('scroll', this.reposition, true)
    window.addEventListener('resize', this.reposition)
  },
  updated() {
    this.reposition()
  },
  beforeUnmount() {
    window.removeEventListener('scroll', this.reposition, true)
    window.removeEventListener('resize', this.reposition)
  },
  methods: {
    /**
     * A click inside the balloon must not steal the selection from the
     * editable: without a selection, commands have nothing to act on.
     *
     * Text fields are the exception. `preventDefault` on mousedown also cancels
     * focus, so over an <input> this rule would make it unusable: the link form
     * would open but refuse to accept typing.
     */
    onMousedown(event) {
      if (event.target.closest('input, textarea, select, [contenteditable]')) return
      event.preventDefault()
    },

    reposition() {
      const balloon = this.$refs.balloon
      if (!balloon) return

      const rect = this.anchor()
      if (!rect) {
        this.hidden = true
        return
      }

      const { top, left, placement, arrowLeft } = positionPanel(rect, balloon, {
        prefer: this.prefer
      })
      const style = {
        top: `${top}px`,
        left: `${left}px`,
        '--fa-arrow-left': `${arrowLeft}px`
      }

      // `updated` calls this again after every render. Writing a fresh object
      // every time re-triggers the hook forever, which Vue aborts with
      // "Maximum recursive updates exceeded", so only real movement is written.
      this.hidden = false
      this.placement = placement
      if (!same(this.style, style)) this.style = style
    }
  }
}
</script>

<style></style>
