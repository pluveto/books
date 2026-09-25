type Rgb = readonly [number, number, number]

/** A book's accent colour. It must stay readable as link text and as a header background. */
export class AccentColor {
  static readonly MIN_CONTRAST = 4.5
  static readonly WHITE = new AccentColor([255, 255, 255])
  static readonly DARK_SURFACE = new AccentColor([24, 26, 31])

  private constructor(private readonly rgb: Rgb) {}

  static parse(value: string): AccentColor | undefined {
    const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())
    if (!match?.[1]) return undefined
    const hex = match[1].length === 3 ? [...match[1]].map((c) => c + c).join("") : match[1]
    const channel = (index: number) => Number.parseInt(hex.slice(index, index + 2), 16)
    return new AccentColor([channel(0), channel(2), channel(4)])
  }

  get hex(): string {
    return `#${this.rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`
  }

  contrastWith(other: AccentColor): number {
    const [light, dark] = [this.luminance(), other.luminance()].sort((a, b) => b - a) as [number, number]
    return (light + 0.05) / (dark + 0.05)
  }

  /** The same hue lifted toward white until it is readable on the dark theme surface. */
  onDarkSurface(): AccentColor {
    for (let weight = 0; weight <= 1; weight += 0.05) {
      const candidate = this.mix(AccentColor.WHITE, weight)
      if (candidate.contrastWith(AccentColor.DARK_SURFACE) >= AccentColor.MIN_CONTRAST) return candidate
    }
    return AccentColor.WHITE
  }

  mix(other: AccentColor, weight: number): AccentColor {
    const blend = (a: number, b: number) => a + (b - a) * weight
    return new AccentColor([
      blend(this.rgb[0], other.rgb[0]),
      blend(this.rgb[1], other.rgb[1]),
      blend(this.rgb[2], other.rgb[2]),
    ])
  }

  private luminance(): number {
    const linear = (channel: number) => {
      const s = channel / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    const [r, g, b] = this.rgb
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
  }
}
