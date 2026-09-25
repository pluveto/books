export type MacroValue = string | [string, number]

export class MacroError extends Error {}

/**
 * TeX macros declared once in book.md. MathJax (web) and XeLaTeX (PDF) both read this
 * object, so only \newcommand and \renewcommand are accepted: the subset both understand.
 */
export class MacroSet {
  private constructor(
    readonly tex: string,
    private readonly definitions: ReadonlyMap<string, MacroValue>,
  ) {}

  static readonly EMPTY = new MacroSet("", new Map())

  static parse(source: string): MacroSet {
    const tex = source.trim()
    if (!tex) return MacroSet.EMPTY
    const definitions = new Map<string, MacroValue>()
    const command = /\\(?:newcommand|renewcommand)\*?\s*/g
    let cursor = 0
    let match: RegExpExecArray | null
    while ((match = command.exec(tex))) {
      if (!MacroSet.blank(tex.slice(cursor, match.index))) throw MacroSet.unsupported()
      const name = MacroSet.group(tex, match.index + match[0].length)
      if (!/^\\[A-Za-z]+$/.test(name.body)) throw new MacroError(`invalid macro name "${name.body}"`)
      let next = name.end
      let arity = 0
      const arityMatch = /^\s*\[(\d)\]/.exec(tex.slice(next))
      if (arityMatch?.[1]) {
        arity = Number(arityMatch[1])
        next += arityMatch[0].length
      }
      const body = MacroSet.group(tex, next + (/^\s*/.exec(tex.slice(next))?.[0].length ?? 0))
      definitions.set(name.body.slice(1), arity > 0 ? [body.body, arity] : body.body)
      cursor = body.end
      command.lastIndex = body.end
    }
    if (!MacroSet.blank(tex.slice(cursor))) throw MacroSet.unsupported()
    return new MacroSet(tex, definitions)
  }

  /** MathJax's `tex.macros` table: names without the leading backslash. */
  mathjax(): Record<string, MacroValue> {
    return Object.fromEntries(this.definitions)
  }

  private static group(source: string, start: number): { body: string; end: number } {
    if (source[start] !== "{") throw new MacroError("expected {...} after \\newcommand")
    let depth = 0
    for (let index = start; index < source.length; index++) {
      const char = source[index]
      if (char === "\\") index++
      else if (char === "{") depth++
      else if (char === "}" && --depth === 0) return { body: source.slice(start + 1, index), end: index + 1 }
    }
    throw new MacroError("unbalanced braces")
  }

  private static blank(text: string): boolean {
    return text.replace(/(^|[^\\])%.*$/gm, "$1").trim() === ""
  }

  private static unsupported(): MacroError {
    return new MacroError("only \\newcommand and \\renewcommand definitions are supported")
  }
}
