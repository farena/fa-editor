# Contributing to @farena/fa-editor

How the repo is put together, how to run it, and the reasons behind the decisions that are not
obvious from reading the code. [README.md](README.md) is the documentation consumers read; this
file is for anyone changing the editor itself.

The one rule that outranks everything else: **`getData(setData(x)) === x`**. Every change has to
leave the round-trip over the contract corpus green, because a break there silently rewrites
documents that are already stored.

## Table of contents

- [Development](#development)
- [The published lab](#the-published-lab)
- [Architecture](#architecture)
- [Design notes](#design-notes)
- [Adding a language to the package](#adding-a-language-to-the-package)
- [Replacing the icon artwork](#replacing-the-icon-artwork)
- [Publishing](#publishing)

## Development

```bash
npm install
npm run dev      # the lab, at http://localhost:9092
```

The lab has the editor with corpus samples, the output HTML, the `v-html` preview beside it (they
have to look identical), the disabled and fixed-height states, a scrolling container to check
that balloons follow the content, and an **automatic round-trip** over the whole contract corpus
that runs on page load. That last one is the regression test that matters: if it is not green,
documents are being rewritten.

The corpus lives in `lab/fixtures.js` and does not ship with the package. `DATABASE_FIXTURES` is
there to be filled with real content from your own database, which is the only way to be certain
the contract holds for documents you already have.

```bash
npm run lint
npm run format
npm run build    # dist/fa-editor.js, dist/fa-editor.umd.cjs, dist/style.css
npm run check    # lint + formatting + build
```

## The published lab

The same lab is served at <https://farena.github.io/fa-editor/>, which is what the README links to
as the demo. `npm run build:lab` compiles it as a static site into `dist-lab/`, and
[.github/workflows/pages.yml](.github/workflows/pages.yml) publishes that folder to GitHub Pages on
every push to `main`.

```bash
npm run build:lab                       # -> dist-lab/
npx vite preview --outDir dist-lab --base /fa-editor/
```

Three things worth knowing before touching it:

- **`vite.config.js` handles three modes, not two.** `--mode lab` switches the build from library
  mode to an app build: root `lab/`, output `dist-lab/`, and `base: '/fa-editor/'`, because Pages
  serves the site under the repository name rather than at the domain root. `npm run build` is
  untouched and still produces only the library.
- **The `base` is hardcoded to the repo name** in the `REPO` constant at the top of the config.
  Rename or fork the repository and every asset 404s until that string matches.
- **The lab imports `../src` directly**, not the built package, so what Pages shows is the current
  source. That is the point — it is a regression check, not a release artifact — but it also means
  a broken `main` is visible publicly.

Pages has to be enabled once per repository: **Settings > Pages > Build and deployment > Source:
GitHub Actions**. Until that is set the workflow runs and the deploy step fails.

## Architecture

```
src/
├── index.js             # the component, which doubles as a Vue plugin
├── FaEditor.vue         # contenteditable, orchestration, v-model, history
├── FaToolbar.vue        # walks TOOLBAR_ITEMS, emits command(name, payload)
├── FaDropdown.vue       # generic anchored panel
├── FaBalloon.vue        # panel teleported to <body>, follows a live anchor
├── FaLinkBalloon.vue    # form and preview views
├── FaTableBalloon.vue   # column / row / merge cells / table
├── FaColorGrid.vue      # 5×3 palette, "Remove color" and "Color picker"
├── FaColorPicker.vue    # saturation square, hue bar and hex field
├── FaTableGrid.vue      # 10×10 insertion grid
├── FaMentionList.vue
├── FaIcon.vue           # renders one icon from core/icons.js as inline <svg>
├── fa-editor.scss       # styles
└── core/
    ├── constants.js     # FONT_FAMILIES, FONT_SIZES, COLORS, HEADINGS, TOOLBAR_ITEMS
    ├── icons.js         # the icon set: viewBox + path data, one entry per icon
    ├── lang.js          # interface translations, one dictionary per language
    ├── css.js           # the style attribute as text, no CSSOM
    ├── dom.js  selection.js  position.js
    ├── normalize.js     # DOM invariants and canonical form
    ├── sanitize.js      # tag, attribute and style whitelist
    ├── serialize.js     # getData / setData
    ├── history.js       # in-house undo stack
    ├── keys.js          # Enter, Backspace, Delete at the boundaries
    ├── color.js         # hex/rgb/hsl/hsv conversions for the picker
    ├── debounce.js  mentions.js  paste.js  state.js
    └── commands/        # inline.js  block.js  list.js  link.js  table.js
```

## Design notes

The decisions that are not obvious from reading the code, and the reasons they cannot be
simplified away.

**The `style` attribute is read and written as text, never through the CSSOM.** The browser
re-serializes values: `hsl(0, 75%, 60%)` becomes `rgb(229, 89, 89)` and `'Courier New'` becomes
`"Courier New"`. Either one breaks the contract. See `core/css.js`.

**The keyboard is intercepted through `beforeinput`/`inputType`, not `keydown`.** `inputType`
already separates `insertParagraph` from `insertLineBreak`, and it respects IME composition and
mobile keyboards, which `keydown` does not.

**Undo is an in-house stack of `innerHTML` snapshots.** The native one knows nothing about Range
API mutations. Each entry stores the HTML plus an **index path** for the selection, because a
cloned `Range` does not survive replacing the `innerHTML`. Typing is coalesced into bursts.

**Balloons use `<Teleport to="body">`, `position: fixed` and `getBoundingClientRect()`, and take
an `anchor` function that returns a live rect.** That is what makes them work inside a modal and
follow its scroll; with a frozen rect they float away. Scroll is listened for on the capture
phase, since `scroll` does not bubble.

**Every toolbar trigger uses `@mousedown.prevent`.** Without it, focus moves to the button, the
editable loses its selection and no command has anything to act on. Text fields are the
exception: there `preventDefault` would cancel focus and make the field impossible to type in, so
the editor remembers the last valid selection and restores it before running the command.

**`normalizeInlines()` runs after every inline command.** Without it, applying bold three times
produces `<strong><strong><strong>` and the stored HTML grows without bound.

**Moving nodes invalidates live ranges.** The DOM removal steps relocate the boundary points of
nodes taken out of the tree. Wherever content is moved — splitting a cell, joining two list
items — the boundary has to be recorded and rebuilt by hand.

## Adding a language to the package

Contributing a language to the package itself is the same idea as `registerLang`, one level down.
Everything visible lives in `src/core/lang.js`: add a dictionary, register it in `DICTIONARIES`,
and it shows up in `LANGS` automatically.

```js
const fr = {
  undo: 'Annuler (Ctrl+Z)',
  bold: 'Gras (Ctrl+B)'
  // …
}

const DICTIONARIES = { en, es, pt, fr }
```

## Replacing the icon artwork

Keys are named after what the editor does (`bold`, `numberedList`, `mergeCells`, `caret`), not
after the icon set. To use another set — [Material Symbols](https://fonts.google.com/icons),
your own house icons — replace `box` and `path` in `src/core/icons.js` and nothing else moves:
the components only ever name a key.

The artwork that ships is [Font Awesome Free 6](https://fontawesome.com) (solid), under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); the attribution lives in the header
of `core/icons.js` and in the [License](README.md#license) section of the public README.

## Publishing

```bash
npm login
npm run release
```

`release` runs `check` and then `npm publish`. `prepublishOnly` runs `check` as well, so a manual
`npm publish` cannot ship something that does not build either. `publishConfig.access` is
`public`, so the scoped package does not end up private.

Bump the version first with `npm version patch|minor|major`.
