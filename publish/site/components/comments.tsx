import type { Chapter } from "../../model/chapter.ts"
import { messages } from "../../i18n.ts"
import type { SiteContext } from "../page.ts"

/**
 * Discussion thread for one chapter. Only the mount point is rendered; the browser script
 * loads giscus when the reader scrolls down to it, so a page nobody scrolls costs nothing
 * and the build stays free of third-party markup.
 */
export function Comments({ chapter, site }: { chapter: Chapter; site: SiteContext }) {
  const { comments } = site.series.settings
  if (!comments) return null
  const { language } = chapter.edition
  const text = messages(language)
  return (
    <section class="comments" aria-labelledby="comments-heading" data-pagefind-ignore="all">
      <h2 id="comments-heading">{text.comments}</h2>
      <div
        class="comments-mount"
        data-comments="true"
        data-comments-repo={comments.repo}
        data-comments-repo-id={comments.repoId}
        data-comments-category={comments.category}
        data-comments-category-id={comments.categoryId}
        data-comments-term={term(chapter)}
        data-comments-lang={text.htmlLang}
        data-comments-unavailable={text.commentsUnavailable}
      />
    </section>
  )
}

/**
 * Key that ties a thread to a chapter. It deliberately excludes the site's base path so
 * moving the site to another domain or subpath keeps every existing discussion attached.
 */
function term(chapter: Chapter): string {
  return `${chapter.edition.language}/${chapter.edition.book.slug}/${chapter.number}`
}
