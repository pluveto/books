import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

const PUBLISH = path.resolve(import.meta.dirname, "../../publish")

/** Shared kernel: small modules every layer may use; they depend on the model at most. */
const SHARED = new Set(["i18n.ts", "errors.ts", "routes.ts", "protocol.ts"])

/**
 * What each part of the publisher may import. `site` and `pdf` are siblings: neither sees
 * the other, which is what lets the PDF fingerprint leave `site/` out.
 */
const ALLOWED: Record<string, readonly string[]> = {
  model: ["model"],
  shared: ["model", "shared"],
  obsidian: ["model", "shared", "obsidian"],
  render: ["model", "shared", "obsidian", "render"],
  site: ["model", "shared", "obsidian", "render", "site"],
  pdf: ["model", "shared", "obsidian", "render", "pdf"],
  dev: ["shared", "dev"],
  cli: ["model", "shared", "obsidian", "render", "site", "pdf", "dev"],
}

function part(file: string): string {
  const relative = path.relative(PUBLISH, file).split(path.sep)
  if (relative.length === 1)
    return relative[0] === "cli.ts" ? "cli" : SHARED.has(relative[0] ?? "") ? "shared" : "?"
  return relative[0] ?? "?"
}

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sources(full)
    return /\.tsx?$/.test(entry.name) ? [full] : []
  })
}

test("every import follows the layering in CONTRIBUTING.md", () => {
  const violations: string[] = []
  for (const file of sources(PUBLISH)) {
    const from = part(file)
    const allowed = ALLOWED[from]
    assert.ok(allowed, `${path.relative(PUBLISH, file)} belongs to no known part`)
    const specifiers = /(?:from\s+|import\s*\(\s*|import\s+)"(\.{1,2}\/[^"]+)"/g
    for (const match of fs.readFileSync(file, "utf8").matchAll(specifiers)) {
      const target = part(path.resolve(path.dirname(file), match[1] ?? ""))
      if (!allowed.includes(target))
        violations.push(`${path.relative(PUBLISH, file)} (${from}) imports ${match[1]} (${target})`)
    }
  }
  assert.deepEqual(violations, [])
})
