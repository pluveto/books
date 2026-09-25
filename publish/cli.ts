import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { parseArgs } from "node:util"
import { PreviewServer } from "./dev/preview-server.ts"
import { MissingToolError, PublishError } from "./errors.ts"
import { isLanguage, type LanguageCode } from "./model/language.ts"
import type { Series } from "./model/series.ts"
import { SeriesReader } from "./obsidian/series-reader.ts"
import { Vault } from "./obsidian/vault.ts"
import { PdfBook } from "./pdf/pdf-book.ts"
import { MarkdownParser } from "./render/parser.ts"
import { Routes } from "./site/routes.ts"
import { PDF_FOLDER, Site } from "./site/site.ts"

const USAGE = `Usage: npm run <command> -- [options]

Commands:
  build   Build the website into --out
  dev     Build, serve on --port and rebuild when the vault changes
  serve   Serve an existing build on --port
  pdf     Build PDFs into --out/pdf (needs Pandoc and XeLaTeX)

Options:
  --vault <dir>     Obsidian vault (default: vault)
  --out <dir>       Output folder (default: dist)
  --site-url <url>  Public URL of the site root (default: site_url in series.md)
  --port <n>        Port for dev and serve (default: 4173)
  --book <slug>     pdf: only this book
  --lang <code>     pdf: only this language
  --no-search       build: skip the Pagefind index`

const EXIT = { ok: 0, content: 1, usage: 64, tool: 2 } as const

const COMMANDS = ["build", "dev", "serve", "pdf"] as const

type Command = (typeof COMMANDS)[number]

interface Options {
  readonly vault: string
  readonly out: string
  readonly siteUrl: URL | undefined
  readonly port: number
  readonly book: string | undefined
  readonly language: LanguageCode | undefined
  readonly search: boolean
}

export class PublishCommand {
  static async run(argv: readonly string[]): Promise<number> {
    let command: Command
    let options: Options
    try {
      ;({ command, options } = PublishCommand.parse(argv))
    } catch (error) {
      console.error(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`)
      return EXIT.usage
    }
    try {
      switch (command) {
        case "build":
          await PublishCommand.build(options)
          return EXIT.ok
        case "dev":
          await PublishCommand.dev(options)
          return EXIT.ok
        case "serve":
          await PublishCommand.serve(options)
          return EXIT.ok
        case "pdf":
          await PublishCommand.pdf(options)
          return EXIT.ok
      }
    } catch (error) {
      if (error instanceof PublishError) {
        console.error(`error: ${error.describe()}`)
        return error instanceof MissingToolError ? EXIT.tool : EXIT.content
      }
      throw error
    }
  }

  private static parse(argv: readonly string[]): { command: Command; options: Options } {
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
    const port = Number(values.port)
    if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`invalid --port ${values.port}`)
    const siteUrl = values["site-url"]
    if (siteUrl !== undefined && !URL.canParse(siteUrl)) throw new Error(`invalid --site-url ${siteUrl}`)
    const language = values.lang
    if (language !== undefined && !isLanguage(language)) throw new Error(`unsupported --lang ${language}`)
    const command = positionals[0]
    if (!COMMANDS.some((known) => known === command)) {
      throw new Error(command ? `unknown command "${command}"` : "missing command")
    }
    return {
      command: command as Command,
      options: {
        vault: path.resolve(values.vault),
        out: path.resolve(values.out),
        siteUrl: siteUrl === undefined ? undefined : new URL(siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`),
        port,
        book: values.book,
        language,
        search: values.search,
      },
    }
  }

  private static read(options: Options): { vault: Vault; series: Series } {
    const vault = Vault.open(options.vault)
    return { vault, series: new SeriesReader(vault, new MarkdownParser()).read() }
  }

  private static async build(options: Options, liveReload = false) {
    const started = performance.now()
    const { vault, series } = PublishCommand.read(options)
    const report = await new Site(vault, series, {
      out: options.out,
      siteUrl: options.siteUrl,
      search: options.search,
      liveReload,
    }).build()
    const seconds = ((performance.now() - started) / 1000).toFixed(1)
    console.log(`Built ${report.pages} pages (${report.files} files) into ${options.out} in ${seconds}s.`)
    return series
  }

  private static async serve(options: Options, liveReload = false): Promise<PreviewServer> {
    const index = path.join(options.out, "index.html")
    if (!fs.existsSync(index))
      throw new PublishError(`Nothing to serve in ${options.out}; run npm run build first.`)
    const base = liveReload
      ? "/"
      : new Routes(options.siteUrl ?? PublishCommand.read(options).series.settings.siteUrl).base
    const server = new PreviewServer(options.out, base)
    const url = await server.listen(options.port)
    console.log(`Serving ${options.out} at ${url}`)
    return server
  }

  private static async dev(options: Options) {
    const local = { ...options, siteUrl: new URL(`http://127.0.0.1:${options.port}/`) }
    await PublishCommand.build(local, true)
    const server = await PublishCommand.serve(local, true)
    const publishDir = path.dirname(fileURLToPath(import.meta.url))
    const watched = [
      options.vault,
      path.join(publishDir, "site", "styles"),
      path.join(publishDir, "site", "client"),
    ]
    let timer: NodeJS.Timeout | undefined
    let running = Promise.resolve()
    const rebuild = () => {
      running = running.then(async () => {
        try {
          await PublishCommand.build(local, true)
          server.reload()
        } catch (error) {
          if (!(error instanceof PublishError)) throw error
          console.error(`error: ${error.describe()}`)
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

  private static async pdf(options: Options) {
    const { vault, series } = PublishCommand.read(options)
    const editions = series.books
      .filter((book) => !options.book || book.slug === options.book)
      .flatMap((book) => book.editions)
      .filter((edition) => !options.language || edition.language === options.language)
    if (!editions.length)
      throw new PublishError(
        `No edition matches --book ${options.book ?? "*"} --lang ${options.language ?? "*"}.`,
      )
    const routes = new Routes(options.siteUrl ?? series.settings.siteUrl)
    const folder = path.join(options.out, PDF_FOLDER)
    for (const edition of editions) {
      const output = path.join(folder, routes.pdfName(edition))
      await new PdfBook(vault, series, edition, routes).write(output)
      console.log(`Wrote ${path.relative(process.cwd(), output)}`)
    }
  }
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(path.resolve(entry)).href) {
  process.exitCode = await PublishCommand.run(process.argv.slice(2))
}
