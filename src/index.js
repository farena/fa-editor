import FaEditor from './FaEditor.vue'
import './fa-editor.scss'

/**
 * The component doubles as a Vue plugin: it carries an `install`, so both ways
 * of using it work.
 *
 *   import FaEditor from '@farena/fa-editor'
 *   app.use(FaEditor)                       // global, as <FaEditor>
 *   app.use(FaEditor, { name: 'RichText' })
 *
 *   import { FaEditor } from '@farena/fa-editor'
 *   components: { FaEditor }                // local
 *
 * Exporting the very same object as default and as named keeps the UMD bundle
 * from forcing consumers to write `FaEditor.default`.
 */
FaEditor.install = (app, { name = 'FaEditor' } = {}) => {
  app.component(name, FaEditor)
}

export { FaEditor }
export default FaEditor

/**
 * The i18n surface. `registerLang` adds or extends a dictionary, `getLang`
 * hands back a copy of one to build on, and `LANGS` lists every code the `lang`
 * prop accepts at that moment.
 */
export { registerLang, getLang, LANGS, DEFAULT_LANG } from './core/lang'
