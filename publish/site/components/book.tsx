import type { Chapter } from "../../model/chapter.ts"
import type { Edition } from "../../model/edition.ts"
import { messages } from "../../i18n.ts"
import type { SiteContext } from "../page.ts"
import { Icon } from "./icon.tsx"

export function Cover({
  edition,
  site,
  size,
}: {
  edition: Edition
  site: SiteContext
  size: "card" | "hero"
}) {
  const { book } = edition
  const series = site.series.text(edition.language)
  return (
    <div class={`cover cover-${size}`} style={`--cover:${book.accent.hex}`} aria-hidden="true">
      <div class="cover-face">
        <span class="cover-title">{edition.title}</span>
        <span class="cover-subtitle">{edition.text.subtitle}</span>
        <img class="cover-art" src={site.media.publish(book.cover)} alt="" width="240" height="240" />
        <span class="cover-imprint">{series.author ?? series.title}</span>
      </div>
    </div>
  )
}

export function chapterLabel(chapter: Chapter): string {
  const text = messages(chapter.edition.language)
  return chapter.isFrontMatter ? text.frontMatter : text.chapter(chapter.order)
}

export function PdfLink({ edition, site }: { edition: Edition; site: SiteContext }) {
  if (!site.hasPdf(site.routes.pdfName(edition))) return null
  return (
    <a class="button" href={site.routes.pdf(edition)} download>
      <Icon name="download" />
      {messages(edition.language).downloadPdf}
    </a>
  )
}

export function Sidebar({
  edition,
  current,
  site,
}: {
  edition: Edition
  current?: Chapter
  site: SiteContext
}) {
  const { routes } = site
  const text = messages(edition.language)
  return (
    <nav id="sidebar" class="sidebar" aria-label={text.contents} data-pagefind-ignore="all">
      <div class="sidebar-inner">
        <a class="sidebar-book" href={routes.cover(edition)} aria-current={current ? undefined : "page"}>
          <span class="sidebar-book-title">{edition.title}</span>
          <span class="sidebar-book-subtitle">{edition.text.subtitle}</span>
        </a>
        <ol class="toc">
          {edition.chapters.map((chapter) => {
            const isCurrent = chapter === current
            const sections = isCurrent ? chapter.outline.sections : []
            return (
              <li class={isCurrent ? "toc-item is-current" : "toc-item"}>
                <a
                  class="toc-link"
                  href={routes.chapter(chapter)}
                  aria-current={isCurrent ? "page" : undefined}
                >
                  <span class="toc-number">{chapter.isFrontMatter ? "" : chapter.order}</span>
                  <span class="toc-title">{chapter.title}</span>
                </a>
                {sections.length > 0 && (
                  <ol class="toc-sections">
                    {sections.map((heading) => (
                      <li class={`toc-section depth-${heading.depth}`}>
                        <a href={`#${routes.headingId(heading)}`} data-section={routes.headingId(heading)}>
                          {heading.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
