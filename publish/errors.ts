export interface SourceLocation {
  /** Vault-relative POSIX path. */
  readonly file: string
  readonly line?: number
}

/** A problem the author or contributor has to fix: bad vault content or a missing tool. */
export class PublishError extends Error {
  constructor(
    message: string,
    readonly location?: SourceLocation,
  ) {
    super(message)
    this.name = "PublishError"
  }

  /** `vault` is how the vault folder should be shown, e.g. relative to the working directory. */
  describe(vault = "vault"): string {
    if (!this.location) return this.message
    const where = this.location.line ? `${this.location.file}:${this.location.line}` : this.location.file
    return `${vault}/${where}: ${this.message}`
  }
}

export class MissingToolError extends PublishError {
  constructor(readonly tools: readonly string[]) {
    super(
      `Missing required tools: ${tools.join(", ")}. Install them and retry; the website build does not need them.`,
    )
    this.name = "MissingToolError"
  }
}
