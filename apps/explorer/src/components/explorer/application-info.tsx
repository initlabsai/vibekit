import { formatNumber } from '@/lib/formatters'
import { decodeStateValue } from '@/lib/decode-state'
import { Code2 } from 'lucide-react'

interface ApplicationInfoProps {
  data: Record<string, unknown>
}

interface GlobalStateEntry {
  key: string
  value: { type: number; bytes?: string; uint?: number }
}

export function ApplicationInfo({ data }: ApplicationInfoProps) {
  const globalStateSchema = data.globalStateSchema as
    | { numUint: number; numByteSlice: number }
    | undefined
  const localStateSchema = data.localStateSchema as
    | { numUint: number; numByteSlice: number }
    | undefined
  const globalState = data.globalState as GlobalStateEntry[] | undefined

  return (
    <div className="rounded-lg border border-algo-border bg-algo-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Code2 className="w-4 h-4 text-algo-teal" />
        <h3 className="text-sm font-semibold text-algo-teal">
          Application #{formatNumber(data.applicationId as number)}
        </h3>
      </div>
      <div className="space-y-3 text-xs">
        <div className="flex gap-2">
          <span className="text-algo-muted w-20 shrink-0">Creator</span>
          <span className="font-mono break-all">{data.creator as string}</span>
        </div>
        {globalStateSchema && (
          <div className="flex gap-2">
            <span className="text-algo-muted w-20 shrink-0">Global Schema</span>
            <span>
              {globalStateSchema.numUint ?? 0} uint, {globalStateSchema.numByteSlice ?? 0} bytes
            </span>
          </div>
        )}
        {localStateSchema && (
          <div className="flex gap-2">
            <span className="text-algo-muted w-20 shrink-0">Local Schema</span>
            <span>
              {localStateSchema.numUint ?? 0} uint, {localStateSchema.numByteSlice ?? 0} bytes
            </span>
          </div>
        )}
        {globalState && globalState.length > 0 && (
          <div>
            <span className="text-algo-muted">
              Global State ({globalState.length} keys):
            </span>
            <div className="mt-1 bg-algo-dark rounded p-2 max-h-48 overflow-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-algo-muted">
                    <th className="text-left pr-4 pb-1">Key</th>
                    <th className="text-left pb-1">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {globalState.map((entry) => (
                    <tr key={entry.key} className="border-t border-algo-border/30">
                      <td className="pr-4 py-1 font-mono">{decodeKey(entry.key)}</td>
                      <td className="py-1 font-mono">
                        <StateValueCell entry={entry} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StateValueCell({ entry }: { entry: GlobalStateEntry }) {
  if (entry.value.type !== 1) {
    return <span>{formatNumber(entry.value.uint ?? 0)}</span>
  }

  const decoded = decodeStateValue(entry.value.bytes ?? '')

  switch (decoded.type) {
    case 'string':
      return <span className="text-algo-teal-light">{decoded.display}</span>
    case 'uint':
      return <span>{decoded.display}</span>
    case 'address':
      return (
        <span className="text-algo-muted" title={decoded.full}>
          {decoded.display}
        </span>
      )
    default:
      return <span className="text-algo-muted">{decoded.display}</span>
  }
}

function decodeKey(base64: string): string {
  try {
    return atob(base64)
  } catch {
    return base64
  }
}
