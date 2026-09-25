# Contributing

Thanks for helping. Book content changes only touch `vault/`; the README explains the writing rules. This file is about the publisher.

## Workflow

1. `npm ci`, then `npm run dev` while you work.
2. Before pushing: `npm run check && npm test`, and `npm run test:e2e` if you touched layouts, styles or browser code (run `npx playwright install chromium` once).
3. Commits follow [Conventional Commits](https://www.conventionalcommits.org/) in English: `feat(site): …`, `fix(render): …`, `docs: …`, `test: …`, `ci: …`, `content(calculus): …` for book text. One topic per commit.
4. Never edit `dist/`; it is rebuilt from scratch.

## How the publisher is organised

Each folder under `publish/` is one context with one job, and depends only on the ones above it in this list:

| Folder      | Responsibility                                                                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model/`    | The domain: `Series` (aggregate root) → `Book` → `Edition` (a book in one language) → `Chapter`, plus value objects `Outline`, `MacroSet`, `AccentColor`. No I/O.                                                   |
| `obsidian/` | Reading the vault: `Vault` (files and frontmatter), `FileIndex` (Obsidian's link resolution), `SeriesReader` (builds and validates the model).                                                                      |
| `render/`   | Markdown AST → HTML through Quartz's transformer plugins. `ChapterRenderer` is the only entry point; link targets come in through the `LinkTarget` interface, so the same trees render for the web and for the PDF. |
| `site/`     | Pages, routes, assets, media, sitemap and search. Each page is an object implementing `Page`; `Site` renders all of them in memory and only then replaces `dist/`.                                                  |
| `pdf/`      | One `PdfBook` per edition: the same chapter trees rendered with PDF link targets and handed to Pandoc.                                                                                                              |
| `dev/`      | The preview server used by `npm run dev` and `npm run serve`.                                                                                                                                                       |

Rules that keep it that way:

- Heading slugs are computed only in `Outline`; links, sidebars, web ids and PDF ids all read them from there.
- Author-facing problems are `PublishError`s with a `SourceLocation`; anything else is a bug and should crash loudly.
- Quartz plugins are used through their published `QuartzTransformerPluginInstance` interface. `render/quartz.ts` is the only file that knows which plugins exist.
- User-visible strings live in `site/i18n.ts`; adding a language means adding one `Messages` object and one code to `model/language.ts`.
- Browser code is TypeScript in `site/client/`, bundled by esbuild at build time. It must enhance, not create, the page: everything works without JavaScript except search, theme switching and folding.
