import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import type { Vault } from "../obsidian/vault.ts"
import type { Routes } from "./routes.ts"

/** Vault files the site links to, published under content-hashed folders. */
export class MediaLibrary {
  private readonly published = new Map<string, { url: string; output: string }>()

  constructor(
    private readonly vault: Vault,
    private readonly routes: Routes,
  ) {}

  url(file: string): string {
    const known = this.published.get(file)
    if (known) return known.url
    const hash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(this.vault.absolute(file)))
      .digest("hex")
      .slice(0, 12)
    const name = path.posix.basename(file)
    const url = this.routes.media(hash, name)
    this.published.set(file, { url, output: this.routes.file(url) })
    return url
  }

  /** Output path and source path of every file referenced so far. */
  entries(): { output: string; source: string }[] {
    return [...this.published].map(([file, { output }]) => ({ output, source: this.vault.absolute(file) }))
  }
}
