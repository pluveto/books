import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { parseArgs } from "node:util"
import { PreviewServer } from "./dev/preview-server.ts"
import { MissingToolError, PublishError } from "./errors.ts"
import { isLanguage, type LanguageCode } from "./model/language.ts"
import type { Series } from "./model/series.ts"
import { ObsidianPreamble } from "./obsidian/preamble.ts"
import { SeriesReader } from "./obsidian/series-reader.ts"
import { Vault } from "./obsidian/vault.ts"
import { PdfBook } from "./pdf/pdf-book.ts"
import { MarkdownParser } from "./render/parser.ts"
import { PdfShelf } from "./site/pdf-shelf.ts"
import { OUTPUT } from "./site/protocol.ts"
import { Routes } from "./site/routes.ts"
import { Site } from "./site/site.ts"

const USAGE = `Usage: npm run <command> -- [options]

Commands:
  build     Build the website into --out
  dev       Build, serve on --port and rebuild when the vault changes
  serve     Serve an existing build on --port
  pdf       Build PDFs into --out/pdf (needs Pandoc, XeLaTeX and rsvg-convert)
  preamble  Write vault/preamble.sty with every book's macros for Obsidian's preview

Options:
  --vault <dir>     Obsidian vault (default: vault)
  --out <dir>       Output folder (default: dist)
  --site-url <url>  Public URL of the site root (default: site_url in series.md)
  --port <n>        Port for dev and serve (default: 4173)
  --book <slug>     pdf: only this book
  --lang <code>     pdf: only this language
  --no-search       build: skip the Pagefind index`

const EXIT = { ok: 0, content: 1, tool: 2, usage: 64 } as const

const COMMANDS = ["build", "dev", "serve", "pdf", "preamble"] as const

type Command = (typeof COMMANDS)[number]

function isCommand(value: string | undefined): value is Command {
  return COMMANDS.some((command) => command === value)
}

interface Options {
  readonly vault: string
  readonly out: string
  readonly siteUrl: URL | undefined
  readonly port: number
  readonly book: string | undefined
  readonly language: LanguageCode | undefined
  readonly search: boolean
}

/** One invocation of the publisher: a command and its options. */
export class PublishCommand {
  private constructor(
    private readonly command: Command,
    private readonly options: Options,
  ) {}

