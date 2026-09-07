<template>
  <div class="fa-editor-color-picker">
    <div
      ref="area"
      class="fa-editor-color-picker__area"
      :style="{ '--fa-picker-hue': hue }"
      @pointerdown="startArea"
    >
      <span
        class="fa-editor-color-picker__pointer"
        :style="{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: preview }"
      ></span>
    </div>

    <div ref="hue" class="fa-editor-color-picker__hue" @pointerdown="startHue">
      <span
        class="fa-editor-color-picker__pointer"
        :style="{ left: `${(hsv.h / 360) * 100}%`, background: `hsl(${hue}, 100%, 50%)` }"
      ></span>
    </div>

    <div class="fa-editor-color-picker__row">
      <span class="fa-editor-color-picker__hash">#</span>
      <input
        ref="input"
        v-model="hex"
        type="text"
        class="fa-editor-color-picker__input"
        maxlength="6"
        spellcheck="false"
        autocomplete="off"
        :placeholder="t('hex')"
        :aria-label="t('hex')"
        @input="onHexInput"
        @keydown.enter.prevent="accept"
        @keydown.esc.prevent="$emit('cancel')"
      />
    </div>

    <div class="fa-editor-color-picker__actions">
      <button
        type="button"
        class="fa-editor__btn fa-editor-color-picker__accept"
        :title="t('accept')"
        :aria-label="t('accept')"
        @mousedown.prevent
        @click="accept"
      >
        <FaIcon name="check" />
      </button>
      <button
        type="button"
        class="fa-editor__btn fa-editor-color-picker__cancel"
        :title="t('cancel')"
        :aria-label="t('cancel')"
        @mousedown.prevent
        @click="$emit('cancel')"
      >
        <FaIcon name="close" />
      </button>
    </div>
  </div>
</template>

<script>
import { parseColor, hsvToHex, hexToHsv, formatHsl } from './core/color'
import FaIcon from './FaIcon.vue'
import { defaultTranslator } from './core/lang'

const DEFAULT_HSV = { h: 0, s: 0, v: 0 }

export default {
  components: { FaIcon },
  inject: {
    t: { from: 'faEditorT', default: () => defaultTranslator }
  },
  props: {
    // The text's current color, in whatever format it happens to be stored.
    value: {
      type: String,
      default: null
    }
  },
  emits: ['accept', 'cancel'],
  data() {
    const hsv = parseColor(this.value) || { ...DEFAULT_HSV }
    return { hsv, hex: hsvToHex(hsv) }
  },
  computed: {
    hue() {
      return Math.round(this.hsv.h)
    },
    preview() {
      return `#${hsvToHex(this.hsv)}`
    }
  },
  mounted() {
    // Pointer events are captured at document level: dragging outside the
    // panel has to keep moving the handle, as in any color picker.
    this.onMove = (event) => {
      if (!this.dragging) return
      event.preventDefault()
      this.applyPointer(event)
    }
    this.onUp = () => {
      this.dragging = null
    }
    document.addEventListener('pointermove', this.onMove)
    document.addEventListener('pointerup', this.onUp)
    document.addEventListener('pointercancel', this.onUp)
  },
  beforeUnmount() {
    document.removeEventListener('pointermove', this.onMove)
    document.removeEventListener('pointerup', this.onUp)
    document.removeEventListener('pointercancel', this.onUp)
  },
  methods: {
    startArea(event) {
      this.dragging = 'area'
      this.applyPointer(event)
    },

    startHue(event) {
      this.dragging = 'hue'
      this.applyPointer(event)
    },

    applyPointer(event) {
      const element = this.dragging === 'hue' ? this.$refs.hue : this.$refs.area
      if (!element) return

      const rect = element.getBoundingClientRect()
      const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))

      if (this.dragging === 'hue') {
        this.hsv = { ...this.hsv, h: x * 360 }
      } else {
        const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
        this.hsv = { ...this.hsv, s: x, v: 1 - y }
      }
      this.hex = hsvToHex(this.hsv)
    },

    onHexInput() {
      // Typed without the `#`. While the value is incomplete the handle is
      // left alone: it only syncs once the hex parses.
      const parsed = hexToHsv(this.hex)
      if (parsed) this.hsv = parsed
    },

    accept() {
      const parsed = hexToHsv(this.hex)
      if (parsed) this.hsv = parsed
      this.$emit('accept', formatHsl(this.hsv))
    }
  }
}
</script>

<style></style>
