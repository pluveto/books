import type { BookStatus } from "./model/book.ts"
import type { LanguageCode } from "./model/language.ts"

export interface Messages {
  readonly htmlLang: string
  readonly ogLocale: string
  readonly languageName: string
  readonly skipToContent: string
  readonly books: string
  readonly contents: string
  readonly openContents: string
  readonly search: string
  readonly searchShortcut: string
  readonly closeSearch: string
  readonly searchUnavailable: string
  /** Name of the search filter that narrows results to one book. */
  readonly searchBookFilter: string
  readonly toggleTheme: string
  readonly switchLanguage: string
  readonly sourceCode: string
  readonly startReading: string
  readonly downloadPdf: string
  readonly previous: string
  readonly next: string
  readonly editPage: string
  readonly comments: string
  /** Shown in place of the comment widget while it loads, and if it never does. */
  readonly commentsUnavailable: string
  readonly copy: string
  readonly copied: string
  readonly frontMatter: string
  readonly footnotes: string
  /** Titles of callouts written without one, by Obsidian callout type. */
  readonly calloutTitles: Readonly<Record<string, string>>
  backToReference(number: number): string
  readonly status: Readonly<Record<BookStatus, string>>
  readonly notFoundTitle: string
  readonly notFoundBody: string
  readonly backToBooks: string
  readonly chooseLanguage: string
  chapter(number: number): string
  chapterCount(count: number): string
  lastUpdated(date: string): string
  /** Text around the two licence links: before the text licence, between them, after the code licence. */
  readonly licenseNotice: readonly [string, string, string]
}

const zh: Messages = {
  htmlLang: "zh-CN",
  ogLocale: "zh_CN",
  languageName: "中文",
  skipToContent: "跳到正文",
  books: "书目",
  contents: "目录",
  openContents: "打开目录",
  search: "搜索",
  searchShortcut: "按 / 搜索",
  closeSearch: "关闭搜索",
  searchUnavailable: "搜索索引没有加载成功。",
  searchBookFilter: "书",
  toggleTheme: "切换深色模式",
  switchLanguage: "切换语言",
  sourceCode: "源代码",
  startReading: "开始阅读",
  downloadPdf: "下载 PDF",
  previous: "上一章",
  next: "下一章",
  editPage: "在 GitHub 上编辑此页",
  comments: "评论",
  commentsUnavailable: "评论区没有加载成功，你也可以直接到 GitHub Discussions 参与讨论。",
  copy: "复制",
  copied: "已复制",
  frontMatter: "前言",
  footnotes: "脚注",
  calloutTitles: {
    note: "注",
    abstract: "摘要",
    info: "说明",
    todo: "待办",
    tip: "提示",
    success: "成功",
    question: "问题",
    warning: "注意",
    failure: "失败",
    danger: "危险",
    bug: "缺陷",
    example: "例",
    quote: "引文",
    definition: "定义",
    theorem: "定理",
    proof: "证明",
    aside: "旁注",
  },
  backToReference: (number) => `返回正文第 ${number} 处引用`,
  status: { draft: "撰写中", complete: "已完成" },
  notFoundTitle: "页面不存在",
  notFoundBody: "你要找的页面不存在，可能已经移动或删除。",
  backToBooks: "返回书目",
  chooseLanguage: "选择语言",
  chapter: (number) => `第 ${number} 章`,
  chapterCount: (count) => `${count} 章`,
  lastUpdated: (date) => `最后更新于 ${date}`,
  licenseNotice: ["正文采用 ", " 授权，示例代码采用 ", " 授权。"],
}

const en: Messages = {
  htmlLang: "en",
  ogLocale: "en_US",
  languageName: "English",
  skipToContent: "Skip to content",
  books: "Books",
  contents: "Contents",
  openContents: "Open contents",
  search: "Search",
  searchShortcut: "Press / to search",
  closeSearch: "Close search",
  searchUnavailable: "The search index could not be loaded.",
  searchBookFilter: "Book",
  toggleTheme: "Toggle dark mode",
  switchLanguage: "Switch language",
  sourceCode: "Source",
  startReading: "Start reading",
  downloadPdf: "Download PDF",
  previous: "Previous",
  next: "Next",
  editPage: "Edit this page on GitHub",
  comments: "Comments",
  commentsUnavailable:
    "The comment section could not be loaded; you can also join the discussion on GitHub Discussions.",
  copy: "Copy",
  copied: "Copied",
  frontMatter: "Preface",
  footnotes: "Footnotes",
  calloutTitles: {
    note: "Note",
    abstract: "Abstract",
    info: "Info",
    todo: "To do",
    tip: "Tip",
    success: "Success",
    question: "Question",
    warning: "Warning",
    failure: "Failure",
    danger: "Danger",
    bug: "Bug",
    example: "Example",
    quote: "Quote",
    definition: "Definition",
    theorem: "Theorem",
    proof: "Proof",
    aside: "Aside",
  },
  backToReference: (number) => `Back to reference ${number}`,
  status: { draft: "In progress", complete: "Complete" },
  notFoundTitle: "Page not found",
  notFoundBody: "The page you are looking for does not exist. It may have moved or been removed.",
  backToBooks: "Back to the books",
  chooseLanguage: "Choose a language",
  chapter: (number) => `Chapter ${number}`,
  chapterCount: (count) => (count === 1 ? "1 chapter" : `${count} chapters`),
  lastUpdated: (date) => `Last updated ${date}`,
  licenseNotice: ["Text licensed under ", "; code samples under ", "."],
}

const MESSAGES: Readonly<Record<LanguageCode, Messages>> = { zh, en }

export function messages(language: LanguageCode): Messages {
  return MESSAGES[language]
}
