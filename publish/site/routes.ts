import type { Chapter } from "../model/chapter.ts"
import type { Edition } from "../model/edition.ts"
import type { LanguageCode } from "../model/language.ts"
import type { Heading } from "../model/outline.ts"

/**
 * The site's URL scheme. Every internal link is an absolute path under the base path of
 * the site URL, so the same build works at a domain root or under /books/.
 */
export class Routes {
  constructor(readonly siteUrl: URL) {}

  get base(): string {
    return this.siteUrl.pathname.endsWith("/") ? this.siteUrl.pathname : `${this.siteUrl.pathname}/`
  }

  gate(): string {
    return this.base
  }

  catalog(language: LanguageCode): string {
    return `${this.base}${language}/`
  }

  cover(edition: Edition): string {
    return `${this.catalog(edition.language)}${edition.book.slug}/`
  }

  chapter(chapter: Chapter, heading?: Heading): string {
    const page = `${this.cover(chapter.edition)}${chapter.number}/`
    return heading ? `${page}#${heading.slug}` : page
  }

  notFound(): string {
    return `${this.base}404.html`
  }

  asset(name: string): string {
    return `${this.base}assets/${name}`
  }

  media(hash: string, name: string): string {
    return `${this.base}media/${hash}/${encodeURIComponent(name)}`
  }

  pdf(edition: Edition): string {
    return `${this.base}pdf/${this.pdfName(edition)}`
  }

  pdfName(edition: Edition): string {
    return `${edition.book.slug}.${edition.language}.pdf`
  }

  searchBundle(): string {
    return `${this.base}pagefind/`
  }

  sitemap(): string {
    return `${this.base}sitemap.xml`
  }

  absolute(pathname: string): string {
    return new URL(pathname, this.siteUrl.origin).href
  }

  /** Output file for a pathname: directories become index.html. */
  file(pathname: string): string {
    if (!pathname.startsWith(this.base)) throw new Error(`${pathname} is outside ${this.base}`)
    const relative = decodeURIComponent(pathname.slice(this.base.length).split("#")[0] ?? "")
    return relative === "" || relative.endsWith("/") ? `${relative}index.html` : relative
  }
}
