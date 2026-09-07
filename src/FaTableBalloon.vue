<template>
  <div class="fa-editor-table-tools">
    <FaDropdown
      v-for="group in groups"
      :key="group.name"
      :title="t(group.label)"
      :icon="group.icon"
    >
      <template #default="{ close }">
        <ul class="fa-editor-panel__list">
          <li v-for="action in group.actions" :key="action.command">
            <button
              type="button"
              class="fa-editor-panel__item"
              @mousedown.prevent
              @click="run(action.command, close)"
            >
              <span class="fa-editor-panel__item-text">{{ t(action.label) }}</span>
            </button>
          </li>
        </ul>
      </template>
    </FaDropdown>
  </div>
</template>

<script>
import FaDropdown from './FaDropdown.vue'
import { defaultTranslator } from './core/lang'

const GROUPS = [
  {
    name: 'column',
    label: 'column',
    icon: 'column',
    // Grouped the way the table menu reads: column, row, cells, table.
    actions: [
      { command: 'columnHeader', label: 'headerColumn' },
      { command: 'columnInsertLeft', label: 'insertColumnLeft' },
      { command: 'columnInsertRight', label: 'insertColumnRight' },
      { command: 'columnDelete', label: 'deleteColumn' }
    ]
  },
  {
    name: 'row',
    label: 'row',
    icon: 'row',
    actions: [
      { command: 'rowHeader', label: 'headerRow' },
      { command: 'rowInsertAbove', label: 'insertRowAbove' },
      { command: 'rowInsertBelow', label: 'insertRowBelow' },
      { command: 'rowDelete', label: 'deleteRow' }
    ]
  },
  {
    name: 'merge',
    label: 'mergeCells',
    icon: 'mergeCells',
    actions: [
      { command: 'mergeUp', label: 'mergeUp' },
      { command: 'mergeRight', label: 'mergeRight' },
      { command: 'mergeDown', label: 'mergeDown' },
      { command: 'mergeLeft', label: 'mergeLeft' },
      { command: 'splitVertically', label: 'splitVertically' },
      { command: 'splitHorizontally', label: 'splitHorizontally' }
    ]
  },
  {
    name: 'table',
    label: 'table',
    icon: 'trash',
    actions: [{ command: 'tableDelete', label: 'deleteTable' }]
  }
]

export default {
  components: { FaDropdown },
  inject: {
    t: { from: 'faEditorT', default: () => defaultTranslator }
  },
  emits: ['command'],
  data: () => ({
    groups: GROUPS
  }),
  methods: {
    run(command, close) {
      close()
      this.$emit('command', command)
    }
  }
}
</script>

<style></style>
