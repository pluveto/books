import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { afterEach, beforeEach, test } from "node:test"
import { PublishCommand } from "../../publish/cli.ts"
import { PdfShelf } from "../../publish/site/pdf-shelf.ts"
import { Site } from "../../publish/site/site.ts"
import { BOOK_MD, makeVault, readSeries, tempDir } from "../support/fixture.ts"
import { BuiltSite } from "../support/site-audit.ts"

function snapshot(root: string): Record<string, string> {
  return Object.fromEntries(
    BuiltSite.walk(root).map((file) => [file, fs.readFileSync(path.join(root, file)).toString("base64")]),
  )
}

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
  assert.match(errors.join("\n"), /books-vault-\w+\/alpha\/book\.md:2: frontmatter "color" #fff has contrast/)
  assert.ok(
    fs.existsSync(path.join(out, "zh", "alpha", "01", "index.html")),
    "a failed build keeps the old site",
  )
})

test("build refuses to replace a folder it did not create", async () => {
  const out = tempDir("books-foreign-")
  fs.writeFileSync(path.join(out, "notes.txt"), "mine")
  fs.mkdirSync(path.join(out, ".git"))
  assert.equal(await PublishCommand.run(["build", "--vault", makeVault(), "--out", out, "--no-search"]), 1)
  assert.match(errors.join("\n"), /Refusing to replace .*not created by this publisher/)
  assert.deepEqual(fs.readdirSync(out).sort(), [".git", "notes.txt"])
})

test("a failure after rendering leaves the previous site byte-for-byte", async () => {
  const out = tempDir("books-atomic-")
  const { vault, series } = readSeries(makeVault())
  await new Site(vault, series, { out, search: false }).build()
  const before = snapshot(out)
  await assert.rejects(
    new Site(vault, series, {
      out,
      search: () => Promise.reject(new Error("index failed")),
    }).build(),
    /index failed/,
  )
  assert.deepEqual(snapshot(out), before)
  assert.equal(fs.existsSync(path.join(path.dirname(out), `.${path.basename(out)}.staging`)), false)
})

test("cover pages link a PDF only while it matches the edition's sources", async () => {
  const root = makeVault()
  const out = tempDir("books-shelf-")
  const { vault, series } = readSeries(root)
  const edition = series.books[0]?.edition("zh")
  assert.ok(edition)
  const shelf = PdfShelf.open(path.join(out, "pdf"))
  fs.mkdirSync(path.join(out, "pdf"), { recursive: true })
  fs.writeFileSync(path.join(out, "pdf", "alpha.zh.pdf"), "%PDF")
  fs.writeFileSync(path.join(out, "pdf", "gone.zh.pdf"), "%PDF")
  shelf.record("alpha.zh.pdf", "alpha.zh.pdf", PdfShelf.fingerprint(vault, edition))
  shelf.record("gone.zh.pdf", "gone.zh.pdf", "stale")
  shelf.prune(new Set(["alpha.zh.pdf"]))
  shelf.save()
  assert.equal(fs.existsSync(path.join(out, "pdf", "gone.zh.pdf")), false)

  const cover = () => fs.readFileSync(path.join(out, "zh", "alpha", "index.html"), "utf8")
  await new Site(vault, series, { out, search: false }).build()
  assert.match(cover(), /href="\/pdf\/alpha\.zh\.pdf"/)
  assert.ok(fs.existsSync(path.join(out, "pdf", "alpha.zh.pdf")), "the build keeps the PDF")

  fs.appendFileSync(path.join(root, "alpha", "zh", "01-第一章.md"), "\n新的一段。\n")
  const changed = readSeries(root)
  await new Site(changed.vault, changed.series, { out, search: false }).build()
  assert.doesNotMatch(cover(), /alpha\.zh\.pdf/, "a PDF built from older sources is not linked")
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
