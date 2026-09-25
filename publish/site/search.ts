import path from "node:path"
import * as pagefind from "pagefind"

/** Full-text search built at build time; one index per page language. */
export async function writeSearchIndex(out: string): Promise<void> {
  const { index, errors } = await pagefind.createIndex({})
  try {
    if (!index) throw new Error(`Pagefind failed to start: ${errors.join("; ")}`)
    const added = await index.addDirectory({ path: out })
    if (added.errors.length) throw new Error(`Pagefind could not index the site: ${added.errors.join("; ")}`)
    const written = await index.writeFiles({ outputPath: path.join(out, "pagefind") })
    if (written.errors.length)
      throw new Error(`Pagefind could not write its index: ${written.errors.join("; ")}`)
  } finally {
    await pagefind.close()
  }
}
