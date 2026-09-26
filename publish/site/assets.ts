import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"
import type { Routes } from "../routes.ts"

const here = path.dirname(fileURLToPath(import.meta.url))

export interface AssetFile {
  readonly output: string
  readonly content: string | Buffer
}

/**
 * Stylesheet, browser script and favicon, bundled by esbuild and named by content hash
 * so they can be cached forever.
 */
export class SiteAssets {
  private constructor(
    readonly stylesheet: string,
    readonly script: string,
    readonly favicon: string,
    readonly touchIcon: string,
    readonly files: readonly AssetFile[],
  ) {}

  static async build(routes: Routes): Promise<SiteAssets> {
    const files: AssetFile[] = []
    const publish = (name: string, extension: string, content: string | Buffer) => {
      const hash = crypto.createHash("sha256").update(content).digest("hex").slice(0, 10)
      const url = routes.asset(`${name}.${hash}${extension}`)
      files.push({ output: routes.file(url), content })
      return url
    }
    const [css, js] = await Promise.all([
      SiteAssets.bundle(path.join(here, "styles", "index.css")),
      SiteAssets.bundle(path.join(here, "client", "main.ts")),
    ])
    const staticFile = (name: string) => fs.readFileSync(path.join(here, "static", name))
    return new SiteAssets(
      publish("site", ".css", css),
      publish("site", ".js", js),
      publish("favicon", ".svg", staticFile("favicon.svg")),
      publish("apple-touch-icon", ".png", staticFile("apple-touch-icon.png")),
      files,
    )
  }

  private static async bundle(entry: string): Promise<string> {
    const result = await build({
      entryPoints: [entry],
      bundle: true,
      minify: true,
      write: false,
      format: "iife",
      target: ["es2020", "chrome100", "firefox100", "safari15"],
      legalComments: "none",
      logLevel: "silent",
    })
    const [output] = result.outputFiles
    if (!output) throw new Error(`esbuild produced nothing for ${entry}`)
    return output.text
  }
}
