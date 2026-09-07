<template>
  <div class="fa-editor-color-grid">
    <template v-if="!picking">
      <button
        type="button"
        class="fa-editor-color-grid__remove"
        @mousedown.prevent
        @click="$emit('select', null)"
      >
        <FaIcon name="close" />
        <span>{{ t('removeColor') }}</span>
      </button>
      <div class="fa-editor-color-grid__grid" :style="{ '--fa-color-columns': columns }">
        <button
          v-for="item in colors"
          :key="item.color"
          type="button"
          class="fa-editor-color-grid__swatch"
          :class="{
            'fa-editor-color-grid__swatch--bordered': item.hasBorder,
            'fa-editor-color-grid__swatch--on': item.color === modelValue
          }"
          :style="{ background: item.color }"
          :title="t(item.label)"
          :aria-label="t(item.label)"
          @mousedown.prevent
          @click="$emit('select', item.color)"
        ></button>
      </div>
      <button
        type="button"
        class="fa-editor-color-grid__more"
        @mousedown.prevent
        @click="picking = true"
      >
        <FaIcon name="palette" />
        <span>{{ t('colorPicker') }}</span>
      </button>
    </template>

    <FaColorPicker
      v-else
      :value="modelValue"
      @accept="$emit('select', $event)"
      @cancel="picking = false"
    />
  </div>
</template>

<script>
import FaIcon from './FaIcon.vue'
import FaColorPicker from './FaColorPicker.vue'
import { COLORS, COLOR_COLUMNS } from './core/constants'
import { defaultTranslator } from './core/lang'

export default {
  components: { FaColorPicker, FaIcon },
  inject: {
    t: { from: 'faEditorT', default: () => defaultTranslator }
  },
  props: {
    modelValue: {
      type: String,
      default: null
    }
  },
  emits: ['select'],
  data: () => ({
    colors: COLORS,
    columns: COLOR_COLUMNS,
    picking: false
  })
}
</script>

<style></style>
