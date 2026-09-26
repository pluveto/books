import path from "node:path"
import type { Root } from "mdast"
import { PublishError } from "../errors.ts"
import { AccentColor } from "../model/accent.ts"
import { Book, BOOK_STATUSES, isBookStatus } from "../model/book.ts"
import { Chapter } from "../model/chapter.ts"
import { Edition, type EditionText } from "../model/edition.ts"
import { isLanguage, LANGUAGES, type LanguageCode, type Languages } from "../model/language.ts"
import { MacroError, MacroSet } from "../model/macro-set.ts"
import { Outline } from "../model/outline.ts"
import { Series, type Comments, type License, type SeriesText } from "../model/series.ts"
import type { Frontmatter, Vault } from "./vault.ts"

/** Turns a note body into a Markdown AST; the render layer supplies Quartz's parser. */
export interface NoteParser {
  parse(body: string): Root
}

const SERIES_FILE = "series.md"
const BOOK_FILE = "book.md"
const CHAPTER_FILE = /^(\d{2})-.+\.md$/
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const REPO = /^[\w.-]+\/[\w.-]+$/
const IMAGE = /\.(svg|png|jpe?g|webp|avif)$/i
const DEFAULT_BRAND = "#7e2d36"

const KEYS = {
  series: [
    "site_url",
    "repository",
    "branch",
    "color",
    "languages",
    "books",
    "license",
    "license_url",
    "code_license",
    "code_license_url",
    "comments",
    ...LANGUAGES,
  ],
  comments: ["repo", "repo_id", "category", "category_id"],
  seriesText: ["title", "tagline", "author"],
  book: ["color", "cover", "status", "macros", ...LANGUAGES],
  bookText: ["title", "subtitle", "description"],
  /** `description` is the publisher's; the rest are Obsidian's own properties. */
  chapter: ["description", "tags", "aliases", "cssclasses"],
} as const

/** Builds the Series aggregate from the vault, rejecting anything the site could not publish. */
export class SeriesReader {
  constructor(
    private readonly vault: Vault,
    private readonly parser: NoteParser,
  ) {}

  read(): Series {
    if (!this.vault.hasFile(SERIES_FILE))
      throw new PublishError(`${SERIES_FILE} is missing.`, { file: SERIES_FILE })
    const meta = this.vault.note(SERIES_FILE).frontmatter
    meta.allowOnly(KEYS.series)
    const languages = this.languages(meta)
    const slugs = this.bookSlugs(meta)
    const texts = new Map<LanguageCode, SeriesText>()
    for (const language of LANGUAGES) {
      const section = meta.section(language)
      if (!languages.includes(language)) {
        if (section)
          throw meta.error(`has a "${language}" section but "${language}" is not in "languages"`, language)
        continue
      }
      if (!section) throw meta.error(`needs a "${language}" section with title and tagline`)
      section.allowOnly(KEYS.seriesText)
      texts.set(language, {
        title: section.string("title"),
        tagline: section.string("tagline"),
        author: section.optionalString("author"),
      })
    }
    const settings = {
      siteUrl: this.siteUrl(meta),
      repository: this.url(meta, "repository"),
      branch: meta.optionalString("branch") ?? "main",
      brand: this.accent(meta, DEFAULT_BRAND),
      textLicense: this.license(meta, "license"),
      codeLicense: this.license(meta, "code_license"),
      comments: this.comments(meta),
    }
    return new Series(SERIES_FILE, settings, languages, texts, (series) =>
      slugs.map((slug) => ({ book: this.book(series, slug), file: `${slug}/${BOOK_FILE}` })),
    )
  }

  private languages(meta: Frontmatter): Languages {
    const languages: LanguageCode[] = []
    for (const value of meta.strings("languages")) {
      if (!isLanguage(value)) {
        throw meta.error(
          `language "${value}" is not supported (use one of ${LANGUAGES.join(", ")})`,
          "languages",
        )
      }
      if (languages.includes(value)) throw meta.error(`language "${value}" is listed twice`, "languages")
      languages.push(value)
    }
    const [first, ...rest] = languages
    if (!first) throw meta.error(`"languages" must not be empty`, "languages")
    return [first, ...rest]
  }

