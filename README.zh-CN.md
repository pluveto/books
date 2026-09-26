# Less Bug 丛书

[English](README.md)

一套开放教材：在 [Obsidian](https://obsidian.md) 里写作，发布成同一套设计的网站。目前的三本书《线性代数》《微积分》《概率与统计》是占位书，用中英两种语言走通整条管线。

- 公式在**构建时**由 MathJax 排成 SVG，浏览器不再解析 TeX。
- Obsidian 语法（维基链接、嵌入、提示块、高亮、注释）由 [Quartz](https://quartz.jzhao.xyz/) 的转换插件渲染，但不把 Quartz 整站搬进仓库。
- 代码在构建时由 Shiki 高亮；搜索是静态的 [Pagefind](https://pagefind.app/) 索引；站点不向任何外部域名发请求。
- 整条工具链都是 Node.js 上的 TypeScript，Windows、macOS、Ubuntu 用同样的命令。

## 快速开始

需要 Node.js 22.12 或更新版本。

```sh
npm ci
npm run dev      # 构建并在 http://127.0.0.1:4173/ 预览，保存即重建
npm run build    # 生成 dist/
```

PDF 是可选的，需要 [Pandoc](https://pandoc.org/)、XeLaTeX（中文需要 `ctex`）、`rsvg-convert`，以及 _Noto Serif CJK SC_ 和 _DejaVu Sans Mono_ 两种字体（可用 `BOOKS_CJK_FONT`、`BOOKS_MONO_FONT` 替换）；Ubuntu 上要装的包列在 `.github/pdf-packages.txt`。字体印不出的字符会让构建失败。

```sh
npm run pdf                                  # 所有版本，输出到 dist/pdf/
npm run pdf -- --book calculus --lang zh     # 只生成一本书的一个语言版本
```

之后再运行 `npm run build` 会保留 `dist/pdf/`，并在书的封面页放上下载链接——前提是生成 PDF 所依据的内容（vault 里任何文件、发布器的 PDF 代码、站点地址）此后都没变；变了就重新运行 `npm run pdf`。缺少工具时，命令以退出码 2 结束并指出缺什么；装有 fontconfig 的系统上，缺字体也是如此（其他系统由 XeLaTeX 报错）。构建只会替换它自己生成的输出目录。

## 写作

用 Obsidian 打开 `vault/`。

```text
vault/
  series.md                  站点地址、语言、书目顺序、许可证，以及各语言的丛书名和简介
  linear-algebra/            一本书一个文件夹，文件夹名就是网址里的 slug
    book.md                  主题色、封面、状态、TeX 宏，以及各语言的书名、副标题、简介
    cover.svg
    assets/vector.svg        各语言共用的插图
    zh/00-前言.md             章节，NN-名字.md，平铺在语言文件夹里
    en/01-vectors.md
```

- **章节**文件名是 `NN-名字.md`，`00` 是前言。正文第一行是一级标题，也就是章名；每章只能有这一个一级标题。两个语言文件夹里编号相同的章节互为译本，语言切换和 `hreflang` 按编号配对。
- **Frontmatter** 会被检查：`series.md`、`book.md` 和章节只接受文档里列出的键（章节可用 `description`，以及 Obsidian 自己的 `tags`、`aliases`、`cssclasses`），拼错的键会报错而不是被忽略。
- **插图**：Obsidian 粘贴的图片会放进当前笔记旁的 `assets/`；要让各语言共用，就把它移到 `<书>/assets/`。
- **链接**按 Obsidian 的规则解析：`[[01-向量]]`、`[[01-向量#线性组合]]`、`[[01-向量#线性组合|别名]]`、`[[#本页标题]]`、`[[linear-algebra/book]]`，以及指向 `.md` 的普通 Markdown 链接。短名要么在当前笔记所在的文件夹里，要么在全库唯一；否则写路径——和 Obsidian 自己插入链接的方式一样。
- **嵌入**只支持图片：`![[vector.svg|320]]`、`![[photo.png|替代文字|640x480]]`。
- **公式**用 `$…$` 和 `$$…$$`。宏写在该书的 `book.md` 里，只能用 `\newcommand` 或 `\renewcommand`，这样网页和 PDF 读的是同一份定义。要在 Obsidian 预览里看到这些宏，安装社区插件 _Extended MathJax_，再运行 `npm run preamble`，它会把所有书的宏写进 `vault/preamble.sty`。
- **提示块**用 Obsidian 语法，包括可折叠的 `> [!proof]-`。除了 Obsidian 自带的类型，主题还为 `definition`、`theorem`、`proof` 配了样式；其他类型用中性配色。
- **主题色**与白色的对比度必须达到 4.5:1，否则构建会提示。

凡是没法如实渲染的内容——找不到的链接、不存在的标题、MathJax 排不出的公式、命名不对的章节——构建都会停下，并指出文件和行号。

## 检查

```sh
npm run check     # TypeScript、ESLint、Prettier
npm test          # 单元测试，以及一次完整构建的死链、SEO 标签和可复现性检查
npm run test:e2e  # Playwright + axe：亮色和深色、桌面和手机，都要达到 WCAG 2.1 AA
```

CI 在 Ubuntu、Windows、macOS 上跑以上全部检查，在 Ubuntu 上构建并检查 PDF；只有全部任务通过，才会把 `main` 部署到 GitHub Pages。「做完」的定义见 [docs/acceptance.md](docs/acceptance.md)，代码结构见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 致谢

- 阅读版式源自欧长坤的[《现代 C++ 教程》](https://github.com/changkun/modern-cpp-tutorial)（MIT）。
- Obsidian 语法、公式和代码高亮来自 [Quartz](https://github.com/jackyzha0/quartz) 社区插件 [obsidian-flavored-markdown](https://github.com/quartz-community/obsidian-flavored-markdown)、[latex](https://github.com/quartz-community/latex)、[syntax-highlighting](https://github.com/quartz-community/syntax-highlighting)。
- 构建依赖 [MathJax](https://www.mathjax.org/)、[Shiki](https://shiki.style/)、[Pagefind](https://pagefind.app/)、[unified](https://unifiedjs.com/)、[Preact](https://preactjs.com/)。

## 许可证

发布器采用 MIT，见 [LICENSE](LICENSE)。书的正文采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，书中的示例代码采用 MIT。
