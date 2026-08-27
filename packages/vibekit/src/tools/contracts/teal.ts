/**
 * Deterministic facts from disassembled TEAL: the on-chain truth a model's
 * summary must agree with. Heuristic by design — a static pass over
 * instructions, not an interpreter — and every field is "what the program
 * text shows", never "what the program guarantees".
 */
import { ABIMethod } from 'algosdk'
import type { z } from 'zod'
import type { Mutual } from '../shared/schemas.js'
import { applicationProgramSchema } from './schemas.js'

export type OnCompletionAction =
  'NoOp' | 'OptIn' | 'CloseOut' | 'ClearState' | 'UpdateApplication' | 'DeleteApplication'

export interface TealAnalysis {
  version?: number
  /**
   * Constants compared against ApplicationArgs 0: ARC-4 selectors as 0x-hex,
   * string-routed method names as text. The contract's call surface.
   */
  entrypoints: string[]
  /** The ARC-4 subset of entrypoints, as bare hex. */
  selectors: string[]
  /** The program logs ARC-4 return values (the 0x151f7c75 prefix appears). */
  arc4Returns: boolean
  /** Printable byte constants, in first-use order. */
  strings: string[]
  stateKeys: { global: string[]; local: string[]; box: string[] }
  /** Whether the program reads the field at all; a read is not a check. */
  guards: { rekey: boolean; closeRemainder: boolean; assetClose: boolean }
  innerTransactions: number
  /** OnCompletion values the program routes on, and what that branch does. */
  onCompletion: Array<{ action: OnCompletionAction; outcome: 'handled' | 'rejected' }>
}

true satisfies Mutual<TealAnalysis, z.infer<typeof applicationProgramSchema>['analysis']>

/** First four bytes of sha512/256("return"): every ARC-4 return value is logged behind it. */
const ARC4_RETURN_PREFIX = '151f7c75'

const ACTIONS: OnCompletionAction[] = [
  'NoOp',
  'OptIn',
  'CloseOut',
  'ClearState',
  'UpdateApplication',
  'DeleteApplication',
]

interface Instruction {
  op: string
  args: string[]
}

function parse(teal: string): {
  instructions: Instruction[]
  labels: Map<string, number>
  version?: number
} {
  const instructions: Instruction[] = []
  const labels = new Map<string, number>()
  let version: number | undefined
  for (const raw of teal.split('\n')) {
    const line = raw.replace(/\/\/.*$/, '').trim()
    if (line === '') continue
    if (line.startsWith('#pragma version')) {
      version = Number(line.split(/\s+/)[2])
      continue
    }
    if (line.startsWith('#')) continue
    if (line.endsWith(':')) {
      labels.set(line.slice(0, -1), instructions.length)
      continue
    }
    const [op = '', ...args] = line.split(/\s+/)
    instructions.push({ op, args })
  }
  return { instructions, labels, version }
}

