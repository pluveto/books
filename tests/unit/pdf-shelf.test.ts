import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { PdfShelf } from "../../publish/pdf/pdf-shelf.ts"
import { makeVault, readSeries, tempDir } from "../support/fixture.ts"

const SITE = new URL("https://books.example.org/")

test("the fingerprint changes with the fonts the PDF build is told to use", () => {
  const { vault } = readSeries(makeVault())
  const saved = process.env.BOOKS_MONO_FONT
  try {
    delete process.env.BOOKS_MONO_FONT
    const plain = PdfShelf.fingerprint(vault, SITE)
    process.env.BOOKS_MONO_FONT = "Fira Mono"
    assert.notEqual(PdfShelf.fingerprint(vault, SITE), plain)
  } finally {
    if (saved === undefined) delete process.env.BOOKS_MONO_FONT
    else process.env.BOOKS_MONO_FONT = saved
  }
})

test("a damaged manifest is an empty shelf, and saving replaces it whole", () => {
  const folder = tempDir("books-manifest-")
  fs.writeFileSync(path.join(folder, "a.pdf"), "%PDF")
  fs.writeFileSync(path.join(folder, PdfShelf.MANIFEST), '{"a.pdf": {"file": "a.pdf", "finger')
  const shelf = PdfShelf.open(folder)
  assert.deepEqual([...shelf.current(["a.pdf"], "x")], [])
  shelf.record("a.pdf", "a.pdf", "x")
  shelf.save()
  assert.deepEqual(fs.readdirSync(folder).sort(), ["a.pdf", PdfShelf.MANIFEST])
  assert.deepEqual([...PdfShelf.open(folder).current(["a.pdf"], "x")], ["a.pdf"])
})
