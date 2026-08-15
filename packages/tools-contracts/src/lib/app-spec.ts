/**
 * ARC-56 / ARC-32 app spec parsing for deploy and method listing.
 * Normalizes both formats to one shape; TEAL sources are base64 in both.
 */
import { base64ToBytes, ToolError } from '@initlabs/core'

export interface ParsedMethod {
  name: string
  signature: string
  description?: string
  args: Array<{ name?: string; type: string; description?: string }>
  returns: { type: string; description?: string }
}

export interface ParsedAppSpec {
  name?: string
  approvalTeal?: string
  clearTeal?: string
  approvalByteCode?: Uint8Array
  clearByteCode?: Uint8Array
  schema: { globalInts: number; globalBytes: number; localInts: number; localBytes: number }
  methods: ParsedMethod[]
}

function decodeTeal(base64Source: string | undefined): string | undefined {
  if (!base64Source) return undefined
  return new TextDecoder().decode(base64ToBytes(base64Source))
}

export function parseAppSpec(appSpecJson: string): ParsedAppSpec {
  let spec: Record<string, unknown>
  try {
    spec = JSON.parse(appSpecJson)
  } catch {
    throw new ToolError('INVALID_APP_SPEC', 'appSpec is not valid JSON')
  }

  const isArc32 = 'contract' in spec
  const contract = (isArc32 ? spec['contract'] : spec) as {
    name?: string
    methods?: Array<{
      name: string
      desc?: string
      description?: string
      args?: Array<{ name?: string; type: string; desc?: string; description?: string }>
      returns?: { type: string; desc?: string; description?: string }
    }>
  }

  const methods: ParsedMethod[] = (contract.methods ?? []).map((m) => {
    const args = (m.args ?? []).map((a) => ({
      name: a.name,
      type: a.type,
      description: a.desc ?? a.description,
    }))
    const returns = { type: m.returns?.type ?? 'void', description: m.returns?.desc ?? m.returns?.description }
    return {
      name: m.name,
      signature: `${m.name}(${args.map((a) => a.type).join(',')})${returns.type}`,
      description: m.desc ?? m.description,
      args,
      returns,
    }
  })

  const source = spec['source'] as { approval?: string; clear?: string } | undefined
  const byteCode = spec['byteCode'] as { approval?: string; clear?: string } | undefined

  let schema = { globalInts: 0, globalBytes: 0, localInts: 0, localBytes: 0 }
  if (isArc32) {
    const state = spec['state'] as
      | { global?: { num_uints?: number; num_byte_slices?: number }; local?: { num_uints?: number; num_byte_slices?: number } }
      | undefined
    schema = {
      globalInts: state?.global?.num_uints ?? 0,
      globalBytes: state?.global?.num_byte_slices ?? 0,
      localInts: state?.local?.num_uints ?? 0,
      localBytes: state?.local?.num_byte_slices ?? 0,
    }
  } else {
    const arc56State = spec['state'] as
      | { schema?: { global?: { ints?: number; bytes?: number }; local?: { ints?: number; bytes?: number } } }
      | undefined
    schema = {
      globalInts: arc56State?.schema?.global?.ints ?? 0,
      globalBytes: arc56State?.schema?.global?.bytes ?? 0,
      localInts: arc56State?.schema?.local?.ints ?? 0,
      localBytes: arc56State?.schema?.local?.bytes ?? 0,
    }
  }

  return {
    name: contract.name ?? (spec['name'] as string | undefined),
    approvalTeal: decodeTeal(source?.approval),
    clearTeal: decodeTeal(source?.clear),
    approvalByteCode: byteCode?.approval ? base64ToBytes(byteCode.approval) : undefined,
    clearByteCode: byteCode?.clear ? base64ToBytes(byteCode.clear) : undefined,
    schema,
    methods,
  }
}

/**
 * Substitute TMPL_<KEY> deploy-time template parameters in TEAL source.
 * Values are inserted as literals (numbers plain; strings as-is).
 */
export function substituteTemplateParams(
  teal: string,
  params: Record<string, string | number> | undefined,
): string {
  if (!params) return teal
  let out = teal
  for (const [key, value] of Object.entries(params)) {
    const token = key.startsWith('TMPL_') ? key : `TMPL_${key}`
    out = out.replaceAll(token, String(value))
  }
  return out
}
