import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { afterEach, beforeEach, test } from "node:test"
import { PublishCommand } from "../../publish/cli.ts"
import { BOOK_MD, makeVault, tempDir } from "../support/fixture.ts"

let errors: string[] = []
const original = console.error

beforeEach(() => {
  errors = []
  console.error = (...args: unknown[]) => errors.push(args.join(" "))
})

afterEach(() => {
  console.error = original
})

test("build writes the site and a content error exits 1 naming the file", async () => {
  const out = tempDir("books-cli-")
  assert.equal(await PublishCommand.run(["build", "--vault", makeVault(), "--out", out, "--no-search"]), 0)
  assert.ok(fs.existsSync(path.join(out, "zh", "alpha", "01", "index.html")))

  const broken = makeVault({ "alpha/book.md": BOOK_MD.replace("#1f4e5f", "#fff") })
  assert.equal(await PublishCommand.run(["build", "--vault", broken, "--out", out, "--no-search"]), 1)
  assert.match(errors.join("\n"), /vault\/alpha\/book\.md:2: frontmatter "color" #fff has contrast/)
  assert.ok(
    fs.existsSync(path.join(out, "zh", "alpha", "01", "index.html")),
    "a failed build keeps the old site",
  )
})

test("usage errors exit 64", async () => {
  assert.equal(await PublishCommand.run([]), 64)
  assert.equal(await PublishCommand.run(["publish"]), 64)
  assert.equal(await PublishCommand.run(["build", "--port", "0"]), 64)
  assert.equal(await PublishCommand.run(["pdf", "--lang", "fr"]), 64)
  assert.match(errors.join("\n"), /Usage:/)
})

test("pdf without Pandoc or XeLaTeX exits 2 and leaves the site alone", async () => {
  const out = tempDir("books-cli-pdf-")
  const vault = makeVault()
  assert.equal(await PublishCommand.run(["build", "--vault", vault, "--out", out, "--no-search"]), 0)
  const path_ = process.env.PATH
  process.env.PATH = ""
  try {
    assert.equal(await PublishCommand.run(["pdf", "--vault", vault, "--out", out]), 2)
  } finally {
    process.env.PATH = path_
  }
  assert.match(errors.join("\n"), /Missing required tools: pandoc, xelatex, rsvg-convert/)
  assert.ok(fs.existsSync(path.join(out, "index.html")))
})
