import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { Vault } from "../obsidian/vault.ts"

interface Entry {
  readonly file: string
  readonly fingerprint: string
}

const PUBLISHER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
/** Dependency versions that render and typeset a PDF. */
const LOCKFILE = path.join(PUBLISHER, "..", "package-lock.json")
/** Environment the PDF build reads besides its files. */
const ENVIRONMENT = ["BOOKS_CJK_FONT", "BOOKS_MONO_FONT"] as const
/**
 * The PDF build never imports these (tests/unit/layers.test.ts enforces it), so they
 * cannot change what a PDF contains.
 */
const WEB_ONLY = new Set(["site", "dev", "cli.ts"])

/**
 * The PDFs `npm run pdf` has built, recorded in a manifest with a fingerprint of their
 * inputs. A PDF counts as current only while that fingerprint still matches.
 */
export class PdfShelf {
  static readonly MANIFEST = "manifest.json"

  private constructor(
    private readonly folder: string,
    private readonly entries: Map<string, Entry>,
  ) {}

  /** An unreadable manifest counts as an empty shelf: no PDF is linked until rebuilt. */
  static open(folder: string): PdfShelf {
    const entries = new Map<string, Entry>()
    for (const [name, { file, fingerprint }] of Object.entries(PdfShelf.readManifest(folder))) {
      if (
        typeof file === "string" &&
        typeof fingerprint === "string" &&
        fs.existsSync(path.join(folder, file))
      ) {
        entries.set(name, { file, fingerprint })
      }
    }
    return new PdfShelf(folder, entries)
  }

  /**
   * Everything a PDF can depend on that this publisher controls: the whole vault (cross-book
   * links quote other books' titles), the publisher's non-web code, the dependency lockfile,
   * the font overrides and the site URL its absolute links use. Any change invalidates every
   * PDF, which is conservative but never stale.
   */
  static fingerprint(vault: Vault, siteUrl: URL): string {
    const hash = crypto.createHash("sha256").update(siteUrl.href)
    for (const name of ENVIRONMENT) hash.update(`${name}=${process.env[name] ?? ""}`)
    for (const file of vault.files) hash.update(file).update(fs.readFileSync(vault.absolute(file)))
    for (const file of PdfShelf.publisherFiles()) {
      hash.update(file).update(fs.readFileSync(path.join(PUBLISHER, file)))
    }
    if (fs.existsSync(LOCKFILE)) hash.update(fs.readFileSync(LOCKFILE))
    return hash.digest("hex")
  }

  /** Names of the recorded PDFs that match the given fingerprint. */
  current(names: readonly string[], fingerprint: string): Set<string> {
    return new Set(names.filter((name) => this.entries.get(name)?.fingerprint === fingerprint))
  }

  record(name: string, file: string, fingerprint: string) {
    this.entries.set(name, { file, fingerprint })
  }

  /** Forgets and deletes every PDF whose name is not kept. */
  prune(keep: ReadonlySet<string>) {
    for (const [name, entry] of this.entries) {
      if (keep.has(name)) continue
      fs.rmSync(path.join(this.folder, entry.file), { force: true })
      this.entries.delete(name)
    }
  }

  /** Written beside the manifest and renamed over it, so a crash never leaves half a file. */
  save() {
    fs.mkdirSync(this.folder, { recursive: true })
    const data = Object.fromEntries([...this.entries].sort(([a], [b]) => a.localeCompare(b)))
    const manifest = path.join(this.folder, PdfShelf.MANIFEST)
    fs.writeFileSync(`${manifest}.tmp`, `${JSON.stringify(data, null, 2)}\n`)
    fs.renameSync(`${manifest}.tmp`, manifest)
  }

  private static readManifest(folder: string): Record<string, Partial<Entry>> {
    const manifest = path.join(folder, PdfShelf.MANIFEST)
    if (!fs.existsSync(manifest)) return {}
    try {
      const data: unknown = JSON.parse(fs.readFileSync(manifest, "utf8"))
      return data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, Partial<Entry>>)
        : {}
    } catch {
      return {}
    }
  }

  private static publisherFiles(): string[] {
    const files: string[] = []
    const walk = (relative: string) => {
      for (const entry of fs.readdirSync(path.join(PUBLISHER, relative), { withFileTypes: true })) {
        const child = relative ? `${relative}/${entry.name}` : entry.name
        if (!relative && WEB_ONLY.has(entry.name)) continue
        if (entry.isDirectory()) walk(child)
        else files.push(child)
      }
    }
    walk("")
    return files.sort()
  }
}
