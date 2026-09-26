# XYZW Project

[中文说明](README.zh-CN.md) · [xyzw.space](https://xyzw.space)

A series of open textbooks, written in [Obsidian](https://obsidian.md) and published as one website with one design for every book. The first three books — _Linear Algebra_, _Calculus_ and _Probability and Statistics_ — are placeholders that exercise the whole pipeline in Chinese and English.

- Formulas are typeset to SVG **at build time** with MathJax; pages never parse TeX in the browser.
- Obsidian syntax (wikilinks, embeds, callouts, highlights, comments) is rendered by [Quartz](https://quartz.jzhao.xyz/)'s transformer plugins, without vendoring Quartz itself.
- Code is highlighted at build time with Shiki and search is a static [Pagefind](https://pagefind.app/) index. Reading a page requests nothing from any other origin; [giscus](https://giscus.app) is fetched only once a reader scrolls down to a chapter's comments.
- The whole toolchain is TypeScript on Node.js; the same commands work on Windows, macOS and Ubuntu.

## Quick start

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev      # build, serve at http://127.0.0.1:4173/ and rebuild on every save
npm run build    # write the site to dist/
```

PDFs are optional and need [Pandoc](https://pandoc.org/), XeLaTeX (with `ctex` for Chinese), `rsvg-convert` and the fonts _Noto Serif CJK SC_ and _DejaVu Sans Mono_ (override with `BOOKS_CJK_FONT` and `BOOKS_MONO_FONT`); `.github/pdf-packages.txt` lists the Ubuntu packages. A character the fonts cannot print fails the build.

```sh
npm run pdf                                  # every edition, into dist/pdf/
npm run pdf -- --book calculus --lang en     # one edition
```

A later `npm run build` keeps `dist/pdf/` and links each book's PDF from its cover page, as long as nothing the PDFs were built from has changed since (any vault file, the publisher's PDF code or the site URL); otherwise run `npm run pdf` again. A missing tool makes the command exit with code 2 and name it; so does a missing font on systems with fontconfig (elsewhere XeLaTeX reports it). The build only ever replaces an output folder it created itself.

## Writing

Open `vault/` as an Obsidian vault.

```text
vault/
  series.md                  site URL, languages, book order, licences, comments, per-language title and tagline
  linear-algebra/            one folder per book; the folder name is the URL slug
    book.md                  colour, cover, status, TeX macros, per-language title/subtitle/description
    cover.svg
    assets/vector.svg        figures shared by every language
    zh/00-前言.md             chapters, NN-name.md, flat inside the language folder
    en/01-vectors.md
```

- **Chapters** are `NN-name.md`. `00` is the preface. The first line of the body is the title as a level-1 heading; it is the only level-1 heading. Chapters with the same number in two language folders are translations of each other: the language switch and `hreflang` pair them.
- **Frontmatter** is checked: `series.md`, `book.md` and chapters accept only their documented keys (chapters: `description`, plus Obsidian's `tags`, `aliases`, `cssclasses`), so a typo is reported instead of ignored.
- **Figures** Obsidian pastes go to the note's own `assets/` folder; move one up to `<book>/assets/` to share it between languages.
- **Links** follow Obsidian: `[[01-向量]]`, `[[01-向量#线性组合]]`, `[[01-向量#线性组合|alias]]`, `[[#heading on this page]]`, `[[linear-algebra/book]]`, plain Markdown links to `.md` files. A bare name must be unique in the vault unless it sits in the linking note's folder; otherwise write the path, exactly as Obsidian does.
- **Embeds** are images only: `![[vector.svg|320]]`, `![[photo.png|Alt text|640x480]]`.
- **Math** uses `$…$` and `$$…$$`. Macros live in the book's `book.md` as `\newcommand`/`\renewcommand`, so the website and the PDF read the same definitions. For Obsidian's preview, install the community plugin _Extended MathJax_ and run `npm run preamble`, which writes every book's macros to `vault/preamble.sty`.
- **Callouts** use Obsidian syntax, including foldable ones (`> [!proof]-`). Besides Obsidian's types the theme styles `definition`, `theorem` and `proof`; any other type renders with a neutral colour.
- **Accent colours** must reach 4.5:1 contrast against white; the build says so otherwise.

The build refuses to publish anything it cannot render faithfully — an unknown link, a missing heading, a formula MathJax cannot typeset, a misnamed chapter — and names the file and line.

## Checks

```sh
npm run check     # TypeScript, ESLint, Prettier
npm test          # unit tests and a full build audited for broken links, SEO tags and determinism
npm run test:e2e  # Playwright + axe: WCAG 2.1 AA in light and dark mode, desktop and phone
```

CI runs them on Ubuntu, Windows and macOS, builds and checks the PDFs on Ubuntu, and deploys `main` to [xyzw.space](https://xyzw.space) only when every job passes. See [docs/acceptance.md](docs/acceptance.md) for what "done" means and [CONTRIBUTING.md](CONTRIBUTING.md) for how the code is organised.

## Publishing

The site is a [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/) static-assets deployment described by `wrangler.jsonc`; Cloudflare serves the apex domain and issues its certificate. The `deploy` job needs two repository secrets:

| Secret                  | What it is                                                    |
| ----------------------- | ------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | The account the Worker belongs to.                            |
| `CLOUDFLARE_API_TOKEN`  | A token with _Workers Scripts: Edit_, scoped to that account. |

Each chapter's comment thread is a GitHub Discussion in this repository, in the _Announcements_ category, addressed by a key such as `zh/calculus/02`. The key leaves out the site's base path on purpose, so moving the site never orphans a thread. Point `comments` in `vault/series.md` somewhere else, or delete it, to change or switch off comments.

## Credits

- The reading layout is adapted from [Modern C++ Tutorial](https://github.com/changkun/modern-cpp-tutorial) by Changkun Ou (MIT).
- Obsidian syntax, math and code highlighting come from the [Quartz](https://github.com/jackyzha0/quartz) community plugins [obsidian-flavored-markdown](https://github.com/quartz-community/obsidian-flavored-markdown), [latex](https://github.com/quartz-community/latex) and [syntax-highlighting](https://github.com/quartz-community/syntax-highlighting).
- Built on [MathJax](https://www.mathjax.org/), [Shiki](https://shiki.style/), [Pagefind](https://pagefind.app/), [unified](https://unifiedjs.com/) and [Preact](https://preactjs.com/).

## Licence

The publisher is MIT, see [LICENSE](LICENSE). Book text is [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); code samples in the books are MIT.
