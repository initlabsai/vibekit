/**
 * The Explorer's palette (`apps/tui/src/theme.ts`) for CLI output: amber is
 * structure and figures, teal is alive/touchable. Truecolor escapes, gated on
 * the same support check picocolors uses (NO_COLOR, FORCE_COLOR, TTY).
 */
import pc from 'picocolors'

const ESC = String.fromCharCode(27)

function truecolor(hex: string): (text: string) => string {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
  return (text) => (pc.isColorSupported ? `${ESC}[38;2;${r};${g};${b}m${text}${ESC}[39m` : text)
}

/** Hero amber (`brassBright`): the wordmark, headings, figures. */
export const amber = truecolor('#ffb454')
/** Structural brass: labels and secondary structure. */
export const brass = truecolor('#c4a06a')
/** Signal teal: commands to run, live things, success. */
export const teal = truecolor('#6fd3d3')
/** Muted warm grey for asides. */
export const muted = truecolor('#8e8476')
