import assert from "node:assert/strict"
import test from "node:test"
import { PublishError } from "../../publish/errors.ts"
import { BOOK_MD, makeVault, readSeries, SERIES_MD } from "../support/fixture.ts"

const COMMENTS = `comments:
  repo: example/books
  repo_id: R_example
  category: Announcements
  category_id: DIC_example
`

function rejects(files: Record<string, string | null>, message: RegExp, where?: string) {
  assert.throws(
    () => readSeries(makeVault(files)),
    (error: unknown) => {
      assert.ok(error instanceof PublishError, `expected PublishError, got ${String(error)}`)
      assert.match(error.message, message)
      if (where) assert.equal(error.describe().split(": ")[0], where)
      return true
    },
  )
}

test("a valid vault becomes a series of books, editions and chapters", () => {
  const { series } = readSeries(makeVault())
  assert.deepEqual(series.languages, ["zh", "en"])
  const [book] = series.books
  assert.ok(book)
  assert.equal(book.slug, "alpha")
  assert.deepEqual(
    book.editions.map((edition) => [edition.language, edition.title, edition.chapters.map((c) => c.title)]),
    [
      ["zh", "甲书", ["前言", "第一章"]],
      ["en", "Alpha", ["Preface", "First"]],
    ],
  )
  const chapter = book.edition("zh")?.chapter(1)
  assert.ok(chapter)
  assert.equal(series.locate("alpha/zh/01-第一章.md").kind, "chapter")
  assert.equal(series.locate("alpha/book.md").kind, "book")
  assert.equal(series.locate("series.md").kind, "series")
  assert.equal(series.locate("alpha/cover.svg").kind, "media")
  assert.equal(series.settings.siteUrl.href, "https://books.example.org/")
})

test("series.md problems name the key", () => {
  rejects({ "series.md": SERIES_MD.replace("languages: [zh, en]", "languages: [zh, fr]") }, /language "fr"/)
  rejects({ "series.md": SERIES_MD.replace("site_url: https://books.example.org\n", "") }, /site_url/)
  rejects({ "series.md": SERIES_MD.replace("books: [alpha]", "books: [alpha, beta]") }, /beta\/book\.md/)
  rejects(
    { "beta/book.md": BOOK_MD },
    /"beta" has a book\.md but is missing from "books"/,
    "vault/series.md:5",
  )
  rejects(
    { "series.md": SERIES_MD.replace("\nen:\n  title: Test Books\n  tagline: For tests.\n", "\n") },
    /"en" section/,
  )
})

test("book.md problems are caught before anything is written", () => {
  rejects({ "alpha/book.md": BOOK_MD.replace("#1f4e5f", "#ffd966") }, /contrast .* against white/)
  rejects({ "alpha/book.md": BOOK_MD.replace("cover.svg", "missing.svg") }, /"cover" must name an image/)
  rejects({ "alpha/book.md": BOOK_MD.replace("status: draft", "status: wip") }, /"status" must be one of/)
  rejects({ "alpha/book.md": BOOK_MD.replace("\\newcommand", "\\def") }, /"macros"/)
  rejects({ "alpha/en/00-preface.md": null, "alpha/en/01-first.md": null }, /"en" section but no alpha\/en\//)
  rejects({ "alpha/fr/01-un.md": "# Un\n" }, /"fr" is not a language/)
  rejects({ "alpha/stray.md": "# Stray\n" }, /language folder/, "vault/alpha/stray.md")
})

test("comments are optional, and a configured thread names a repository and a category", () => {
  assert.equal(readSeries(makeVault()).series.settings.comments, undefined)
  const { series } = readSeries(makeVault({ "series.md": SERIES_MD.replace("zh:\n", `${COMMENTS}zh:\n`) }))
  assert.deepEqual(series.settings.comments, {
    repo: "example/books",
    repoId: "R_example",
    category: "Announcements",
    categoryId: "DIC_example",
  })
  const broken = (block: string) => ({ "series.md": SERIES_MD.replace("zh:\n", `${block}zh:\n`) })
  rejects(broken(COMMENTS.replace("example/books", "books")), /"repo" must look like "owner\/name"/)
  rejects(broken(COMMENTS.replace("  repo_id: R_example\n", "")), /"comments.repo_id" is required/)
  rejects(broken(COMMENTS.replace("  category:", "  catgory:")), /did you mean "comments.category"\?/)
})

test("frontmatter problems point at the key's line and suggest the intended key", () => {
  rejects(
    { "alpha/book.md": BOOK_MD.replace('color: "#1f4e5f"', 'color: "#ffd966"') },
    /"color" #ffd966 has contrast/,
    "vault/alpha/book.md:2",
  )
  rejects(
    { "alpha/book.md": BOOK_MD.replace("  description: Blurb.", "  descripton: Blurb.") },
    /unknown key "en.descripton"; did you mean "en.description"\?/,
    "vault/alpha/book.md:14",
  )
  rejects(
    { "alpha/zh/02-多余.md": "---\nsumary: x\n---\n# 多余\n" },
    /unknown key "sumary"/,
    "vault/alpha/zh/02-多余.md:2",
  )
  rejects(
    { "series.md": SERIES_MD.replace("languages: [zh, en]", "languages: [zh]") },
    /"en" section but "en" is not in "languages"/,
    "vault/series.md:13",
  )
})

test("chapter problems point at the file and line", () => {
  rejects({ "alpha/zh/1-坏名字.md": "# 坏\n" }, /01-name\.md/, "vault/alpha/zh/1-坏名字.md")
  rejects({ "alpha/zh/01-重复.md": "# 重复\n" }, /also used by/)
  rejects({ "alpha/zh/sub/02-嵌套.md": "# 嵌套\n" }, /directly in alpha\/zh/)
  rejects(
    { "alpha/zh/02-无标题.md": "---\ndescription: x\n---\n\n正文\n\n## 小节\n" },
    /level-1 heading/,
    "vault/alpha/zh/02-无标题.md:7",
  )
  rejects(
    { "alpha/zh/02-两个.md": "# 一\n\n# 二\n" },
    /only the chapter title/,
    "vault/alpha/zh/02-两个.md:3",
  )
  rejects({ "alpha/zh/02-坏.md": "---\ndescription: [\n---\n# 坏\n" }, /invalid YAML/)
})