  private bookSlugs(meta: Frontmatter): string[] {
    const slugs = meta.strings("books")
    const seen = new Set<string>()
    for (const slug of slugs) {
      if (!SLUG.test(slug))
        throw meta.error(`book "${slug}" must be a lowercase-hyphenated folder name`, "books")
      if (seen.has(slug)) throw meta.error(`book "${slug}" is listed twice`, "books")
      if (!this.vault.hasFile(`${slug}/${BOOK_FILE}`)) {
        throw meta.error(`book "${slug}" has no ${slug}/${BOOK_FILE}`, "books")
      }
      seen.add(slug)
    }
    for (const folder of this.vault.entries("").folders) {
      if (this.vault.hasFile(`${folder}/${BOOK_FILE}`) && !seen.has(folder)) {
        throw meta.error(`"${folder}" has a ${BOOK_FILE} but is missing from "books"`, "books")
      }
    }
    return slugs
  }

  private siteUrl(meta: Frontmatter): URL {
    const url = this.url(meta, "site_url")
    if (!url) throw meta.error(`"site_url" is required`)
    return new URL(url.endsWith("/") ? url : `${url}/`)
  }

  private url(meta: Frontmatter, key: string): string | undefined {
    const value = meta.optionalString(key)
    if (value === undefined) return undefined
    if (!URL.canParse(value) || !/^https?:$/.test(new URL(value).protocol)) {
      throw meta.error(`"${key}" must be an http(s) URL`, key)
    }
    return value.replace(/\/+$/, "")
  }

  private comments(meta: Frontmatter): Comments | undefined {
    const section = meta.section("comments")
    if (!section) return undefined
    section.allowOnly(KEYS.comments)
    const repo = section.string("repo")
    if (!REPO.test(repo)) throw section.error(`"repo" must look like "owner/name", got "${repo}"`, "repo")
    return {
      repo,
      repoId: section.string("repo_id"),
      category: section.string("category"),
      categoryId: section.string("category_id"),
    }
  }

  private license(meta: Frontmatter, key: string): License {
    const url = this.url(meta, `${key}_url`)
    if (!url) throw meta.error(`"${key}_url" is required`)
    return { name: meta.string(key), url }
  }

  private book(series: Series, slug: string): Book {
    const meta = this.vault.note(`${slug}/${BOOK_FILE}`).frontmatter
    meta.allowOnly(KEYS.book)
    const accent = this.accent(meta)
    const cover = this.cover(meta, slug)
    const status = meta.string("status")
    if (!isBookStatus(status))
      throw meta.error(`"status" must be one of ${BOOK_STATUSES.join(", ")}`, "status")
    let macros: MacroSet
    try {
      macros = MacroSet.parse(meta.optionalString("macros") ?? "")
    } catch (error) {
      if (error instanceof MacroError) throw meta.error(`"macros": ${error.message}`, "macros")
      throw error
    }
    const editions = this.editionTexts(series, slug, meta)
    return new Book(series, slug, accent, cover, status, macros, (book) =>
      editions.map(
        ({ language, text }) =>
          new Edition(book, language, `${slug}/${language}`, text, (edition) => this.chapters(edition)),
      ),
    )
  }

  private accent(meta: Frontmatter, fallback?: string): AccentColor {
    const value = fallback === undefined ? meta.string("color") : (meta.optionalString("color") ?? fallback)
    const accent = AccentColor.parse(value)
    if (!accent) throw meta.error(`"color" must be a hex colour such as "#1f4e5f"`, "color")
    const contrast = accent.contrastWith(AccentColor.WHITE)
    if (contrast < AccentColor.MIN_CONTRAST) {
      throw meta.error(
        `"color" ${value} has contrast ${contrast.toFixed(2)}:1 against white; pick a darker colour (at least ${AccentColor.MIN_CONTRAST}:1)`,
        "color",
      )
    }
    return accent
  }

