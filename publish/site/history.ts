import { spawnSync } from "node:child_process"
import path from "node:path"
import type { Series } from "../model/series.ts"
import type { Vault } from "../obsidian/vault.ts"

/**
 * What git knows about vault files: their path in the repository (for edit links) and the
 * date of their last commit. Without git, or outside a repository, both are unavailable.
 */
export class SourceHistory {
  private constructor(
    private readonly vaultPrefix: string | undefined,
    private readonly dates: ReadonlyMap<string, string>,
  ) {}

  static read(vault: Vault): SourceHistory {
    const git = (args: string[]) =>
      spawnSync("git", args, {
        cwd: vault.root,
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024,
      })
    const top = git(["rev-parse", "--show-toplevel"])
    if (top.status !== 0) return new SourceHistory(undefined, new Map())
    const prefix = path.relative(top.stdout.trim(), vault.root).split(path.sep).join("/")
    const log = git(["-c", "core.quotepath=false", "log", "--format=@%cs", "--name-only", "--", "."])
    const dates = new Map<string, string>()
    if (log.status === 0) {
      let date = ""
      for (const line of log.stdout.split("\n")) {
        if (line.startsWith("@")) date = line.slice(1)
        else if (line && date) {
          const file = prefix ? line.slice(prefix.length + 1) : line
          if (!dates.has(file)) dates.set(file, date)
        }
      }
    }
    return new SourceHistory(prefix, dates)
  }

  /** ISO date (YYYY-MM-DD) of the last commit that touched the file. */
  lastUpdated(file: string): string | undefined {
    return this.dates.get(file)
  }

  editUrl(series: Series, file: string): string | undefined {
    const { repository, branch } = series.settings
    if (!repository || this.vaultPrefix === undefined) return undefined
    const repoPath = [this.vaultPrefix, file].filter(Boolean).join("/")
    return `${repository}/edit/${branch}/${repoPath.split("/").map(encodeURIComponent).join("/")}`
  }
}
