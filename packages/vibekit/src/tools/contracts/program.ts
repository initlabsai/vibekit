import { createHash } from 'node:crypto'

import { ToolError, type ToolContext } from '../../core/index.js'
import { analyzeTeal, type TealAnalysis } from './teal.js'

/** Lines of TEAL one call returns by default; ~4 tokens a line. */
export const PROGRAM_PAGE_LINES = 600
const MAX_PAGE_LINES = 1500
/** Disassembled TEAL runs ~4.6 chars per bytecode byte; a line is ~13 chars. */
const LINES_PER_BYTE = 0.35
const TOKENS_PER_LINE = 3.8
/** The analysis block and framing, regardless of program size. */
const ANALYSIS_TOKENS = 600

/** Rough model-input cost of one get_application_program call for a program of `bytes`. */
export function estimateProgramTokens(bytes: number): {
  tokens: number
  totalLines: number
  pages: number
} {
  const totalLines = Math.max(1, Math.round(bytes * LINES_PER_BYTE))
  const shown = Math.min(totalLines, PROGRAM_PAGE_LINES)
  return {
    tokens: Math.round(shown * TOKENS_PER_LINE + ANALYSIS_TOKENS),
    totalLines,
    pages: Math.ceil(totalLines / PROGRAM_PAGE_LINES),
  }
}

/** sha512/256 hex of a program, the hash ARC-56 tooling and algod both use for programs. */
export function programHash(bytecode: Uint8Array): string {
  return createHash('sha512-256').update(bytecode).digest('hex')
}

export interface GetApplicationProgramArgs {
  applicationId: number
  program?: 'approval' | 'clear'
  fromLine?: number
  toLine?: number
}

export interface ApplicationProgram {
  applicationId: number
  program: 'approval' | 'clear'
  bytes: number
  /** sha512/256 of the bytecode, hex — matches an ARC-56 byteCode to prove a spec belongs to this app. */
  programHash: string
  totalLines: number
  fromLine: number
  toLine: number
  teal: string
  analysis: TealAnalysis
  methods: Array<{ selector: string; name?: string; signature?: string }>
}

export async function getApplicationProgram(
  ctx: ToolContext,
  args: GetApplicationProgramArgs,
): Promise<ApplicationProgram> {
  const program = args.program ?? 'approval'
  const app = await ctx.algod.getApplicationByID(args.applicationId).do()
  const bytecode =
    program === 'approval' ? app.params?.approvalProgram : app.params?.clearStateProgram
  if (!bytecode || bytecode.length === 0) {
    throw new ToolError(
      'APP_NOT_FOUND',
      `Application ${args.applicationId} has no ${program} program`,
    )
  }
  let teal: string
  try {
    teal = (await ctx.algod.disassemble(bytecode).do()).result
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new ToolError(
      'DISASSEMBLE_UNAVAILABLE',
      `This algod node could not disassemble the program (the developer API may be off): ${message}`,
    )
  }
  const lines = teal.split('\n')
  const fromLine = Math.max(1, args.fromLine ?? 1)
  const toLine = Math.min(
    lines.length,
    args.toLine ?? fromLine + PROGRAM_PAGE_LINES - 1,
    fromLine + MAX_PAGE_LINES - 1,
  )
  const analysis = analyzeTeal(teal)
  return {
    applicationId: args.applicationId,
    program,
    bytes: bytecode.length,
    programHash: programHash(bytecode),
    totalLines: lines.length,
    fromLine,
    toLine,
    teal: lines.slice(fromLine - 1, toLine).join('\n'),
    analysis,
    methods: analysis.selectors.map((selector) => ({ selector })),
  }
}
