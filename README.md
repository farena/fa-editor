# @farena/fa-editor

A rich-text editor for Vue 3 with **zero dependencies** and a strict, stable HTML contract.

It is built for the case where the HTML lives in a database and has to survive being opened and
saved again, unchanged, for years. `getData(setData(x)) === x` is the property the whole design
is organized around: if it ever breaks, opening a form and saving it without touching anything
silently rewrites stored content.

- **No dependencies at all**, runtime or build. Vue is a peer dependency and that is the entire
  list.
- **`contenteditable` plus the Selection/Range API.** `document.execCommand` is never used: it
  produces `<b>`, `<font>` and `rgb()`, while the contract calls for `<strong>`, `<span>` and
  `hsl()`, and it cannot see mutations made through the Range API.
- **WYSIWYG for real.** The editable area applies no content styles of its own, so what you see
  while typing is what the page renders afterwards with `v-html`.
- **~34 kB gzipped**, CSS and icons included.

**[Try it in the lab →](https://farena.github.io/fa-editor/)** — every feature of the contract on
one page, with the serialized HTML and a `v-html` preview side by side, so you can check that what
you edit and what your app renders are the same thing.

## Table of contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick start](#quick-start)
- [API](#api)
- [Mentions](#mentions)
- [Languages](#languages)
- [Keyboard](#keyboard)
- [The HTML contract](#the-html-contract)
- [Styling](#styling)
- [Rendering content outside the editor](#rendering-content-outside-the-editor)
- [Icons](#icons)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)
- [License](#license)

## Requirements

- **Vue 3.3 or newer.**
- **Nothing else.** No icon font, no CDN, no runtime dependency: the toolbar icons are inline
  `<svg>` drawn by the package itself; see [Icons](#icons).
- A browser with `beforeinput` and `InputEvent.inputType`: Chrome, Edge, Firefox 87+, Safari 13+.

## Installation

```bash
npm i @farena/fa-editor
```

## Quick start

Register it globally, as a plugin:

```js
// main.js
import { createApp } from 'vue'
import FaEditor from '@farena/fa-editor'
import '@farena/fa-editor/style.css'

createApp(App).use(FaEditor).mount('#app')
```

`use()` takes an optional name, if `FaEditor` collides with something in your app:

```js
app.use(FaEditor, { name: 'RichText' })
```

Or import it locally and skip the global registration:

```vue
<template>
  <FaEditor
    ref="editor"
    v-model="html"
    placeholder="Type something…"
    :disabled="readonly"
    :autocompleteOpts="['#name', '#email']"
    @focus="onFocus"
    @blur="onBlur"
  />
</template>

<script>
import { FaEditor } from '@farena/fa-editor'

export default {
  components: { FaEditor },
  data: () => ({ html: '<p>Hello</p>', readonly: false }),
  methods: {
    onFocus() {},
    onBlur() {}
  }
}
</script>
```

Importing the stylesheet is not optional — the editor ships no scoped styles. If you prefer to
compile it yourself, so you can override variables before they are resolved, import the Sass
source instead:

```scss
@use '@farena/fa-editor/scss';
```

Sass requires `@use` rules to come before any other rule, so it has to be the first line of the
file.

## API

### Props

| Prop               | Type      | Default | Description                                                           |
| ------------------ | --------- | ------- | --------------------------------------------------------------------- |
| `modelValue`       | `String`  | `''`    | The document's HTML. Use with `v-model`.                              |
| `placeholder`      | `String`  | —       | Shown while the document is empty.                                    |
| `disabled`         | `Boolean` | `false` | Read-only: turns off `contenteditable` and the whole toolbar.         |
| `autocompleteOpts` | `Array`   | `null`  | Mention options. Only entries starting with `#` are used.             |
| `lang`             | `String`  | `'en'`  | Interface language: `'en'`, `'es'`, `'pt'`, or a `registerLang` code. |

### Events

| Event               | When                                                          |
| ------------------- | ------------------------------------------------------------- |
| `update:modelValue` | The content changed. Debounced 300 ms, leading edge included. |
| `focus`             | The editable area gained focus.                               |
| `blur`              | The editable area lost focus.                                 |

### Methods

Available through a template `ref`:

| Method      | What it does                                                               |
| ----------- | -------------------------------------------------------------------------- |
| `focus()`   | Focuses the editor and puts the caret at the end of the document.          |
| `getData()` | Returns the serialized HTML immediately, without waiting for the debounce. |

### Exports

Besides the component, the package entry point exposes the i18n surface:

| Export                     | What it does                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `registerLang(code, dict)` | Adds a dictionary, or merges keys over one that exists. See [Languages](#languages).   |
| `getLang(code)`            | A copy of a dictionary, to build a new language on top of. Unknown codes give English. |
| `LANGS`                    | Every code `lang` accepts right now, registrations included.                           |
| `DEFAULT_LANG`             | `'en'`, the fallback for an unknown code and for a missing key.                        |

### The `v-model` cycle

Worth understanding, because it explains the one surprising behaviour.

When the value arrives **from outside**, the document is reloaded. When the change originates
**inside**, it is emitted debounced and remembered, so the incoming watcher does not reload the
document and make the caret jump:

```js
watch: {
  modelValue(v) {
    if (v !== this.lastEmittedData) this.load(v)
  }
}
```

On an external load, the editor **re-emits the value already normalized** when it differs from
what it received. So this:

```js
this.html = '<p><a href="http://a.com">Go</a></p>'
```

immediately becomes:

```js
'<p><a target="_blank" rel="noopener noreferrer" href="http://a.com">Go</a></p>'
```

That is deliberate. Without it the parent and the editor hold two different representations of
the same content, and the user's very first keystroke produces a diff that has nothing to do
with what they typed.

The debounce fires on the **leading edge**, so the first character typed is emitted right away.
Watchers on the bound value will see it without a 300 ms delay.

## Mentions

Pass `autocompleteOpts` and typing `#` opens the dropdown:

```vue
<FaEditor v-model="html" :autocompleteOpts="['#name', '#surname', '#email']" />
```

Entries that do not start with `#` are ignored. The dropdown only opens when the marker starts a
block or follows a space, so `abc#def` types through untouched. Arrow keys move the highlight,
Enter or Tab picks, Escape closes.

A mention serializes as:

```html
<span class="mention" data-mention="#name">#name</span>
```

The span stays editable. Once its text no longer matches `data-mention`, it stops being a
mention and is unwrapped — a mention that says something other than what it stands for would be
worse than no mention at all.

## Languages

The interface ships in English, Spanish and Portuguese:

```vue
<FaEditor v-model="html" lang="es" />
```

It is reactive — binding it to a user setting re-renders every label, including the panels and
balloons teleported to `<body>`:

```vue
<FaEditor v-model="html" :lang="user.locale" />
```

An unrecognized code falls back to English rather than throwing, so a bad value never takes the
toolbar down with it.

**The language never touches the document.** Tag names, class names, alignment values and colors
are fixed by the contract and identical in every language: a document written with
`lang="pt"` is byte-for-byte what the same document would be with `lang="en"`. Only what the user
reads changes.

### Adding a language

`registerLang(code, dict)` adds a dictionary from outside the package. Call it once, before the
app mounts, and the code becomes valid everywhere `lang` is accepted:

```js
import { createApp } from 'vue'
import FaEditor, { registerLang } from '@farena/fa-editor'
import '@farena/fa-editor/style.css'

registerLang('fr', {
  undo: 'Annuler (Ctrl+Z)',
  bold: 'Gras (Ctrl+B)'
  // …
})

createApp(App).use(FaEditor).mount('#app')
```

```vue
<FaEditor v-model="html" lang="fr" />
```

Missing keys fall back to English, so a partial dictionary is usable from the first line — the
three toolbar labels you care about today, the table balloon whenever you get to it.

The registry is global to the module, not per instance: every `<FaEditor>` in the app sees the
same languages. That is the point — registering once at boot beats threading a dictionary through
every component that happens to render an editor.

### Starting from a dictionary that ships

`getLang(code)` returns a **copy** of a dictionary, which is how you take one from the source
without hunting for the file. Spread it and override what you need:

```js
import { registerLang, getLang } from '@farena/fa-editor'

registerLang('fr', {
  ...getLang('en'),
  undo: 'Annuler (Ctrl+Z)',
  redo: 'Rétablir (Ctrl+Y)',
  bold: 'Gras (Ctrl+B)',
  italic: 'Italique (Ctrl+I)'
})
```

For a whole language you probably want the full key list in front of you rather than inline. Dump
it once from a console or a scratch script:

```js
import { getLang } from '@farena/fa-editor'

console.log(JSON.stringify(getLang('en'), null, 2))
```

Paste the result into a file of your own, translate the values, and register it:

```js
// src/i18n/fa-editor-fr.js
export default {
  undo: 'Annuler (Ctrl+Z)',
  redo: 'Rétablir (Ctrl+Y)',
  alignment: 'Alignement du texte'
  // … the rest of the keys the dump gave you
}
```

```js
import { registerLang } from '@farena/fa-editor'
import fr from './i18n/fa-editor-fr.js'

registerLang('fr', fr)
```

Dumping beats transcribing a key list from the docs: it is whatever the version you installed
actually contains, so it cannot drift from it. Start from `'en'` if you are
translating from scratch, or from the closest language you already have — `getLang('es')` is a
shorter trip to Catalan than English is.

### Correcting a label

`registerLang` merges over the dictionary that is already there, so the same call fixes a single
label of a language that ships, without restating the other sixty-odd:

```js
registerLang('es', {
  bold: 'Negrita',
  linkPlaceholder: 'https://miempresa.com'
})
```

## Keyboard

| Keys                                | Action                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `Ctrl+B` / `Ctrl+I`                 | Bold / italic                                                               |
| `Ctrl+K`                            | Link                                                                        |
| `Ctrl+Z` / `Ctrl+Y`, `Ctrl+Shift+Z` | Undo / redo                                                                 |
| `Enter`                             | New block, keeping tag and alignment. At the end of a heading, a paragraph. |
| `Shift+Enter`, `Ctrl+Enter`         | Soft line break (`<br>`)                                                    |
| `Enter` on an empty list item       | Leaves the list                                                             |
| `Tab` / `Shift+Tab` inside a table  | Next / previous cell; on the last cell, adds a row                          |
| `Backspace` at the start of a block | Merges into the previous block                                              |

Formatting shortcuts the browser provides on its own — `Ctrl+U` being the usual one — are
blocked, because they would insert tags that are not in the contract.

## The HTML contract

This is the part that matters. Everything `getData()` produces and everything `setData()` accepts
follows this table:

| Feature        | Output                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| bold / italic  | `<strong>` / `<i>`                                                                                    |
| headings       | `<h2>` `<h3>` `<h4>` — there is no `h1`                                                               |
| alignment      | `style="text-align:center;"` on the block                                                             |
| font family    | `<span style="font-family:'Courier New', Courier, monospace;">` — 8 families plus default             |
| font size      | **classes**: `text-tiny` `text-small` `text-big` `text-huge`                                          |
| font color     | `<span style="color:hsl(0,75%,60%);">` — a palette of 15, plus any color already in the data          |
| link           | `<a target="_blank" rel="noopener noreferrer" href="...">`, in that order; default protocol `http://` |
| lists          | `<ul><li>` / `<ol><li>`; an item with more than one block keeps them (`<li><p>a</p><p>b</p></li>`)    |
| table          | `<figure class="table"><table><tbody><tr><td>`; the header row goes in `<thead>` with `<th>`          |
| mention        | `<span class="mention" data-mention="#foo">#foo</span>`                                               |
| soft break     | `<br>`                                                                                                |
| empty document | `''` — an empty string, not `<p></p>`                                                                 |

Normalization rules that are part of the contract just as much as the tags:

- Inline formats always serialize in the same order — `a` > `span` > `i` > `strong` — no matter
  which order they were applied in, and inside the span `color` comes before `font-family`.
- All font attributes live in one `<span>`, never in nested ones.
- Runs of spaces collapse; a space that would sit against a `<br>` becomes `&nbsp;`, and one at
  the end of a block is dropped.
- Inline `font-size` and `background-color` are discarded. `font-family` survives only on an
  exact match with one of the configured families.
- Color values are compacted: `hsl(0, 75%, 60%)` is stored as `hsl(0,75%,60%)`.
- Only `text-align` survives in a block's `style`. Anything else — a stray `margin-left` from
  old content, say — is dropped.

The [lab](https://farena.github.io/fa-editor/) runs a round-trip over this whole table on load,
so you can see the contract holding rather than take it on trust — and paste your own stored
documents into it to check they survive.

Anything outside the contract is removed on load and on paste. Pasting from Word or Google Docs
goes through the same filter: `<o:p>`, `mso-*` classes, wrapper `<div>`s and inline styles that
are not on the list do not make it in.

`<script>` elements are dropped entirely, content included. Parsing happens through
`DOMParser`, which builds an inert document: no scripts run and no `<img src>` is fetched while
sanitizing.

## Styling

Every variable the editor reads has a fallback, so it is fully styled with no configuration.
Defining them is what blends it into your theme.

| Variable                                                           | Default                                  | Controls                                  |
| ------------------------------------------------------------------ | ---------------------------------------- | ----------------------------------------- |
| `--font-family`                                                    | system stack                             | Content typeface                          |
| `--font-size`                                                      | `14px`                                   | Content size                              |
| `--body-text`                                                      | `hsl(0, 0%, 37%)`                        | Content color                             |
| `--color-primary`                                                  | `hsl(218.1, 100%, 58%)`                  | Focus ring and link preview               |
| `--radius`                                                         | `2px`                                    | Corner radius                             |
| `--fa-color-mention-background`                                    | `hsla(341, 100%, 30%, 0.1)`              | Mention background                        |
| `--fa-color-mention-text`                                          | `hsl(341, 100%, 30%)`                    | Mention text                              |
| `--fa-ed-padding`                                                  | `0.5em 1em`                              | Editable area padding                     |
| `--fa-ed-min-height`                                               | `100px`                                  | Minimum height                            |
| `--fa-ed-height`                                                   | `auto`                                   | Fixed height, to force internal scrolling |
| `--fa-ed-font-size`                                                | `10px`                                   | Base size the toolbar is dimensioned from |
| `--fa-ed-btn-size`                                                 | `2.3em`                                  | Toolbar button size                       |
| `--fa-ed-border`                                                   | `hsl(220, 6%, 81%)`                      | Container, toolbar and panel borders      |
| `--fa-ed-bg`                                                       | `#fff`                                   | Editor background                         |
| `--fa-ed-toolbar-bg`                                               | `hsl(0, 0%, 98%)`                        | Toolbar background                        |
| `--fa-ed-text`                                                     | `hsl(0, 0%, 20%)`                        | Toolbar and panel text                    |
| `--fa-ed-btn-hover-bg`                                             | `hsl(0, 0%, 94.1%)`                      | Button hover                              |
| `--fa-ed-btn-on-bg`                                                | `hsl(212, 100%, 97.1%)`                  | Active button background                  |
| `--fa-ed-btn-on-text`                                              | `hsl(218.1, 100%, 58%)`                  | Active button text                        |
| `--fa-ed-focus-ring`                                               | `1px solid var(--color-primary)`         | Focus ring                                |
| `--fa-ed-radius`                                                   | `var(--radius)`                          | Editor and panel radius                   |
| `--fa-ed-shadow`                                                   | `0 1px 2px 1px hsla(220, 6%, 10%, 0.15)` | Panel shadow                              |
| `--fa-ed-spacing`, `--fa-ed-spacing-small`, `--fa-ed-spacing-tiny` | `0.6em`, `0.3em`, `0.18em`               | Toolbar spacing                           |
| `--fa-ed-scrollbar`                                                | `hsl(220, 6%, 70%)`                      | Toolbar scrollbar thumb                   |
| `--fa-ed-scrollbar-size`                                           | `0.5em`                                  | Toolbar scrollbar thickness               |

Set them wherever it suits you. `:root` is the one place that reaches everything, including the
panels and balloons, which are teleported to `<body>` and therefore inherit nothing from the
editor:

```css
:root {
  --color-primary: #6b46c1;
  --radius: 6px;
  --fa-ed-toolbar-bg: #faf5ff;
}
```

For a single instance, set them on a wrapper — with the caveat that teleported panels will keep
the global values:

```css
.my-form .fa-editor {
  --fa-ed-min-height: 300px;
}
```

A fixed height with internal scrolling:

```css
.my-form .fa-editor__content {
  --fa-ed-height: 240px;
}
```

Class prefixes are `.fa-editor__*` for everything inside the component and `.fa-editor-*` for
what is teleported to `<body>`.

## Rendering content outside the editor

The stylesheet also carries the styles for the **generated content**, deliberately unscoped:

- `.text-tiny`, `.text-small`, `.text-big`, `.text-huge`
- `.mention`
- `figure.table` and everything inside it

So wherever you render a stored document with `v-html`, import the stylesheet there too and it
will look exactly as it did while being edited. Scoping these to the editor is what makes a
document change appearance the moment it leaves it.

One collision to be aware of: the contract stores tables as `<figure class="table">`, and
`.table` is also Bootstrap's class. The rules here target `figure.table` precisely so they win on
specificity. If you use another framework that styles a bare `.table`, check that it does not
outrank them.

## Icons

The toolbar draws its own icons. There is no icon font to load and no CDN to reach: every icon
is an inline `<svg>` built from a `viewBox` and a single `path`, both shipped inside the bundle:

```html
<svg class="fa-editor__icon" viewBox="0 0 384 512" aria-hidden="true" focusable="false">
  <path d="M0 64C0 46.3 …" />
</svg>
```

Consequences worth knowing:

- **They follow the text.** `fill: currentColor` and `height: 1em` mean an icon takes the color
  and the size of the button around it, exactly as a font glyph did. `--fa-ed-font-size` still
  scales the whole toolbar, icons included.
- **They cost about 3 kB gzipped**, all 22 of them, and travel inside the JS bundle. No extra
  request, and nothing to break when a CDN is down or a Content-Security-Policy forbids it.
- **They are decorative.** Every button already carries `title` and `aria-label`, so the `<svg>`
  is `aria-hidden`.

## Known limitations

Honest list of what this editor does not do.

- **Three languages built in** (English, Spanish, Portuguese). Anything else means writing a
  dictionary and handing it to `registerLang`; see [Adding a language](#adding-a-language).
- **No rectangular cell selection.** You cannot drag across several cells to format them
  together. Merging is done through the table balloon, cell by cell.
- **Undo is coalesced by typing burst**, not by operation, so one `Ctrl+Z` can undo a whole
  sentence.
- **No keyboard navigation of the toolbar.** Buttons carry `title` and `aria-label`, but there is
  no roving tabindex.
- **No image upload.** An `<figure class="image">` already present in a document is preserved on
  load, but there is no way to insert one.
- **External drag and drop is blocked.** Dropping content from outside is cancelled rather than
  sanitized.

## Contributing

The repo layout, the design rationale, how to run the lab and the release flow live in
[CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT.

The icon artwork is [Font Awesome Free 6](https://fontawesome.com) (solid), used under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Only the paths listed in
`src/core/icons.js` are included; see [Icons](#icons).
