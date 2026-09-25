import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { Edition } from "../model/edition.ts"
import type { Vault } from "../obsidian/vault.ts"

const PDF_CODE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "pdf")

interface Entry {
  readonly file: string
  readonly fingerprint: string
}

/**
 * The PDFs `npm run pdf` has built, recorded in a manifest with a fingerprint of each
 * edition's sources. The site links a PDF only while its fingerprint still matches.
 */
export class PdfShelf {
  static readonly MANIFEST = "manifest.json"

  private constructor(
    private readonly folder: string,
    private readonly entries: Map<string, Entry>,
  ) {}

  static open(folder: string): PdfShelf {
    const manifest = path.join(folder, PdfShelf.MANIFEST)
    const entries = new Map<string, Entry>()
    if (fs.existsSync(manifest)) {
      const data = JSON.parse(fs.readFileSync(manifest, "utf8")) as Record<string, Entry>
      for (const [name, entry] of Object.entries(data)) {
        if (fs.existsSync(path.join(folder, entry.file))) entries.set(name, entry)
      }
    }
    return new PdfShelf(folder, entries)
  }

  /**
   * Everything that shapes the edition's PDF: series.md, every file of the book except its
   * other languages' folders, and the publisher's own PDF code.
   */
  static fingerprint(vault: Vault, edition: Edition): string {
    const others = edition.book.editions
      .filter((other) => other !== edition)
      .map((other) => `${other.folder}/`)
    const inBook = vault
      .filesUnder(edition.book.slug)
      .filter((file) => !others.some((prefix) => file.startsWith(prefix)))
    const hash = crypto.createHash("sha256")
    for (const file of ["series.md", ...inBook])
      hash.update(file).update(fs.readFileSync(vault.absolute(file)))
    for (const name of fs.readdirSync(PDF_CODE).sort()) {
      hash.update(name).update(fs.readFileSync(path.join(PDF_CODE, name)))
    }
    return hash.digest("hex")
  }

  isCurrent(name: string, fingerprint: string): boolean {
    return this.entries.get(name)?.fingerprint === fingerprint
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

  save() {
    fs.mkdirSync(this.folder, { recursive: true })
    const data = Object.fromEntries([...this.entries].sort(([a], [b]) => a.localeCompare(b)))
    fs.writeFileSync(path.join(this.folder, PdfShelf.MANIFEST), `${JSON.stringify(data, null, 2)}\n`)
  }
}
