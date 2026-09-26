import fs from "node:fs"
import path from "node:path"
import { PublishError } from "../errors.ts"
import { OUTPUT } from "./protocol.ts"

type Rename = (from: string, to: string) => void

const TRANSIENT = new Set(["EPERM", "EACCES", "EBUSY"])

/** Windows briefly locks freshly written files (indexer, antivirus); such renames succeed on retry. */
function renameWithRetry(from: string, to: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(from, to)
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (attempt >= 8 || !code || !TRANSIENT.has(code)) throw error
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25 * 2 ** attempt)
    }
  }
}

/**
 * Puts a finished staging folder in place of the output folder with two renames, and
 * restores the previous folder if the second one fails. Folders named in `keep` (the
 * separately built PDFs) move from the old output into the new one.
 */
export class FolderSwap {
  constructor(private readonly rename: Rename = renameWithRetry) {}

  static scratch(out: string, role: "staging" | "previous"): string {
    return path.join(path.dirname(out), `.${path.basename(out)}.${role}`)
  }

  /** Deletes a scratch folder left by an earlier run, but only if this publisher made it. */
  static discard(folder: string) {
    if (!fs.existsSync(folder)) return
    const entries = fs.readdirSync(folder)
    if (entries.length && !entries.includes(OUTPUT.marker)) {
      throw new PublishError(`Refusing to delete ${folder}: it was not created by this publisher.`)
    }
    fs.rmSync(folder, { recursive: true, force: true })
  }

  replace(out: string, staging: string, keep: readonly string[]) {
    const previous = FolderSwap.scratch(out, "previous")
    FolderSwap.discard(previous)
    const existed = fs.existsSync(out)
    const carried: string[] = []
    try {
      for (const name of existed ? keep : []) {
        if (!fs.existsSync(path.join(out, name))) continue
        this.rename(path.join(out, name), path.join(staging, name))
        carried.push(name)
      }
      if (existed) this.rename(out, previous)
      try {
        this.rename(staging, out)
      } catch (error) {
        if (existed) renameWithRetry(previous, out)
        throw error
      }
    } catch (error) {
      for (const name of carried) renameWithRetry(path.join(staging, name), path.join(out, name))
      const reason = error instanceof Error ? error.message : String(error)
      throw new PublishError(`Could not replace ${out}; the previous output is unchanged (${reason}).`)
    }
    try {
      if (existed) fs.rmSync(previous, { recursive: true, force: true })
    } catch {
      // The new output is in place; a leftover previous folder is discarded by the next run.
    }
  }

  /**
   * Repairs what a run killed mid-swap left behind: the previous output back in place if
   * the new one never arrived, then kept folders stranded in staging back into it.
   */
  recover(out: string, staging: string, keep: readonly string[]) {
    const previous = FolderSwap.scratch(out, "previous")
    if (!fs.existsSync(out) && fs.existsSync(path.join(previous, OUTPUT.marker))) this.rename(previous, out)
    for (const name of keep) {
      const stranded = path.join(staging, name)
      if (fs.existsSync(stranded) && !fs.existsSync(path.join(out, name))) {
        fs.mkdirSync(out, { recursive: true })
        this.rename(stranded, path.join(out, name))
      }
    }
  }
}
