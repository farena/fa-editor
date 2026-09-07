<template>
  <ul class="fa-editor-mentions">
    <li v-for="(item, index) in items" :key="item">
      <button
        type="button"
        class="fa-editor-mentions__item"
        :class="{ 'fa-editor-mentions__item--on': index === active }"
        @mousedown.prevent
        @mouseenter="$emit('activate', index)"
        @click="$emit('select', item)"
      >
        {{ item }}
      </button>
    </li>
  </ul>
</template>

<script>
export default {
  props: {
    items: {
      type: Array,
      default: () => []
    },
    active: {
      type: Number,
      default: 0
    }
  },
  emits: ['select', 'activate'],
  watch: {
    active() {
      this.$nextTick(this.scrollIntoView)
    }
  },
  methods: {
    scrollIntoView() {
      const el = this.$el.querySelector('.fa-editor-mentions__item--on')
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' })
    }
  }
}
</script>

<style></style>
