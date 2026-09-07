<template>
  <svg
    v-if="icon"
    class="fa-editor__icon"
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="icon.box"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="icon.path" />
  </svg>
</template>

<script>
import { ICONS } from './core/icons'

/**
 * Draws one of the inlined icons. Buttons always carry their own `title` and
 * `aria-label`, so the glyph itself is decorative: `aria-hidden` keeps it out
 * of the accessibility tree, and `focusable="false"` keeps old Edge from
 * putting it in the tab order.
 */
export default {
  props: {
    name: {
      type: String,
      default: null
    }
  },
  computed: {
    icon() {
      return this.name ? ICONS[this.name] : null
    }
  }
}
</script>

<style></style>
