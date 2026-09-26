# Contributing

Thanks for helping. Book content changes only touch `vault/`; the README explains the writing rules. This file is about the publisher.

## Workflow

1. `npm ci`, then `npm run dev` while you work.
2. Before pushing: `npm run check && npm test`, and `npm run test:e2e` if you touched layouts, styles or browser code (run `npx playwright install chromium` once).
3. Commits follow [Conventional Commits](https://www.conventionalcommits.org/) in English: `feat(site): …`, `fix(render): …`, `docs: …`, `test: …`, `ci: …`. Book text uses the project's extra type `content`, e.g. `content(calculus): …`. One topic per commit; every commit passes `npm run check && npm test`.
4. Never edit `dist/`; it is rebuilt from scratch.

## How the publisher is organised

Each folder under `publish/` is one context with one job, and depends only on the ones above it in this list:

| Folder      | Responsibility                                                                                                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `model/`    | The domain: `Series` (aggregate root) → `Book` → `Edition` (a book in one language) → `Chapter`, plus value objects `Outline`, `MacroSet`, `AccentColor`. No I/O.                                                                          |
| `obsidian/` | Reading the vault: `Vault` (files and frontmatter), `FileIndex` (Obsidian's link resolution), `SeriesReader` (builds and validates the model; parsing is injected as a `NoteParser`), `ObsidianPreamble` (macros for Obsidian's preview).  |
| `render/`   | Markdown AST → HTML through Quartz's transformer plugins. `ChapterRenderer` is the only entry point; link targets come in through the `LinkTarget` interface, so the same trees render for the web and for the PDF.                        |
| `site/`     | Pages, routes, assets, media, sitemap and search. Each page is an object implementing `Page`; `Site` renders everything into a staging folder and only then replaces the output, which it must have created itself (`.books-site` marker). |
| `pdf/`      | One `PdfBook` per edition: the same chapter trees rendered with PDF link targets and handed to Pandoc.                                                                                                                                     |
| `dev/`      | The preview server used by `npm run dev` and `npm run serve`.                                                                                                                                                                              |

Rules that keep it that way:

- Heading slugs are computed only in `Outline`; the web id of a heading is defined only by `Routes.headingId`, the PDF id only by `PdfLinks.headingId`.
- Names shared by the build, the preview server and the browser (output folders, storage keys, the reload endpoint) live only in `site/protocol.ts`.
- Domain rules live in `model/`: for example `Chapter.translation` says that chapters with the same number are translations.
- Author-facing problems are `PublishError`s with a `SourceLocation`; anything else is a bug and should crash loudly.
- Quartz plugins are used through their published `QuartzTransformerPluginInstance` interface. `render/quartz.ts` is the only file that knows which plugins exist.
- User-visible strings live in `publish/i18n.ts` and XeLaTeX settings per language in `pdf/typesetting.ts`; adding a language means one code in `model/language.ts`, one `Messages` object and one `Typesetting` entry (the compiler lists what is missing).
- Browser code is TypeScript in `site/client/`, bundled by esbuild at build time. It must enhance, not create, the page: everything works without JavaScript except search, theme switching and folding, and a bundle that fails to load leaves the page in its no-script form.
- PDFs are built by `npm run pdf` and listed with an input fingerprint in `pdf/manifest.json` by `pdf/PdfShelf`; the CLI asks the shelf which PDFs are current and hands that set to `Site`, which never reads the manifest.
