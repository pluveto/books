import assert from "node:assert/strict"
import test from "node:test"
import { FileIndex } from "../../publish/obsidian/file-index.ts"

const index = new FileIndex([
  "series.md",
  "a/book.md",
  "a/zh/00-前言.md",
  "a/zh/01-向量.md",
  "b/zh/00-前言.md",
  "a/assets/figure.svg",
  "b/assets/figure.svg",
  "b/assets/unique.png",
])

test("a unique file name resolves from anywhere", () => {
  assert.deepEqual(index.resolve("01-向量", "b/zh/00-前言.md"), { kind: "found", file: "a/zh/01-向量.md" })
  assert.deepEqual(index.resolve("unique.png", "a/zh/01-向量.md"), {
    kind: "found",
    file: "b/assets/unique.png",
  })
})

test("a name shared by several notes resolves in the linking note's folder first", () => {
  assert.deepEqual(index.resolve("00-前言", "b/zh/00-前言.md"), { kind: "found", file: "b/zh/00-前言.md" })
})

test("an ambiguous name elsewhere lists every candidate", () => {
  assert.deepEqual(index.resolve("figure.svg", "a/zh/01-向量.md"), {
    kind: "ambiguous",
    candidates: ["a/assets/figure.svg", "b/assets/figure.svg"],
  })
})

test("vault paths, relative paths and path suffixes all work", () => {
  assert.deepEqual(index.resolve("a/zh/01-向量", "b/zh/00-前言.md"), {
    kind: "found",
    file: "a/zh/01-向量.md",
  })
  assert.deepEqual(index.resolve("../assets/figure.svg", "a/zh/01-向量.md"), {
    kind: "found",
    file: "a/assets/figure.svg",
  })
  assert.deepEqual(index.resolve("b/assets/figure.svg", "a/zh/01-向量.md"), {
    kind: "found",
    file: "b/assets/figure.svg",
  })
  assert.deepEqual(index.resolve("series", "a/zh/01-向量.md"), { kind: "found", file: "series.md" })
})

test("names match without regard to case, as in Obsidian", () => {
  assert.deepEqual(index.resolve("A/ZH/01-向量", "b/zh/00-前言.md"), {
    kind: "found",
    file: "a/zh/01-向量.md",
  })
  assert.deepEqual(index.resolve("UNIQUE.PNG", "a/zh/01-向量.md"), {
    kind: "found",
    file: "b/assets/unique.png",
  })
  const mixed = new FileIndex(["x/Notes.md", "y/notes.md"])
  assert.deepEqual(mixed.resolve("Notes", "z/a.md"), { kind: "found", file: "x/Notes.md" })
  assert.deepEqual(mixed.resolve("NOTES", "z/a.md"), {
    kind: "ambiguous",
    candidates: ["x/Notes.md", "y/notes.md"],
  })
})

test("relative paths cannot escape the vault and unknown names are missing", () => {
  assert.deepEqual(index.resolve("../../../etc/passwd", "a/zh/01-向量.md"), { kind: "missing" })
  assert.deepEqual(index.resolve("nothing", "a/zh/01-向量.md"), { kind: "missing" })
  assert.deepEqual(index.resolve("  ", "a/zh/01-向量.md"), { kind: "missing" })
})