  static async run(argv: readonly string[]): Promise<number> {
    let invocation: PublishCommand
    try {
      invocation = PublishCommand.parse(argv)
    } catch (error) {
      console.error(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`)
      return EXIT.usage
    }
    try {
      await invocation.execute()
      return EXIT.ok
    } catch (error) {
      if (!(error instanceof PublishError)) throw error
      console.error(`error: ${error.describe(invocation.vaultLabel)}`)
      return error instanceof MissingToolError ? EXIT.tool : EXIT.content
    }
  }

  private static parse(argv: readonly string[]): PublishCommand {
    const { values, positionals } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      allowNegative: true,
      options: {
        vault: { type: "string", default: "vault" },
        out: { type: "string", default: "dist" },
        "site-url": { type: "string" },
        port: { type: "string", default: "4173" },
        book: { type: "string" },
        lang: { type: "string" },
        search: { type: "boolean", default: true },
      },
    })
    const command = positionals[0]
    if (!isCommand(command)) throw new Error(command ? `unknown command "${command}"` : "missing command")
    const port = Number(values.port)
    if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`invalid --port ${values.port}`)
    const siteUrl = values["site-url"]
    if (siteUrl !== undefined && !URL.canParse(siteUrl)) throw new Error(`invalid --site-url ${siteUrl}`)
    const language = values.lang
    if (language !== undefined && !isLanguage(language)) throw new Error(`unsupported --lang ${language}`)
    return new PublishCommand(command, {
      vault: path.resolve(values.vault),
      out: path.resolve(values.out),
      siteUrl: siteUrl === undefined ? undefined : new URL(siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`),
      port,
      book: values.book,
      language,
      search: values.search,
    })
  }

  /** The vault folder as the user typed it, for error locations. */
  private get vaultLabel(): string {
    const relative = path.relative(process.cwd(), this.options.vault)
    return relative && !relative.startsWith("..") ? relative.split(path.sep).join("/") : this.options.vault
  }

  private async execute(): Promise<void> {
    switch (this.command) {
      case "build":
        await this.build(this.options, false)
        return
      case "dev":
        return this.dev()
      case "serve":
        await this.serve(this.options, this.routes(this.options).base)
        return
      case "pdf":
        return this.pdf()
      case "preamble":
        return this.preamble()
    }
  }

  private read(): { vault: Vault; series: Series } {
    const vault = Vault.open(this.options.vault)
    return { vault, series: new SeriesReader(vault, new MarkdownParser()).read() }
  }

  private routes(options: Options): Routes {
    return new Routes(options.siteUrl ?? this.read().series.settings.siteUrl)
  }

  private async build(options: Options, liveReload: boolean): Promise<void> {
    const started = performance.now()
    const { vault, series } = this.read()
    const report = await new Site(vault, series, {
      out: options.out,
      siteUrl: options.siteUrl,
      search: options.search ? undefined : false,
      liveReload,
    }).build()
    const seconds = ((performance.now() - started) / 1000).toFixed(1)
    console.log(`Built ${report.pages} pages (${report.files} files) into ${options.out} in ${seconds}s.`)
  }

  private async serve(options: Options, base: string): Promise<PreviewServer> {
    if (!fs.existsSync(path.join(options.out, "index.html"))) {
      throw new PublishError(`Nothing to serve in ${options.out}; run npm run build first.`)
    }
    const server = new PreviewServer(options.out, base)
    console.log(`Serving ${options.out} at ${await server.listen(options.port)}`)
    return server
  }

  /** Keeps serving through broken intermediate states: every rebuild error is printed, none is fatal. */
  private async dev(): Promise<void> {
    const local: Options = { ...this.options, siteUrl: new URL(`http://127.0.0.1:${this.options.port}/`) }
    await this.build(local, true)
    const server = await this.serve(local, "/")
    const publishDir = path.dirname(fileURLToPath(import.meta.url))
    const watched = [
      local.vault,
      path.join(publishDir, "site", "styles"),
      path.join(publishDir, "site", "client"),
    ]
    let timer: NodeJS.Timeout | undefined
    let queue = Promise.resolve()
    const rebuild = () => {
      queue = queue.then(async () => {
        try {
          await this.build(local, true)
          server.reload()
        } catch (error) {
          console.error(
            `error: ${error instanceof PublishError ? error.describe(this.vaultLabel) : String(error)}`,
          )
        }
      })
    }
    for (const folder of watched) {
      fs.watch(folder, { recursive: true }, (_event, name) => {
        if (name && /(^|[\\/])\.obsidian[\\/]workspace/.test(name)) return
        clearTimeout(timer)
        timer = setTimeout(rebuild, 150)
      })
    }
    console.log("Watching the vault for changes. Press Ctrl+C to stop.")
    await new Promise(() => undefined)
  }

  private async pdf(): Promise<void> {
    const { vault, series } = this.read()
    const { book, language } = this.options
    const editions = series.books
      .filter((item) => !book || item.slug === book)
      .flatMap((item) => item.editions)
      .filter((edition) => !language || edition.language === language)
    if (!editions.length)
      throw new PublishError(`No edition matches --book ${book ?? "*"} --lang ${language ?? "*"}.`)
    const routes = new Routes(this.options.siteUrl ?? series.settings.siteUrl)
    const folder = path.join(this.options.out, OUTPUT.pdf)
    const shelf = PdfShelf.open(folder)
    for (const edition of editions) {
      const name = routes.pdfName(edition)
      await new PdfBook(vault, series, edition, routes).write(path.join(folder, name))
      shelf.record(name, name, PdfShelf.fingerprint(vault, edition))
      console.log(`Wrote ${path.relative(process.cwd(), path.join(folder, name))}`)
    }
    const existing = new Set(
      series.books.flatMap((item) => item.editions).map((edition) => routes.pdfName(edition)),
    )
    shelf.prune(book || language ? existing : new Set(editions.map((edition) => routes.pdfName(edition))))
    shelf.save()
  }

  private preamble(): void {
    const { vault, series } = this.read()
    const result = new ObsidianPreamble(series).write(vault)
    for (const conflict of result.conflicts) console.warn(`warning: ${conflict}`)
    console.log(`Wrote ${path.relative(process.cwd(), result.file)}`)
  }
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(path.resolve(entry)).href) {
  process.exitCode = await PublishCommand.run(process.argv.slice(2))
}
