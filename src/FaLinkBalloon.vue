<template>
  <div class="fa-editor-link">
    <template v-if="editing">
      <div class="fa-editor-link__form">
        <input
          ref="input"
          v-model="href"
          type="url"
          class="fa-editor-link__input"
          :placeholder="t('linkPlaceholder')"
          @keydown.enter.prevent="submit"
          @keydown.esc.prevent="$emit('cancel')"
        />
        <div class="fa-editor-link__actions">
          <button
            type="button"
            class="fa-editor__btn"
            :title="t('save')"
            :disabled="!href.trim()"
            @mousedown.prevent
            @click="submit"
          >
            <FaIcon name="check" />
          </button>
          <button
            type="button"
            class="fa-editor__btn"
            :title="t('cancel')"
            @mousedown.prevent
            @click="$emit('cancel')"
          >
            <FaIcon name="close" />
          </button>
        </div>
      </div>
    </template>

    <template v-else>
      <a
        class="fa-editor-link__preview"
        :href="value"
        target="_blank"
        rel="noopener noreferrer"
        :title="value"
        >{{ value }}</a
      >
      <button
        type="button"
        class="fa-editor__btn"
        :title="t('editLink')"
        @mousedown.prevent
        @click="edit"
      >
        <FaIcon name="edit" />
      </button>
      <button
        type="button"
        class="fa-editor__btn"
        :title="t('unlink')"
        @mousedown.prevent
        @click="$emit('unlink')"
      >
        <FaIcon name="unlink" />
      </button>
    </template>
  </div>
</template>

<script>
import FaIcon from './FaIcon.vue'
import { defaultTranslator } from './core/lang'

export default {
  components: { FaIcon },
  inject: {
    t: { from: 'faEditorT', default: () => defaultTranslator }
  },
  props: {
    value: {
      type: String,
      default: ''
    },
    // `true` opens the form directly; `false` shows the link preview.
    initialEditing: {
      type: Boolean,
      default: false
    }
  },
  emits: ['save', 'unlink', 'cancel'],
  data() {
    return {
      editing: this.initialEditing,
      href: this.value
    }
  },
  watch: {
    value(next) {
      this.href = next
    },
    initialEditing(next) {
      this.editing = next
      if (next) this.$nextTick(this.focus)
    }
  },
  mounted() {
    if (this.editing) this.$nextTick(this.focus)
  },
  methods: {
    focus() {
      const input = this.$refs.input
      if (!input) return

      input.focus()
      input.select()
      // The balloon starts hidden until the parent positions it, and a hidden
      // element cannot take focus. The child's `mounted` hook runs before the
      // parent's, so it can land in exactly that window: retry on the next
      // frame, with the balloon visible.
      if (document.activeElement !== input) {
        requestAnimationFrame(() => {
          input.focus()
          input.select()
        })
      }
    },
    edit() {
      this.editing = true
      this.$nextTick(this.focus)
    },
    submit() {
      const href = this.href.trim()
      if (!href) return
      this.$emit('save', href)
    }
  }
}
</script>

<style></style>
