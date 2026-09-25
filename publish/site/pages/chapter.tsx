import type { Chapter } from "../../model/chapter.ts"
import type { LanguageCode } from "../../model/language.ts"
import { chapterLabel, Sidebar } from "../components/book.tsx"
import { SearchDialog, SiteFooter, SiteHeader } from "../components/chrome.tsx"
import { Icon } from "../components/icon.tsx"
import { messages } from "../../i18n.ts"
import type { Page, PageHead, SiteContext } from "../page.ts"

export class ChapterPage implements Page {
  readonly bodyClass = "page-book page-chapter"

  constructor(
    private readonly site: SiteContext,
    private readonly chapter: Chapter,
    private readonly html: string,
  ) {}

  get language(): LanguageCode {
    return this.chapter.edition.language
  }

  get pathname(): string {
    return this.site.routes.chapter(this.chapter)
  }

  get head(): PageHead {
    const { edition } = this.chapter
    return {
      title: `${this.chapter.title} · ${edition.title}`,
      description: this.chapter.description ?? edition.text.description,
      type: "article",
      accent: edition.book.accent,
      indexable: true,
    }
  }

  translations(): ReadonlyMap<LanguageCode, string> {
    const entries: [LanguageCode, string][] = []
    for (const edition of this.chapter.edition.book.editions) {
      const counterpart = edition.chapter(this.chapter.order)
      if (counterpart) entries.push([edition.language, this.site.routes.chapter(counterpart)])
    }
    return new Map(entries)
  }

  switchTarget(language: LanguageCode): string {
    const edition = this.chapter.edition.translation(language)
    const counterpart = edition?.chapter(this.chapter.order)
    if (counterpart) return this.site.routes.chapter(counterpart)
    return edition ? this.site.routes.cover(edition) : this.site.routes.catalog(language)
  }

  body() {
    const { chapter, site } = this
    const { edition } = chapter
    const text = messages(this.language)
    const previous = edition.previous(chapter)
    const next = edition.next(chapter)
    const editUrl = site.history.editUrl(site.series, chapter.file)
    const updated = site.history.lastUpdated(chapter.file)
    return (
      <>
        <SiteHeader page={this} site={site} edition={edition} hasSidebar />
        <div class="book-layout">
          <Sidebar edition={edition} current={chapter} site={site} />
          <div class="sidebar-backdrop" data-sidebar-close hidden />
          <main id="content" class="content">
            <article class="chapter" data-pagefind-body data-pagefind-filter={`book:${edition.title}`}>
              <header class="chapter-header">
                <p class="chapter-kicker">{chapterLabel(chapter)}</p>
                <h1 id={chapter.outline.title?.slug}>{chapter.title}</h1>
              </header>
              <div class="prose" dangerouslySetInnerHTML={{ __html: this.html }} />
            </article>
            <footer class="chapter-footer" data-pagefind-ignore="all">
              {(editUrl || updated) && (
                <div class="chapter-meta">
                  {editUrl && (
                    <a href={editUrl}>
                      <Icon name="edit" />
                      {text.editPage}
                    </a>
                  )}
                  {updated && <span>{text.lastUpdated(formatDate(updated, text.htmlLang))}</span>}
                </div>
              )}
              <nav class="pager" aria-label={`${text.previous} / ${text.next}`}>
                {previous ? (
                  <a class="pager-link pager-previous" href={site.routes.chapter(previous)} rel="prev">
                    <span class="pager-label">
                      <Icon name="previous" />
                      {text.previous}
                    </span>
                    <span class="pager-title">{previous.title}</span>
                  </a>
                ) : (
                  <span />
                )}
                {next && (
                  <a class="pager-link pager-next" href={site.routes.chapter(next)} rel="next">
                    <span class="pager-label">
                      {text.next}
                      <Icon name="next" />
                    </span>
                    <span class="pager-title">{next.title}</span>
                  </a>
                )}
              </nav>
            </footer>
          </main>
        </div>
        <SiteFooter language={this.language} site={site} />
        <SearchDialog language={this.language} />
      </>
    )
  }
}

function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  )
}
