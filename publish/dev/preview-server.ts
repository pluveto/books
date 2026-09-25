import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import { RELOAD_PATH } from "../site/protocol.ts"

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".wasm": "application/wasm",
}

/**
 * Serves a built site the way GitHub Pages does: under its base path, directories via
 * index.html, and 404.html for anything missing. `reload()` refreshes connected pages.
 */
export class PreviewServer {
  private readonly clients = new Set<http.ServerResponse>()
  private readonly server = http.createServer((request, response) => this.handle(request, response))

  constructor(
    private readonly root: string,
    private readonly base: string,
  ) {}

  listen(port: number, host = "127.0.0.1"): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server.once("error", reject)
      this.server.listen(port, host, () => resolve(`http://${host}:${port}${this.base}`))
    })
  }

  reload() {
    for (const client of this.clients) client.write("data: reload\n\n")
  }

  close(): Promise<void> {
    for (const client of this.clients) client.end()
    return new Promise((resolve) => this.server.close(() => resolve()))
  }

  private handle(request: http.IncomingMessage, response: http.ServerResponse) {
    const url = new URL(request.url ?? "/", "http://localhost")
    if (url.pathname === RELOAD_PATH) return this.subscribe(response)
    if (!url.pathname.startsWith(this.base)) {
      response.writeHead(302, { location: this.base }).end()
      return
    }
    let relative: string
    try {
      relative = decodeURIComponent(url.pathname.slice(this.base.length))
    } catch {
      return this.notFound(response)
    }
    const target = path.resolve(this.root, relative)
    if (target !== this.root && !target.startsWith(this.root + path.sep)) return this.notFound(response)
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      if (!url.pathname.endsWith("/")) {
        response.writeHead(301, { location: `${url.pathname}/${url.search}` }).end()
        return
      }
      return this.send(response, path.join(target, "index.html"), 200)
    }
    this.send(response, target, 200)
  }

  private send(response: http.ServerResponse, file: string, status: number) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return this.notFound(response)
    const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream"
    response.writeHead(status, { "content-type": type, "cache-control": "no-store" })
    fs.createReadStream(file).pipe(response)
  }

  private notFound(response: http.ServerResponse) {
    const page = path.join(this.root, "404.html")
    if (fs.existsSync(page)) {
      response.writeHead(404, { "content-type": TYPES[".html"] ?? "text/html" })
      fs.createReadStream(page).pipe(response)
    } else {
      response.writeHead(404, { "content-type": "text/plain" }).end("Not found")
    }
  }

  private subscribe(response: http.ServerResponse) {
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive",
    })
    response.write(": connected\n\n")
    this.clients.add(response)
    response.on("close", () => this.clients.delete(response))
  }
}
