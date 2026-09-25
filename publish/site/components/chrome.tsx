import type { Edition } from "../../model/edition.ts"
import type { LanguageCode } from "../../model/language.ts"
import { messages } from "../../i18n.ts"
import type { Page, SiteContext } from "../page.ts"
import { Icon } from "./icon.tsx"

interface HeaderProps {
  readonly page: Page
  readonly site: SiteContext
  readonly edition?: Edition
  readonly hasSidebar?: boolean
}

export function SiteHeader({ page, site, edition, hasSidebar = false }: HeaderProps) {
  const { series, routes } = site
  const text = messages(page.language)
  const others = series.languages.filter((language) => language !== page.language)
  return (
    <header class="site-header">
      <div class="site-header-inner">
        {hasSidebar && (
          <button
            type="button"
            class="icon-button menu-toggle"
            aria-controls="sidebar"
            aria-expanded="false"
            aria-label={text.openContents}
            data-sidebar-toggle
          >
            <Icon name="menu" />
          </button>
        )}
        <a class="brand" href={routes.catalog(page.language)} aria-label={series.text(page.language).title}>
          <BrandMark />
          <span class="brand-name">{series.text(page.language).title}</span>
        </a>
        {edition && (
          <>
            <span class="brand-separator" aria-hidden="true">
              /
            </span>
            <a class="brand-book" href={routes.cover(edition)}>
              {edition.title}
            </a>
          </>
        )}
        <div class="header-actions">
          <button
            type="button"
            class="search-button"
            data-search-open
            aria-label={text.search}
            aria-keyshortcuts="/ Control+K Meta+K"
          >
            <Icon name="search" />
            <span class="search-button-label">{text.search}</span>
            <kbd aria-hidden="true">/</kbd>
          </button>
          {others.map((language) => (
            <LanguageSwitch
              language={language}
              href={page.switchTarget(language)}
              label={text.switchLanguage}
            />
          ))}
          <button type="button" class="icon-button" data-theme-toggle aria-label={text.toggleTheme}>
            <Icon name="sun" class="icon-sun" />
            <Icon name="moon" class="icon-moon" />
          </button>
          {series.settings.repository && (
            <a class="icon-button" href={series.settings.repository} aria-label={text.sourceCode}>
              <Icon name="github" />
            </a>
          )}
        </div>
      </div>
    </header>
  )
}

function LanguageSwitch({ language, href, label }: { language: LanguageCode; href: string; label: string }) {
  const target = messages(language)
  return (
    <a
      class="language-switch"
      href={href}
      hreflang={target.htmlLang}
      lang={target.htmlLang}
      data-language={language}
      title={label}
    >
      <Icon name="languages" />
      <span>{target.languageName}</span>
    </a>
  )
}

export function BrandMark() {
  return (
    <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="5" y="3" width="22" height="26" rx="3" fill="currentColor" opacity="0.18" />
      <rect x="5" y="3" width="22" height="26" rx="3" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M11 3v26" stroke="currentColor" stroke-width="2" />
      <path d="M15 11h7M15 15.5h7M15 20h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  )
}

export function SiteFooter({ language, site }: { language: LanguageCode; site: SiteContext }) {
  const { settings } = site.series
  const text = messages(language)
  const [before, between, after] = text.licenseNotice
  return (
    <footer class="site-footer" data-pagefind-ignore="all">
      <div class="site-footer-inner">
        <p>
          {before}
          <a href={settings.textLicense.url} rel="license">
            {settings.textLicense.name}
          </a>
          {between}
          <a href={settings.codeLicense.url}>{settings.codeLicense.name}</a>
          {after}
        </p>
        <p class="site-footer-credits">
          {settings.repository && (
            <>
              <a href={settings.repository}>{text.sourceCode}</a>
              <span aria-hidden="true"> · </span>
            </>
          )}
          <a href="https://quartz.jzhao.xyz/">{text.builtWith}</a>
          <span aria-hidden="true"> · </span>
          <a href="https://github.com/changkun/modern-cpp-tutorial">{text.layoutCredit}</a>
        </p>
      </div>
    </footer>
  )
}

export function SearchDialog({ language }: { language: LanguageCode }) {
  const text = messages(language)
  return (
    <dialog class="search-dialog" aria-label={text.search} data-search-dialog>
      <div class="search-panel">
        <div class="search-ui" data-search-ui />
        <button
          type="button"
          class="icon-button search-close"
          data-search-close
          aria-label={text.closeSearch}
        >
          <Icon name="close" />
        </button>
      </div>
    </dialog>
  )
}
