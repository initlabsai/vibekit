/**
 * The method line: one input for an ABI call. Accepts positional values,
 * `name=value` pairs, or JSON (an object by arg name, or an array). Values are
 * coerced and checked by ABI type before anything is built.
 */
import algosdk from 'algosdk'
import type { ParsedMethod } from '@initlabs/vibekit-tools'

export type ParsedArgs =
  | {
      ok: true
      named: Record<string, unknown>
      /** +fund: microALGO paid to the app account in the same group. */
      fundMicroAlgos?: number
      /** +fee: extra fee in microALGO for inner transactions. */
      extraFeeMicroAlgos?: number
    }
  | { ok: false; error: string }

/** `+fund 0.2` / `+fee 0.002` (ALGO) pulled off the token list. */
function takeModifiers(tokens: string[]): { rest: string[]; fund?: number; fee?: number; error?: string } {
  const rest: string[] = []
  let fund: number | undefined
  let fee: number | undefined
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    if (token === '+fund' || token === '+fee') {
      const value = tokens[i + 1]
      const algo = value === undefined ? Number.NaN : Number(value)
      if (!Number.isFinite(algo) || algo <= 0) return { rest, error: `${token} needs an ALGO amount, e.g. ${token} ${token === '+fund' ? '0.2' : '0.002'}` }
      const micro = Math.round(algo * 1_000_000)
      if (token === '+fund') fund = micro
      else fee = micro
      i += 1
      continue
    }
    rest.push(token)
  }
  return { rest, ...(fund === undefined ? {} : { fund }), ...(fee === undefined ? {} : { fee }) }
}

const TXN_TYPES = new Set(['pay', 'axfer', 'acfg', 'afrz', 'appl', 'keyreg', 'txn'])

/** Splits on whitespace or commas at depth 0; quotes, brackets, and braces keep their contents whole. */
export function splitTokens(raw: string): string[] {
  const tokens: string[] = []
  let current = ''
  let depth = 0
  let quote: string | null = null
  for (const ch of raw) {
    if (quote) {
      current += ch
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
      continue
    }
    if (ch === '[' || ch === '{' || ch === '(') depth += 1
    if (ch === ']' || ch === '}' || ch === ')') depth -= 1
    if (depth === 0 && (ch === ' ' || ch === ',' || ch === '\t')) {
      if (current) tokens.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current) tokens.push(current)
  return tokens
}

function unquote(token: string): string {
  const first = token[0]
  if ((first === '"' || first === "'") && token.endsWith(first) && token.length >= 2) return token.slice(1, -1)
  return token
}

/** One token as the JSON value an ABI type expects, or an error naming the type. */
export function coerceArg(type: string, token: string): { value: unknown } | { error: string } {
  const text = unquote(token)
  if (type === 'string') return { value: text }
  if (type === 'bool') {
    if (text === 'true' || text === 'false') return { value: text === 'true' }
    return { error: `${type}: true or false` }
  }
  if (type === 'address' || type === 'account') {
    return algosdk.isValidAddress(text) ? { value: text } : { error: `${type}: a 58-character Algorand address` }
  }
  if (type === 'asset' || type === 'application') {
    return /^\d+$/.test(text) ? { value: Number(text) } : { error: `${type}: an id (integer)` }
  }
  if (/^uint\d+$/.test(type) || type === 'byte') {
    if (!/^\d+$/.test(text)) return { error: `${type}: a non-negative integer` }
    return { value: Number.isSafeInteger(Number(text)) ? Number(text) : text }
  }
  if (type === 'byte[]' || /^byte\[\d+]$/.test(type)) return { value: text }
  // Txn args, arrays, tuples, structs: JSON.
  try {
    return { value: JSON.parse(token) }
  } catch {
    return { error: `${type}: JSON${TXN_TYPES.has(type) ? ' — e.g. {"type":"pay","receiver":"…","amount":1000}' : ''}` }
  }
}

function argKey(arg: ParsedMethod['args'][number], index: number): string {
  return arg.name && arg.name.length > 0 ? arg.name : `arg${index}`
}

/** Parses the line for `method`; the result is keyed by ABI arg name, ready for toolArgsFor. */
export function parseMethodArgs(method: ParsedMethod, raw: string): ParsedArgs {
  const mods = takeModifiers(splitTokens(raw.trim()))
  if (mods.error) return { ok: false, error: mods.error }
  const extras = {
    ...(mods.fund === undefined ? {} : { fundMicroAlgos: mods.fund }),
    ...(mods.fee === undefined ? {} : { extraFeeMicroAlgos: mods.fee }),
  }
  const line = mods.rest.join(' ')
  const args = method.args
  if (line.length === 0) {
    return args.length === 0 ? { ok: true, named: {}, ...extras } : { ok: false, error: `${method.name} needs ${args.length} arg${args.length === 1 ? '' : 's'}: ${args.map((a, i) => argKey(a, i)).join(', ')}` }
  }
  if (line.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(line)
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) return { ok: true, named: parsed as Record<string, unknown>, ...extras }
    } catch {
      // fall through to the token grammar
    }
    return { ok: false, error: 'JSON object must map arg names to values' }
  }
  let tokens: string[]
  if (line.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(line)
      if (!Array.isArray(parsed)) throw new Error()
      tokens = parsed.map((v) => (typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v)))
    } catch {
      return { ok: false, error: 'JSON array must list the args in order' }
    }
  } else {
    tokens = splitTokens(line)
  }
  const named: Record<string, unknown> = {}
  let position = 0
  for (const token of tokens) {
    const eq = token.indexOf('=')
    const isPair = eq > 0 && !/^["'[{]/.test(token)
    const key = isPair ? token.slice(0, eq) : undefined
    const index = key === undefined ? position++ : args.findIndex((a, i) => argKey(a, i) === key)
    const arg = args[index]
    if (!arg) return { ok: false, error: key === undefined ? `too many args — ${method.name} takes ${args.length}` : `no arg named ${key}` }
    const coerced = coerceArg(arg.type, key === undefined ? token : token.slice(eq + 1))
    if ('error' in coerced) return { ok: false, error: `${argKey(arg, index)} — ${coerced.error}` }
    named[argKey(arg, index)] = coerced.value
  }
  const missing = args.map((a, i) => argKey(a, i)).filter((k) => !(k in named))
  if (missing.length > 0) return { ok: false, error: `missing: ${missing.join(', ')}` }
  return { ok: true, named, ...extras }
}

/** The prompt shown before the input: `hello(name: string)`. */
export function methodPrompt(method: ParsedMethod): string {
  return `${method.name}(${method.args.map((a, i) => `${argKey(a, i)}: ${a.type}`).join(', ')})`
}
