import fs from "node:fs"
import path from "node:path"
import { isMap, isScalar, parseDocument, type YAMLMap } from "yaml"
import { PublishError } from "../errors.ts"

export interface Note {
  readonly file: string
  readonly frontmatter: Frontmatter
  readonly body: string
  /** 1-based line of the first body line in the file, so body positions map back to the source. */
  readonly bodyLine: number
}

/** Typed access to one note's YAML frontmatter; every failed read names the file, line and key. */
export class Frontmatter {
  constructor(
    private readonly data: Record<string, unknown>,
    readonly file: string,
    private readonly lines: ReadonlyMap<string, number> = new Map(),
    private readonly prefix = "",
  ) {}

  string(key: string): string {
    const value = this.optionalString(key)
    if (value === undefined) throw this.error(`"${this.prefix}${key}" is required`)
    return value
  }

  optionalString(key: string): string | undefined {
    const value = this.data[key]
    if (value === undefined || value === null) return undefined
    if (typeof value !== "string" || value.trim() === "") {
      throw this.error(`"${this.prefix}${key}" must be a non-empty string`, key)
    }
    return value.trim()
  }

  strings(key: string): string[] {
    const value = this.data[key]
    if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === "string")) {
      throw this.error(`"${this.prefix}${key}" must be a non-empty list of strings`, key)
    }
    return value.map((item: string) => item.trim())
  }

  section(key: string): Frontmatter | undefined {
    const value = this.data[key]
    if (value === undefined || value === null) return undefined
    if (typeof value !== "object" || Array.isArray(value)) {
      throw this.error(`"${this.prefix}${key}" must be a mapping`, key)
    }
    return new Frontmatter(value as Record<string, unknown>, this.file, this.lines, `${this.prefix}${key}.`)
  }

  keys(): string[] {
    return Object.keys(this.data)
  }

  /** Rejects keys the publisher would otherwise ignore, which are almost always typos. */
  allowOnly(allowed: readonly string[]) {
    for (const key of this.keys()) {
      if (allowed.includes(key)) continue
      const guess = Frontmatter.closest(key, allowed)
      const hint = guess ? `; did you mean "${this.prefix}${guess}"?` : ""
      throw this.error(`unknown key "${this.prefix}${key}"${hint}`, key)
    }
  }

  error(message: string, key?: string): PublishError {
    const own = key === undefined ? undefined : this.lines.get(`${this.prefix}${key}`)
    const line = own ?? this.lines.get(this.prefix.slice(0, -1)) ?? 1
    return new PublishError(`frontmatter ${message}.`, { file: this.file, line })
  }

  private static closest(key: string, candidates: readonly string[]): string | undefined {
    let best: { candidate: string; distance: number } | undefined
    for (const candidate of candidates) {
      const distance = Frontmatter.distance(key, candidate)
      if (distance <= 2 && (!best || distance < best.distance)) best = { candidate, distance }
    }
    return best?.candidate
  }

  private static distance(a: string, b: string): number {
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
    for (let i = 1; i <= a.length; i++) {
      const current = [i]
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1
        current[j] = Math.min(
          (previous[j] ?? 0) + 1,
          (current[j - 1] ?? 0) + 1,
          (previous[j - 1] ?? 0) + cost,
        )
      }
      previous = current
    }
    return previous[b.length] ?? 0
  }
}

/** Read-only view of an Obsidian vault. Paths in and out are vault-relative POSIX paths. */
export class Vault {
  private readonly fileSet: Set<string>

  private constructor(
    readonly root: string,
    readonly files: readonly string[],
  ) {
    this.fileSet = new Set(files)
  }

  static open(root: string): Vault {
    const absolute = path.resolve(root)
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
      throw new PublishError(`Vault folder not found: ${absolute}`)
    }
    return new Vault(absolute, Vault.scan(absolute))
  }

  hasFile(file: string): boolean {
    return this.fileSet.has(file)
  }

  hasFolder(folder: string): boolean {
    const full = this.absolute(folder)
    return fs.existsSync(full) && fs.statSync(full).isDirectory()
  }

  /** Immediate children of a folder: names of files and subfolders, sorted by code point. */
  entries(folder: string): { files: string[]; folders: string[] } {
    const files: string[] = []
    const folders: string[] = []
    for (const entry of fs.readdirSync(this.absolute(folder), { withFileTypes: true })) {
      if (Vault.hidden(entry.name)) continue
      if (entry.isDirectory()) folders.push(entry.name)
      else if (entry.isFile()) files.push(entry.name)
    }
    return { files: files.sort(), folders: folders.sort() }
  }

  /** Files anywhere below a folder, as vault-relative paths. */
  filesUnder(folder: string): string[] {
    const prefix = `${folder}/`
    return this.files.filter((file) => file.startsWith(prefix))
  }

  absolute(file: string): string {
    return path.join(this.root, ...file.split("/"))
  }

  note(file: string): Note {
    if (!this.hasFile(file)) throw new PublishError("note not found.", { file })
    const text = fs
      .readFileSync(this.absolute(file), "utf8")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n?/g, "\n")
    const match = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text)
    if (!match) return { file, frontmatter: new Frontmatter({}, file), body: text, bodyLine: 1 }
    const yaml = match[1] ?? ""
    const document = parseDocument(yaml)
    const [problem] = document.errors
    if (problem) {
      const line = (problem.linePos?.[0].line ?? 0) + 1
      throw new PublishError(`invalid YAML frontmatter: ${problem.message.split("\n")[0]}`, { file, line })
    }
    const data: unknown = document.toJS()
    if (data !== null && (typeof data !== "object" || Array.isArray(data))) {
      throw new PublishError("frontmatter must be a YAML mapping.", { file, line: 2 })
    }
    const lines = new Map<string, number>()
    if (isMap(document.contents)) Vault.keyLines(document.contents, yaml, "", lines)
    const bodyLine = match[0].split("\n").length - (match[0].endsWith("\n") ? 1 : 0) + 1
    return {
      file,
      frontmatter: new Frontmatter((data ?? {}) as Record<string, unknown>, file, lines),
      body: text.slice(match[0].length),
      bodyLine,
    }
  }

  /** Line in the note of every key, nested keys as "section.key"; YAML starts on line 2. */
  private static keyLines(map: YAMLMap, yaml: string, prefix: string, lines: Map<string, number>) {
    for (const pair of map.items) {
      if (!isScalar(pair.key) || !pair.key.range) continue
      const key = `${prefix}${String(pair.key.value)}`
      lines.set(key, yaml.slice(0, pair.key.range[0]).split("\n").length + 1)
      if (isMap(pair.value)) Vault.keyLines(pair.value, yaml, `${key}.`, lines)
    }
  }

  private static hidden(name: string): boolean {
    return name.startsWith(".")
  }

  private static scan(root: string): string[] {
    const files: string[] = []
    const walk = (dir: string, prefix: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (Vault.hidden(entry.name)) continue
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.isDirectory()) walk(path.join(dir, entry.name), rel)
        else if (entry.isFile()) files.push(rel)
      }
    }
    walk(root, "")
    return files.sort()
  }
}
