import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { PublishError } from "../../publish/errors.ts"
import { FolderSwap } from "../../publish/site/folder-swap.ts"
import { OUTPUT } from "../../publish/site/protocol.ts"
import { tempDir } from "../support/fixture.ts"
import { BuiltSite } from "../support/site-audit.ts"

function site(root: string, files: Record<string, string>) {
  for (const [file, content] of Object.entries({ [OUTPUT.marker]: "", ...files })) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), content)
  }
}

function tree(root: string): Record<string, string> {
  return Object.fromEntries(
    BuiltSite.walk(root).map((file) => [file, fs.readFileSync(path.join(root, file), "utf8")]),
  )
}

function setup() {
  const parent = tempDir("books-swap-")
  const out = path.join(parent, "dist")
  const staging = FolderSwap.scratch(out, "staging")
  site(out, { "index.html": "old", "pdf/a.pdf": "pdf" })
  site(staging, { "index.html": "new" })
  return { out, staging }
}

test("the new site replaces the old one and keeps its PDFs", () => {
  const { out, staging } = setup()
  new FolderSwap().replace(out, staging, [OUTPUT.pdf])
  assert.deepEqual(tree(out), { [OUTPUT.marker]: "", "index.html": "new", "pdf/a.pdf": "pdf" })
  assert.equal(fs.existsSync(staging), false)
  assert.equal(fs.existsSync(FolderSwap.scratch(out, "previous")), false)
})

test("a failing rename at any step leaves the old site exactly as it was", () => {
  for (const failing of [1, 2, 3]) {
    const { out, staging } = setup()
    const before = tree(out)
    let calls = 0
    const swap = new FolderSwap((from, to) => {
      if (++calls === failing) throw Object.assign(new Error("locked"), { code: "EPERM" })
      fs.renameSync(from, to)
    })
    assert.throws(() => swap.replace(out, staging, [OUTPUT.pdf]), PublishError, `step ${failing}`)
    assert.deepEqual(tree(out), before, `step ${failing} restored the old site`)
    assert.equal(
      fs.existsSync(FolderSwap.scratch(out, "previous")),
      false,
      `step ${failing} left no previous`,
    )
  }
})

test("a run killed mid-swap is repaired before the next build touches anything", () => {
  const afterCarry = setup()
  fs.renameSync(path.join(afterCarry.out, "pdf"), path.join(afterCarry.staging, "pdf"))
  new FolderSwap().recover(afterCarry.out, afterCarry.staging, [OUTPUT.pdf])
  assert.deepEqual(tree(afterCarry.out), { [OUTPUT.marker]: "", "index.html": "old", "pdf/a.pdf": "pdf" })

  const afterRetire = setup()
  fs.renameSync(path.join(afterRetire.out, "pdf"), path.join(afterRetire.staging, "pdf"))
  fs.renameSync(afterRetire.out, FolderSwap.scratch(afterRetire.out, "previous"))
  new FolderSwap().recover(afterRetire.out, afterRetire.staging, [OUTPUT.pdf])
  assert.deepEqual(tree(afterRetire.out), { [OUTPUT.marker]: "", "index.html": "old", "pdf/a.pdf": "pdf" })
  assert.equal(fs.existsSync(FolderSwap.scratch(afterRetire.out, "previous")), false)
})

test("scratch folders are deleted only when this publisher made them", () => {
  const parent = tempDir("books-scratch-")
  const foreign = path.join(parent, "foreign")
  fs.mkdirSync(foreign)
  fs.writeFileSync(path.join(foreign, "keep.txt"), "mine")
  assert.throws(() => FolderSwap.discard(foreign), /Refusing to delete/)
  assert.ok(fs.existsSync(path.join(foreign, "keep.txt")))
  const ours = path.join(parent, "ours")
  site(ours, { "x.html": "" })
  FolderSwap.discard(ours)
  assert.equal(fs.existsSync(ours), false)
})
