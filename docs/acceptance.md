# Acceptance criteria

The publisher is done when every item below holds. Each item names the check that proves it; an item without an automated check says how it is verified by hand.

## Authoring

| #   | Criterion                                                                                                                                                                                                                                                                                                                                  | Verified by                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| A1  | The vault opens in Obsidian and every link Obsidian resolves, the build resolves to the same note, heading or file.                                                                                                                                                                                                                        | `tests/unit/file-index.test.ts`, `tests/unit/render.test.ts`    |
| A2  | Anything that cannot be published faithfully stops the build with `vault/<file>:<line>: <reason>`: unknown or ambiguous links, missing headings, block references, note embeds, bad formulas, bad chapter names, nested chapters, duplicate numbers, extra level-1 headings, invalid frontmatter, unknown languages, low-contrast colours. | `tests/unit/series-reader.test.ts`, `tests/unit/render.test.ts` |
| A3  | A failed build leaves the previous `dist/` untouched.                                                                                                                                                                                                                                                                                      | `tests/build/cli.test.ts`                                       |
| A4  | TeX macros are declared once per book and used by both MathJax and XeLaTeX.                                                                                                                                                                                                                                                                | `tests/unit/values.test.ts`, CI `pdf` job                       |
| A5  | `npm ci && npm run build` works unchanged on Windows, macOS and Ubuntu with only Node.js 22.12+.                                                                                                                                                                                                                                           | CI `build` matrix                                               |

## Rendering

| #   | Criterion                                                                                                                               | Verified by                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| R1  | Every formula is SVG in the HTML; no page loads a math or highlighting runtime.                                                         | `tests/build/site.test.ts`                                      |
| R2  | Formulas have an accessible name (their TeX source).                                                                                    | `tests/unit/render.test.ts`, axe in `tests/e2e/quality.spec.ts` |
| R3  | Obsidian callouts (including foldable ones), highlights, comments, footnotes, tables and task-free GFM render through Quartz's plugins. | `tests/unit/render.test.ts`                                     |
| R4  | Code is highlighted at build time with light and dark colours that meet WCAG AA.                                                        | `tests/build/site.test.ts`, axe                                 |
| R5  | Two builds of the same vault are byte-identical.                                                                                        | `tests/build/site.test.ts`                                      |

## Site

| #   | Criterion                                                                                                                                                                  | Verified by                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| S1  | Pages: language entry (`/`), catalog per language, cover page per edition with full contents, one page per chapter, bilingual 404.                                         | `tests/build/site.test.ts`                                           |
| S2  | Every internal link, asset and `#fragment` resolves; nothing is requested from another origin.                                                                             | `tests/build/site.test.ts`, `tests/e2e/quality.spec.ts`              |
| S3  | Every indexable page has title, description, canonical URL, Open Graph tags and reciprocal `hreflang`; `sitemap.xml` and `robots.txt` exist; 404 is `noindex`.             | `tests/build/site.test.ts`                                           |
| S4  | The language switch goes to the same chapter in the other language; the choice is remembered; `/` follows the saved choice, then the browser language.                     | `tests/e2e/reading.spec.ts`                                          |
| S5  | Search works per language, opens with `/` or Ctrl/⌘+K, and loads nothing until first used.                                                                                 | `tests/e2e/reading.spec.ts`                                          |
| S6  | Sidebar shows the book's chapters and the current chapter's sections, highlights the section in view, and is a drawer on phones that closes with Escape and returns focus. | `tests/e2e/reading.spec.ts`                                          |
| S7  | Light and dark themes follow the system until the reader chooses; the choice persists without a flash.                                                                     | `tests/e2e/reading.spec.ts`                                          |
| S8  | Each book uses its own accent colour; the entry page, catalogs and 404 use the series colour.                                                                              | Visual review                                                        |
| S9  | Every tested page meets WCAG 2.1 AA (axe) in both themes on desktop and phone, has no console errors and no horizontal scrolling.                                          | `tests/e2e/quality.spec.ts`                                          |
| S10 | Deep links land below the sticky header; headings have hover anchors; code blocks have a copy button.                                                                      | `tests/e2e/reading.spec.ts`                                          |
| S11 | The site works under a sub-path (GitHub Pages project site) and at a domain root, from the same build code.                                                                | `tests/build/site.test.ts` builds under `/books/`; e2e builds at `/` |

## Delivery

| #   | Criterion                                                                                                         | Verified by                    |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| D1  | `npm run check` (tsc, ESLint, Prettier) is clean.                                                                 | CI                             |
| D2  | CI builds the PDFs; `main` deploys to GitHub Pages with the PDFs linked from each cover page.                     | CI `pdf` job, `Pages` workflow |
| D3  | History is a series of focused Conventional Commits in English.                                                   | `git log`                      |
| D4  | README credits Changkun Ou's Modern C++ Tutorial and Quartz; LICENSE keeps the MIT notice for the adapted layout. | Review                         |
