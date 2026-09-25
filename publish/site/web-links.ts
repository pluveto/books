import type { Chapter } from "../model/chapter.ts"
import type { Edition } from "../model/edition.ts"
import type { LanguageCode } from "../model/language.ts"
import type { Heading } from "../model/outline.ts"
import type { LinkTarget } from "../render/scope.ts"
import type { MediaLibrary } from "./media.ts"
import type { Routes } from "./routes.ts"

export class WebLinks implements LinkTarget {
  constructor(
    private readonly routes: Routes,
    private readonly library: MediaLibrary,
  ) {}

  chapter(chapter: Chapter, heading?: Heading): string {
    return this.routes.chapter(chapter, heading)
  }

  cover(edition: Edition): string {
    return this.routes.cover(edition)
  }

  catalog(language: LanguageCode): string {
    return this.routes.catalog(language)
  }

  media(file: string): string {
    return this.library.publish(file)
  }

  headingId(_chapter: Chapter, heading: Heading): string {
    return this.routes.headingId(heading)
  }
}
