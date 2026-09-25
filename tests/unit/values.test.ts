import assert from "node:assert/strict"
import test from "node:test"
import { AccentColor } from "../../publish/model/accent.ts"
import { MacroError, MacroSet } from "../../publish/model/macro-set.ts"
import { Outline } from "../../publish/model/outline.ts"
import { MarkdownParser } from "../../publish/render/parser.ts"

test("macros become a MathJax table and keep their TeX source", () => {
  const macros = MacroSet.parse(
    "\\newcommand{\\R}{\\mathbb{R}}\n% comment\n\\renewcommand*{\\norm}[1]{\\lVert #1 \\rVert}",
  )
  assert.deepEqual(macros.mathjax(), { R: "\\mathbb{R}", norm: ["\\lVert #1 \\rVert", 1] })
  assert.match(macros.tex, /\\renewcommand\*\{\\norm\}/)
  assert.deepEqual(MacroSet.parse("  ").mathjax(), {})
})

test("macros that only one renderer understands are rejected", () => {
  assert.throws(() => MacroSet.parse("\\def\\R{\\mathbb{R}}"), MacroError)
  assert.throws(() => MacroSet.parse("\\newcommand{\\R}{\\mathbb{R}"), /unbalanced/)
  assert.throws(() => MacroSet.parse("\\newcommand{R}{x}"), /invalid macro name/)
})

test("accent colours are checked against WCAG contrast", () => {
  const teal = AccentColor.parse("#1f4e5f")
  assert.ok(teal)
  assert.ok(teal.contrastWith(AccentColor.WHITE) >= AccentColor.MIN_CONTRAST)
  assert.ok(teal.onDarkSurface().contrastWith(AccentColor.DARK_SURFACE) >= AccentColor.MIN_CONTRAST)
  assert.equal(AccentColor.parse("#abc")?.hex, "#aabbcc")
  assert.equal(AccentColor.parse("teal"), undefined)
  const pale = AccentColor.parse("#ffd966")
  assert.ok(pale && pale.contrastWith(AccentColor.WHITE) < AccentColor.MIN_CONTRAST)
})

test("outline slugs match GitHub's and ignore headings inside code", () => {
  const tree = new MarkdownParser().parse(
    "# 标题\n\n## 矩阵乘法\n\n```md\n## not a heading\n```\n\n## 矩阵乘法\n\n### Linear $x$ map\n",
  )
  const outline = Outline.of(tree)
  assert.deepEqual(
    outline.headings.map((heading) => [heading.depth, heading.slug]),
    [
      [1, "标题"],
      [2, "矩阵乘法"],
      [2, "矩阵乘法-1"],
      [3, "linear-x-map"],
    ],
  )
  assert.equal(outline.title?.text, "标题")
  assert.equal(outline.find("矩阵乘法")?.slug, "矩阵乘法")
  assert.equal(outline.find("  LINEAR x   map ")?.slug, "linear-x-map")
  assert.equal(outline.sections.length, 3)
})
