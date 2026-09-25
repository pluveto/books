import type { VFile } from "vfile"
import type { SourceLocation } from "../errors.ts"
import type { Chapter } from "../model/chapter.ts"
import type { Edition } from "../model/edition.ts"
import type { LanguageCode } from "../model/language.ts"
import type { Heading } from "../model/outline.ts"
import type { Series } from "../model/series.ts"
import type { FileIndex } from "../obsidian/file-index.ts"

/** Where links point in one kind of output. The website and the PDF each provide one. */
export interface LinkTarget {
  chapter(chapter: Chapter, heading?: Heading): string
  cover(edition: Edition): string
  catalog(language: LanguageCode): string
  media(file: string): string
  headingId(chapter: Chapter, heading: Heading): string
}

/**
 * Everything a render plugin needs to know about the chapter being rendered. Processors
 * are frozen once per edition (MathJax setup is expensive), so per-chapter state travels
 * on the VFile, the one channel unified gives plugins at run time.
 */
export class RenderScope {
  constructor(
    readonly series: Series,
    readonly files: FileIndex,
    readonly chapter: Chapter,
    readonly target: LinkTarget,
  ) {}

  /** Maps a line in the parsed body back to the line in the note on disk. */
  location(line: number | undefined): SourceLocation {
    return {
      file: this.chapter.file,
      line: line === undefined ? undefined : this.chapter.bodyLine + line - 1,
    }
  }
}

declare module "vfile" {
  interface DataMap {
    scope: RenderScope
  }
}

export function renderScope(file: VFile): RenderScope {
  const scope = file.data.scope
  if (!scope) throw new Error("render plugin ran without a RenderScope")
  return scope
}
