import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import type { Vault } from "../obsidian/vault.ts"
import type { Routes } from "./routes.ts"

/** The vault files a build publishes, each under a content-hashed folder. */
export class MediaLibrary {
  private readonly published = new Map<string, { url: string; output: string }>()

  constructor(
    private readonly vault: Vault,
    private readonly routes: Routes,
  ) {}

  /** Adds a file to this build's media and returns its URL. */
  publish(file: string): string {
    const known = this.published.get(file)
    if (known) return known.url
    const hash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(this.vault.absolute(file)))
      .digest("hex")
      .slice(0, 12)
    const url = this.routes.media(hash, path.posix.basename(file))
    this.published.set(file, { url, output: this.routes.file(url) })
    return url
  }

  /** Copies every published file into a site folder; returns how many there were. */
  copyTo(root: string): number {
    for (const [file, { output }] of this.published) {
      const target = path.join(root, ...output.split("/"))
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.copyFileSync(this.vault.absolute(file), target)
    }
    return this.published.size
  }
}
