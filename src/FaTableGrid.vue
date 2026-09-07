<template>
  <div class="fa-editor-table-grid" @mouseleave="reset">
    <div class="fa-editor-table-grid__grid" :style="{ '--fa-grid-size': size }">
      <button
        v-for="cell in cells"
        :key="`${cell.row}-${cell.col}`"
        type="button"
        class="fa-editor-table-grid__cell"
        :class="{ 'fa-editor-table-grid__cell--on': cell.row <= rows && cell.col <= cols }"
        @mousedown.prevent
        @mouseenter="hover(cell)"
        @click="$emit('select', { rows: cell.row, cols: cell.col })"
      ></button>
    </div>
    <p class="fa-editor-table-grid__label">{{ rows }} &times; {{ cols }}</p>
  </div>
</template>

<script>
import { TABLE_GRID_SIZE } from './core/constants'

export default {
  emits: ['select'],
  data: () => ({
    size: TABLE_GRID_SIZE,
    rows: 0,
    cols: 0
  }),
  computed: {
    cells() {
      const list = []
      for (let row = 1; row <= this.size; row++) {
        for (let col = 1; col <= this.size; col++) list.push({ row, col })
      }
      return list
    }
  },
  methods: {
    hover({ row, col }) {
      this.rows = row
      this.cols = col
    },
    reset() {
      this.rows = 0
      this.cols = 0
    }
  }
}
</script>

<style></style>
