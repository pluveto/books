import path from "node:path"

export type Resolution =
  | { readonly kind: "found"; readonly file: string }
  | { readonly kind: "missing" }
  | { readonly kind: "ambiguous"; readonly candidates: readonly string[] }

/**
 * Obsidian's link resolution: an exact vault path wins, then a path relative to the
 * linking note, then a unique path suffix such as a bare file name. Like Obsidian, names
 * match without regard to case; an exact-case match is preferred when there are several.
 */
export class FileIndex {
  private readonly byLowerCase = new Map<string, string[]>()

  constructor(files: readonly string[]) {
    for (const file of files) {
      const key = file.toLowerCase()
      this.byLowerCase.set(key, [...(this.byLowerCase.get(key) ?? []), file])
    }
  }

  resolve(linkpath: string, from: string): Resolution {
    const wanted = linkpath.trim().replace(/\\/g, "/").replace(/^\/+/, "")
    if (!wanted) return { kind: "missing" }
    const names = path.posix.extname(wanted) ? [wanted, `${wanted}.md`] : [`${wanted}.md`, wanted]

    for (const name of names) {
      const hit = this.exact(name)
      if (hit) return hit
    }
    const folder = path.posix.dirname(from)
    for (const name of names) {
      const relative = path.posix.normalize(path.posix.join(folder, name))
      const hit = relative.startsWith("../") ? undefined : this.exact(relative)
      if (hit) return hit
    }
    for (const name of names) {
      const suffix = `/${name.toLowerCase()}`
      const hits = [...this.byLowerCase.entries()]
        .filter(([key]) => key.endsWith(suffix))
        .flatMap(([, files]) => files)
      const resolution = FileIndex.pick(hits, name)
      if (resolution) return resolution
    }
    return { kind: "missing" }
  }

  private exact(name: string): Resolution | undefined {
    return FileIndex.pick(this.byLowerCase.get(name.toLowerCase()) ?? [], name)
  }

  private static pick(hits: readonly string[], name: string): Resolution | undefined {
    if (hits.length === 0) return undefined
    if (hits.length === 1 && hits[0]) return { kind: "found", file: hits[0] }
    const sameCase = hits.filter((file) => file === name || file.endsWith(`/${name}`))
    if (sameCase.length === 1 && sameCase[0]) return { kind: "found", file: sameCase[0] }
    return { kind: "ambiguous", candidates: [...hits].sort() }
  }
}