  private cover(meta: Frontmatter, slug: string): string {
    const value = meta.string("cover")
    const file = path.posix.normalize(`${slug}/${value.replace(/\\/g, "/")}`)
    if (!file.startsWith(`${slug}/`) || !IMAGE.test(file) || !this.vault.hasFile(file)) {
      throw meta.error(`"cover" must name an image inside ${slug}/, got "${value}"`, "cover")
    }
    return file
  }

  private editionTexts(series: Series, slug: string, meta: Frontmatter) {
    const { files, folders } = this.vault.entries(slug)
    for (const name of files) {
      if (name.endsWith(".md") && name !== BOOK_FILE) {
        throw new PublishError(`chapters belong in a language folder such as ${slug}/zh/.`, {
          file: `${slug}/${name}`,
        })
      }
    }
    for (const folder of folders) {
      const hasNotes = this.vault.filesUnder(`${slug}/${folder}`).some((file) => file.endsWith(".md"))
      if (hasNotes && !series.languages.some((language) => language === folder)) {
        throw meta.error(
          `folder ${slug}/${folder}/ holds notes but "${folder}" is not a language in ${SERIES_FILE}`,
        )
      }
    }
    const editions: { language: LanguageCode; text: EditionText }[] = []
    for (const language of LANGUAGES) {
      const section = meta.section(language)
      if (!series.languages.includes(language)) {
        if (section)
          throw meta.error(`has a "${language}" section but the series is not published in it`, language)
        continue
      }
      const hasFolder = this.vault.hasFolder(`${slug}/${language}`)
      if (hasFolder && !section) throw meta.error(`needs a "${language}" section for ${slug}/${language}/`)
      if (section && !hasFolder)
        throw meta.error(`has a "${language}" section but no ${slug}/${language}/ folder`, language)
      if (!section) continue
      section.allowOnly(KEYS.bookText)
      editions.push({
        language,
        text: {
          title: section.string("title"),
          subtitle: section.string("subtitle"),
          description: section.string("description"),
        },
      })
    }
    if (!editions.length) throw meta.error(`book has no language folders`)
    return editions
  }

  private chapters(edition: Edition): Chapter[] {
    const { files, folders } = this.vault.entries(edition.folder)
    for (const folder of folders) {
      const nested = this.vault.filesUnder(`${edition.folder}/${folder}`).find((file) => file.endsWith(".md"))
      if (nested)
        throw new PublishError(`chapters must sit directly in ${edition.folder}/.`, { file: nested })
    }
    const byOrder = new Map<number, string>()
    const chapters: Chapter[] = []
    for (const name of files.filter((file) => file.endsWith(".md"))) {
      const file = `${edition.folder}/${name}`
      const match = CHAPTER_FILE.exec(name)
      if (!match?.[1]) throw new PublishError(`chapter file names look like "01-name.md".`, { file })
      const order = Number(match[1])
      const clash = byOrder.get(order)
      if (clash) throw new PublishError(`chapter number ${match[1]} is also used by ${clash}.`, { file })
      byOrder.set(order, file)
      chapters.push(this.chapter(edition, order, file))
    }
    if (!chapters.length)
      throw new PublishError(`${edition.folder}/ has no chapters.`, { file: edition.folder })
    return chapters.sort((a, b) => a.order - b.order)
  }

  private chapter(edition: Edition, order: number, file: string): Chapter {
    const note = this.vault.note(file)
    note.frontmatter.allowOnly(KEYS.chapter)
    const tree = this.parser.parse(note.body)
    const outline = Outline.of(tree)
    const line = (heading?: { line: number | undefined }) =>
      heading?.line === undefined ? note.bodyLine : note.bodyLine + heading.line - 1
    if (!outline.title) {
      throw new PublishError(`a chapter starts with its title as a level-1 heading ("# Title").`, {
        file,
        line: line(outline.headings[0]),
      })
    }
    const extra = outline.headings.slice(1).find((heading) => heading.depth === 1)
    if (extra) {
      throw new PublishError(`only the chapter title may be a level-1 heading; use "##" here.`, {
        file,
        line: line(extra),
      })
    }
    return new Chapter(
      edition,
      order,
      file,
      note.bodyLine,
      tree,
      outline,
      note.frontmatter.optionalString("description"),
    )
  }
}
