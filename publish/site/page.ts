import type { VNode } from "preact"
import type { AccentColor } from "../model/accent.ts"
import type { LanguageCode } from "../model/language.ts"
import type { Series } from "../model/series.ts"
import type { SiteAssets } from "./assets.ts"
import type { SourceHistory } from "./history.ts"
import type { MediaLibrary } from "./media.ts"
import type { Routes } from "../routes.ts"

export interface PageHead {
  readonly title: string
  readonly description: string
  readonly type: "website" | "book" | "article"
  readonly accent: AccentColor
  readonly indexable: boolean
}

/** Shared, read-only facts every page needs to render itself. */
export class SiteContext {
  constructor(
    readonly series: Series,
    readonly routes: Routes,
    readonly assets: SiteAssets,
    readonly media: MediaLibrary,
    readonly history: SourceHistory,
    private readonly pdfs: ReadonlySet<string>,
    readonly liveReload: boolean,
  ) {}

  hasPdf(name: string): boolean {
    return this.pdfs.has(name)
  }
}

/** A page knows its URL, its translations and how to draw its body. */
export interface Page {
  readonly pathname: string
  readonly language: LanguageCode
  readonly head: PageHead
  readonly bodyClass: string
  /** The same content in each language it exists in, this page included. */
  translations(): ReadonlyMap<LanguageCode, string>
  /** Where the language switch goes when there is no exact translation. */
  switchTarget(language: LanguageCode): string
  body(): VNode | Promise<VNode>
}
