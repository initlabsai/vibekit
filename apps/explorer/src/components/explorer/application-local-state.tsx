'use client'

import { useState } from 'react'
import { formatNumber } from '@/lib/formatters'
import { decodeStateValue } from '@/lib/decode-state'
import { CopyableAddress } from './copyable-address'
import { Database, ChevronDown, ChevronRight } from 'lucide-react'

interface ApplicationLocalStateProps {
  data: Record<string, unknown>
}

interface KeyValue {
  key: string
  value: { type: number; bytes?: string; uint?: number }
}

interface AppLocalState {
  applicationId: number
  schema: { numUint: number; numByteSlice: number }
  keyValue: KeyValue[]
}

function decodeKey(base64: string): string {
  try {
    return atob(base64)
  } catch {
    return base64
  }
}

function StateValueCell({ entry }: { entry: KeyValue }) {
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
      return <CopyableAddress address={decoded.full} />
    default:
      return <span className="text-algo-muted">{decoded.display}</span>
  }
}

function AppStateCard({ state }: { state: AppLocalState }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="border border-algo-border/50 rounded">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-algo-dark/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-algo-muted" />
        ) : (
          <ChevronRight className="w-3 h-3 text-algo-muted" />
        )}
        <span className="font-medium text-algo-teal">App #{formatNumber(state.applicationId)}</span>
        <span className="text-algo-muted">
          ({state.keyValue.length} {state.keyValue.length === 1 ? 'key' : 'keys'})
        </span>
      </button>
      {expanded && state.keyValue.length > 0 && (
        <div className="px-3 pb-2">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-algo-muted">
                <th className="text-left pr-4 pb-1">Key</th>
                <th className="text-left pb-1">Value</th>
              </tr>
            </thead>
            <tbody>
              {state.keyValue.map((kv) => (
                <tr key={kv.key} className="border-t border-algo-border/30">
                  <td className="pr-4 py-1 font-mono">{decodeKey(kv.key)}</td>
                  <td className="py-1 font-mono">
                    <StateValueCell entry={kv} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function ApplicationLocalState({ data }: ApplicationLocalStateProps) {
  const appLocalStates = (data.appLocalStates ?? []) as AppLocalState[]
  const address = data.address as string | undefined

  return (
    <div className="rounded-lg border border-algo-border bg-algo-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-algo-border">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-algo-teal" />
          <h3 className="text-sm font-semibold text-algo-teal">
            Local State ({appLocalStates.length} {appLocalStates.length === 1 ? 'app' : 'apps'})
          </h3>
        </div>
        {address && (
          <div className="text-xs text-algo-muted">
            <CopyableAddress address={address} />
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        {appLocalStates.map((state) => (
          <AppStateCard key={state.applicationId} state={state} />
        ))}
      </div>
    </div>
  )
}
