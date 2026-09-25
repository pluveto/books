import fs from "node:fs"
import path from "node:path"
import * as pagefind from "pagefind"
import { OUTPUT } from "./protocol.ts"

export interface IndexedPage {
  /** Public path, base path included, that search results link to. */
  readonly url: string
  /** HTML file relative to the site folder. */
  readonly file: string
}

/**
 * Full-text search built at build time, one index per page language. Pages are added one
 * by one in a fixed order so the index is reproducible and its links carry the base path.
 */
export async function writeSearchIndex(folder: string, pages: readonly IndexedPage[]): Promise<void> {
  const { index, errors } = await pagefind.createIndex({})
  try {
    if (!index) throw new Error(`Pagefind failed to start: ${errors.join("; ")}`)
    for (const page of [...pages].sort((a, b) => a.url.localeCompare(b.url))) {
      const content = fs.readFileSync(path.join(folder, ...page.file.split("/")), "utf8")
      const added = await index.addHTMLFile({ url: page.url, content })
      if (added.errors.length)
        throw new Error(`Pagefind could not index ${page.url}: ${added.errors.join("; ")}`)
    }
    const written = await index.writeFiles({ outputPath: path.join(folder, OUTPUT.search) })
    if (written.errors.length)
      throw new Error(`Pagefind could not write its index: ${written.errors.join("; ")}`)
  } finally {
    await pagefind.close()
  }
}