function hexToText(hex: string): string | undefined {
  if (hex.length % 2 !== 0 || hex.length === 0) return undefined
  let text = ''
  for (let i = 0; i < hex.length; i += 2) {
    const code = Number.parseInt(hex.slice(i, i + 2), 16)
    if (Number.isNaN(code) || code < 0x20 || code > 0x7e) return undefined
    text += String.fromCharCode(code)
  }
  return text
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Byte constants an instruction pushes, as lowercase hex without 0x. */
function byteConstants(inst: Instruction, pool: string[]): string[] {
  switch (inst.op) {
    case 'pushbytes':
    case 'byte':
    case 'pushbytess':
      return inst.args.filter((a) => a.startsWith('0x')).map((a) => a.slice(2).toLowerCase())
    case 'bytec':
      return pool[Number(inst.args[0])] !== undefined ? [pool[Number(inst.args[0])]!] : []
    case 'bytec_0':
    case 'bytec_1':
    case 'bytec_2':
    case 'bytec_3': {
      const value = pool[Number(inst.op.slice(-1))]
      return value !== undefined ? [value] : []
    }
    case 'method':
      try {
        return [
          toHex(ABIMethod.fromSignature(inst.args.join(' ').replace(/^"|"$/g, '')).getSelector()),
        ]
      } catch {
        return []
      }
    default:
      return []
  }
}

const NAMED_INTS: Record<string, number> = {
  NoOp: 0,
  OptIn: 1,
  CloseOut: 2,
  ClearState: 3,
  UpdateApplication: 4,
  DeleteApplication: 5,
}

function intConstant(inst: Instruction, pool: number[]): number | undefined {
  switch (inst.op) {
    case 'pushint':
    case 'int': {
      const arg = inst.args[0] ?? ''
      return arg in NAMED_INTS ? NAMED_INTS[arg] : Number(arg)
    }
    case 'intc':
      return pool[Number(inst.args[0])]
    case 'intc_0':
    case 'intc_1':
    case 'intc_2':
    case 'intc_3':
      return pool[Number(inst.op.slice(-1))]
    default:
      return undefined
  }
}

const STATE_OPS: Record<string, keyof TealAnalysis['stateKeys']> = {
  app_global_get: 'global',
  app_global_get_ex: 'global',
  app_global_put: 'global',
  app_global_del: 'global',
  app_local_get: 'local',
  app_local_get_ex: 'local',
  app_local_put: 'local',
  app_local_del: 'local',
  box_create: 'box',
  box_put: 'box',
  box_get: 'box',
  box_len: 'box',
  box_del: 'box',
  box_extract: 'box',
  box_replace: 'box',
  box_resize: 'box',
  box_splice: 'box',
}

export function analyzeTeal(teal: string): TealAnalysis {
  const { instructions, labels, version } = parse(teal)
  const bytePool: string[] = []
  const intPool: number[] = []
  for (const inst of instructions) {
    if (inst.op === 'bytecblock')
      bytePool.push(...inst.args.map((a) => a.replace(/^0x/, '').toLowerCase()))
    if (inst.op === 'intcblock') intPool.push(...inst.args.map(Number))
  }

  const entrypoints = new Set<string>()
  const strings = new Set<string>()
  let arc4Returns = false
  const isArg0 = (inst: Instruction | undefined) =>
    inst !== undefined &&
    ((inst.op === 'txna' && inst.args[0] === 'ApplicationArgs' && inst.args[1] === '0') ||
      (inst.op === 'txn' && inst.args[0] === 'ApplicationArgs' && inst.args[1] === '0'))
  const label = (hex: string) => hexToText(hex) ?? `0x${hex}`
  const keys = { global: new Set<string>(), local: new Set<string>(), box: new Set<string>() }
  const guards = { rekey: false, closeRemainder: false, assetClose: false }
  let innerTransactions = 0
  const onCompletion = new Map<OnCompletionAction, 'handled' | 'rejected'>()

  /** What the branch at `label` does first: an immediate reject, or real work. */
  const outcomeAt = (label: string): 'handled' | 'rejected' => {
    const start = labels.get(label)
    if (start === undefined) return 'handled'
    const first = instructions[start]
    const second = instructions[start + 1]
    if (first?.op === 'err') return 'rejected'
    if (first && intConstant(first, intPool) === 0 && second?.op === 'return') return 'rejected'
    return 'handled'
  }

  // ponytail: a state key is the nearest byte constant within four
  // instructions before the state op; wrong when the key is computed.
  const keyBefore = (index: number): string | undefined => {
    for (let back = 1; back <= 4 && index - back >= 0; back++) {
      const constants = byteConstants(instructions[index - back]!, bytePool)
      if (constants.length === 1) return label(constants[0]!)
    }
    return undefined
  }

  instructions.forEach((inst, index) => {
    for (const hex of byteConstants(inst, bytePool)) {
      const text = hexToText(hex)
      if (text !== undefined && text.length >= 2) strings.add(text)
      if (hex === ARC4_RETURN_PREFIX) arc4Returns = true
    }
    // txna ApplicationArgs 0; <const>; ==   — one entrypoint
    if (isArg0(instructions[index - 1]) && instructions[index + 1]?.op === '==') {
      for (const hex of byteConstants(inst, bytePool)) entrypoints.add(label(hex))
    }
    // <const>…; txna ApplicationArgs 0; match l0 l1 …   — one per label (pushbytess included)
    if (inst.op === 'match' && isArg0(instructions[index - 1])) {
      const count = inst.args.length
      for (let back = 2; back <= count + 1; back++) {
        for (const hex of byteConstants(
          instructions[index - back] ?? { op: '', args: [] },
          bytePool,
        )) {
          entrypoints.add(label(hex))
        }
      }
    }
    const scope = STATE_OPS[inst.op]
    if (scope) {
      const key = keyBefore(index)
      if (key !== undefined) keys[scope].add(key)
    }
    const field = inst.args[inst.args.length - 1] ?? ''
    if (field === 'RekeyTo') guards.rekey = true
    if (field === 'CloseRemainderTo') guards.closeRemainder = true
    if (field === 'AssetCloseTo') guards.assetClose = true
    if (inst.op === 'itxn_begin') innerTransactions += 1

    if (inst.op === 'txn' && inst.args[0] === 'OnCompletion') {
      const next = instructions[index + 1]
      const after = instructions[index + 2]
      const branch = instructions[index + 3]
      // txn OnCompletion; <int>; ==; bnz|bz|assert
      const value = next ? intConstant(next, intPool) : undefined
      const action = value !== undefined ? ACTIONS[value] : undefined
      if (action && after?.op === '==' && branch) {
        if (branch.op === 'bnz') onCompletion.set(action, outcomeAt(branch.args[0] ?? ''))
        else if (branch.op === 'bz' || branch.op === 'assert') onCompletion.set(action, 'handled')
      }
      // txn OnCompletion; !; assert   — NoOp only (PuyaPy's form)
      if (next?.op === '!' && after?.op === 'assert') onCompletion.set('NoOp', 'handled')
      // <ints…>; txn OnCompletion; match l0 l1 … / txn OnCompletion; switch l0 l1 …
      if (next?.op === 'switch') {
        next.args.forEach((label, i) => {
          const target = ACTIONS[i]
          if (target) onCompletion.set(target, outcomeAt(label))
        })
      }
      if (next?.op === 'match') {
        const count = next.args.length
        for (let i = 0; i < count; i++) {
          const source = instructions[index - count + i]
          const v = source ? intConstant(source, intPool) : undefined
          const target = v !== undefined ? ACTIONS[v] : undefined
          if (target) onCompletion.set(target, outcomeAt(next.args[i] ?? ''))
        }
      }
    }
  })

  const selectors = [...entrypoints]
    .filter((entry) => entry.startsWith('0x') && entry.length === 10)
    .map((entry) => entry.slice(2))

  return {
    ...(version !== undefined ? { version } : {}),
    entrypoints: [...entrypoints],
    selectors,
    arc4Returns,
    strings: [...strings],
    stateKeys: { global: [...keys.global], local: [...keys.local], box: [...keys.box] },
    guards,
    innerTransactions,
    onCompletion: ACTIONS.flatMap((action) => {
      const outcome = onCompletion.get(action)
      return outcome ? [{ action, outcome }] : []
    }),
  }
}

export interface LabelledMethod {
  selector: string
  name?: string
  signature?: string
  args?: Array<{ name?: string; type: string }>
  returns?: string
  readonly?: boolean
  description?: string
}

/** Selector hex → the spec method that compiles to it, with its signature and args. */
export function labelSelectors(
  selectors: readonly string[],
  methods: ReadonlyArray<{
    name: string
    args: ReadonlyArray<{ type: string; name?: string }>
    returns?: { type: string }
    readonly?: boolean
    description?: string
  }>,
): LabelledMethod[] {
  const byHex = new Map<string, Omit<LabelledMethod, 'selector'>>()
  for (const method of methods) {
    const signature = `${method.name}(${method.args.map((a) => a.type).join(',')})${method.returns?.type ?? 'void'}`
    try {
      byHex.set(toHex(ABIMethod.fromSignature(signature).getSelector()), {
        name: method.name,
        signature,
        args: method.args.map((a) => ({ ...(a.name ? { name: a.name } : {}), type: a.type })),
        returns: method.returns?.type ?? 'void',
        ...(method.readonly ? { readonly: true } : {}),
        ...(method.description ? { description: method.description } : {}),
      })
    } catch {
      // Not an ABI signature (bare call spec entry); nothing to label.
    }
  }
  return selectors.map((selector) => ({ selector, ...(byHex.get(selector) ?? {}) }))
}
