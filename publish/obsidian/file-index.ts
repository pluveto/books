import path from "node:path"

export type Resolution =
  | { readonly kind: "found"; readonly file: string }
  | { readonly kind: "missing" }
  | { readonly kind: "ambiguous"; readonly candidates: readonly string[] }

/**
 * Obsidian's link resolution: an exact vault path wins, then a path relative to the
 * linking note, then a unique path suffix such as a bare file name.
 */
export class FileIndex {
  private readonly files: Set<string>

  constructor(files: readonly string[]) {
    this.files = new Set(files)
  }

  resolve(linkpath: string, from: string): Resolution {
    const wanted = linkpath.trim().replace(/\\/g, "/").replace(/^\/+/, "")
    if (!wanted) return { kind: "missing" }
    const names = path.posix.extname(wanted) ? [wanted, `${wanted}.md`] : [`${wanted}.md`, wanted]

    for (const name of names) {
      if (this.files.has(name)) return { kind: "found", file: name }
    }
    const folder = path.posix.dirname(from)
    for (const name of names) {
      const relative = path.posix.normalize(path.posix.join(folder, name))
      if (!relative.startsWith("../") && this.files.has(relative)) return { kind: "found", file: relative }
    }
    for (const name of names) {
      const suffix = `/${name}`
      const hits = [...this.files].filter((file) => file.endsWith(suffix))
      if (hits.length === 1 && hits[0]) return { kind: "found", file: hits[0] }
      if (hits.length > 1) return { kind: "ambiguous", candidates: hits.sort() }
    }
    return { kind: "missing" }
  }
}
