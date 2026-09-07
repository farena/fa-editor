<template>
  <div class="lab">
    <header class="lab__header">
      <h1>fa-editor</h1>
      <p>Zero-dependency rich-text editor for Vue 3, with a strict HTML contract.</p>

      <label class="lab__lang">
        Interface language
        <select v-model="lang" data-testid="lang">
          <option v-for="code in langs" :key="code" :value="code">{{ code }}</option>
        </select>
      </label>
    </header>

    <div class="lab__grid">
      <section class="lab__col">
        <div class="lab__card">
          <h2>Editor</h2>
          <p class="lab__hint">Use ctrl+enter or shift+enter for a soft line break.</p>

          <FaEditor
            v-model="html"
            :lang="lang"
            placeholder="Type something, or load a sample…"
            :autocompleteOpts="autocompletes"
          />

          <div class="lab__samples">
            <button
              v-for="sample in samples"
              :key="sample.name"
              type="button"
              class="lab__btn"
              @click="html = sample.html"
            >
              {{ sample.name }}
            </button>
            <button type="button" class="lab__btn lab__btn--danger" @click="html = ''">
              Clear
            </button>
          </div>
        </div>

        <div class="lab__card">
          <h2>States</h2>
          <p class="lab__hint">Fixed height with internal scrolling, and disabled.</p>

          <label class="lab__label">Fixed height (100px)</label>
          <FaEditor v-model="stateHtml" :lang="lang" class="lab__fixed" />

          <label class="lab__label">Disabled</label>
          <FaEditor v-model="disabledHtml" :lang="lang" disabled />
        </div>

        <div class="lab__card">
          <h2>Inside a scrolling container</h2>
          <p class="lab__hint">
            The critical case: link and table balloons are teleported to
            <code>&lt;body&gt;</code> and have to follow the content as it scrolls. Open one and
            spin the wheel.
          </p>

          <div class="lab__scroller">
            <div class="lab__filler">Filler, so there is something to scroll.</div>
            <FaEditor v-model="scrollHtml" :lang="lang" :autocompleteOpts="autocompletes" />
            <div class="lab__filler">More filler.</div>
          </div>
        </div>
      </section>

      <section class="lab__col">
        <div class="lab__card">
          <h2>Output HTML</h2>
          <p class="lab__hint">Exactly what would be written to the database.</p>
          <pre class="lab__output">{{ html || '(empty)' }}</pre>
        </div>

        <div class="lab__card">
          <h2>Preview</h2>
          <p class="lab__hint">
            How the application renders it with <code>v-html</code>, outside the editor. It has to
            look the same as above.
          </p>
          <div class="lab__preview" v-html="html"></div>
        </div>

        <div class="lab__card">
          <h2>Round-trip</h2>
          <p class="lab__hint">
            <code>getData(setData(x)) === x</code> across the contract corpus. Each sample is loaded
            into an off-screen editor and its output compared with the input.
          </p>

          <p
            class="lab__verdict"
            :class="roundTrip.failed ? 'lab__verdict--bad' : 'lab__verdict--ok'"
          >
            {{ roundTrip.pass }} / {{ roundTrip.total }}
          </p>

          <ul class="lab__diffs">
            <li v-for="row in roundTrip.diffs" :key="row.name">
              <strong>{{ row.name }}</strong>
              <pre>{{ `in:  ${row.expected}\nout: ${row.actual}` }}</pre>
            </li>
          </ul>

          <FaEditor ref="probe" v-model="probeHtml" class="lab__probe" />
        </div>
      </section>
    </div>
  </div>
</template>

<script>
import { FaEditor } from '../src/index'
import { LANGS } from '../src/core/lang'
import { CONTRACT_FIXTURES } from './fixtures'

// Corpus samples worth reaching in one click.
const INTERESTING = [
  'combined document',
  'table with a header row',
  'table with colspan',
  'table with rowspan',
  'multiple mentions',
  'link with text around it',
  'list with formatting',
  'list item with several paragraphs'
]

export default {
  components: { FaEditor },
  data: () => ({
    html: '<h2>Title</h2><p>Type here, or load a sample.</p>',
    stateHtml:
      '<p>Long content, so the internal scrolling shows.</p><p>Second paragraph.</p><p>Third paragraph.</p><p>Fourth paragraph.</p>',
    disabledHtml: '<p>This editor is disabled.</p>',
    scrollHtml:
      '<p>A <a target="_blank" rel="noopener noreferrer" href="http://a.com">link</a> to try the balloon on.</p>',
    probeHtml: '',
    autocompletes: ['#name', '#surname', '#email', '#company', 'no-marker'],
    lang: 'en',
    langs: LANGS,
    roundTrip: { pass: 0, total: 0, failed: 0, diffs: [] }
  }),
  computed: {
    samples() {
      return INTERESTING.map((name) => CONTRACT_FIXTURES.find((f) => f.name === name)).filter(
        Boolean
      )
    }
  },
  mounted() {
    this.runRoundTrip()
  },
  methods: {
    /**
     * Loads every sample into the probe editor and compares what comes back.
     * This is the check that matters: if it fails, opening a form and saving it
     * without touching anything rewrites the HTML already in the database.
     */
    async runRoundTrip() {
      const diffs = []
      let pass = 0

      for (const fixture of CONTRACT_FIXTURES) {
        if (!fixture.html) continue

        this.probeHtml = fixture.html
        // Two ticks: one for the editor's watcher to load the value, another for
        // the normalized `update:modelValue` to come back.
        await this.$nextTick()
        await this.$nextTick()

        const expected = fixture.out ?? fixture.html
        const actual = this.probeHtml

        if (actual === expected) pass++
        else diffs.push({ name: fixture.name, expected, actual })
      }

      const total = pass + diffs.length
      this.roundTrip = { pass, total, failed: diffs.length, diffs }
      this.probeHtml = ''
    }
  }
}
</script>

<style></style>
