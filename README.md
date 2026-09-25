# Less Bug Books

[中文说明](README.zh-CN.md)

A series of open textbooks, written in [Obsidian](https://obsidian.md) and published as one website with one design for every book. The first three books — _Linear Algebra_, _Calculus_ and _Probability and Statistics_ — are placeholders that exercise the whole pipeline in Chinese and English.

- Formulas are typeset to SVG **at build time** with MathJax; pages never parse TeX in the browser.
- Obsidian syntax (wikilinks, embeds, callouts, highlights, comments) is rendered by [Quartz](https://quartz.jzhao.xyz/)'s transformer plugins, without vendoring Quartz itself.
- Code is highlighted at build time with Shiki, search is a static [Pagefind](https://pagefind.app/) index, and the site makes no requests to other origins.
- The whole toolchain is TypeScript on Node.js; the same commands work on Windows, macOS and Ubuntu.

## Quick start

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev      # build, serve at http://127.0.0.1:4173/ and rebuild on every save
npm run build    # write the site to dist/
```

PDFs are optional and need [Pandoc](https://pandoc.org/), XeLaTeX and the _Noto Serif CJK SC_ font (set `BOOKS_CJK_FONT` to use another):

```sh
npm run pdf                                  # every edition, into dist/pdf/
npm run pdf -- --book calculus --lang en     # one edition
```

A later `npm run build` keeps `dist/pdf/` and links the PDFs from each book's page. Without Pandoc or XeLaTeX the command exits with code 2 and says what is missing.

## Writing

Open `vault/` as an Obsidian vault.

```text
vault/
  series.md                  site URL, languages, book order, licences, per-language title and tagline
  linear-algebra/            one folder per book; the folder name is the URL slug
    book.md                  colour, cover, status, TeX macros, per-language title/subtitle/description
    cover.svg
    assets/vector.svg        figures shared by every language
    zh/00-前言.md             chapters, NN-name.md, flat inside the language folder
    en/01-vectors.md
```

- **Chapters** are `NN-name.md`. `00` is the preface. The first line of the body is the title as a level-1 heading; it is the only level-1 heading.
- **Links** follow Obsidian: `[[01-向量]]`, `[[01-向量#线性组合]]`, `[[01-向量#线性组合|alias]]`, `[[#heading on this page]]`, `[[linear-algebra/book]]`, plain Markdown links to `.md` files. A bare name must be unique in the vault unless it sits in the linking note's folder; otherwise write the path, exactly as Obsidian does.
- **Embeds** are images only: `![[vector.svg|320]]`, `![[photo.png|Alt text|640x480]]`.
- **Math** uses `$…$` and `$$…$$`. Macros live in the book's `book.md` as `\newcommand`/`\renewcommand`, so the website and the PDF read the same definitions.
- **Callouts** use Obsidian syntax, including foldable ones (`> [!proof]-`). Besides Obsidian's types the theme styles `definition`, `theorem` and `proof`; any other type renders with a neutral colour.
- **Accent colours** must reach 4.5:1 contrast against white; the build says so otherwise.

The build refuses to publish anything it cannot render faithfully — an unknown link, a missing heading, a formula MathJax cannot typeset, a misnamed chapter — and names the file and line.

## Checks

```sh
npm run check     # TypeScript, ESLint, Prettier
npm test          # unit tests and a full build audited for broken links, SEO tags and determinism
npm run test:e2e  # Playwright + axe: WCAG 2.1 AA in light and dark mode, desktop and phone
```

CI runs all of them on Ubuntu, Windows and macOS, builds the PDFs on Ubuntu and deploys `main` to GitHub Pages. See [docs/acceptance.md](docs/acceptance.md) for what "done" means and [CONTRIBUTING.md](CONTRIBUTING.md) for how the code is organised.

## Credits

- The reading layout is adapted from [Modern C++ Tutorial](https://github.com/changkun/modern-cpp-tutorial) by Changkun Ou (MIT).
- Obsidian syntax, math and code highlighting come from the [Quartz](https://github.com/jackyzha0/quartz) community plugins [obsidian-flavored-markdown](https://github.com/quartz-community/obsidian-flavored-markdown), [latex](https://github.com/quartz-community/latex) and [syntax-highlighting](https://github.com/quartz-community/syntax-highlighting).
- Built on [MathJax](https://www.mathjax.org/), [Shiki](https://shiki.style/), [Pagefind](https://pagefind.app/), [unified](https://unifiedjs.com/) and [Preact](https://preactjs.com/).

## Licence

The publisher is MIT, see [LICENSE](LICENSE). Book text is [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); code samples in the books are MIT.
