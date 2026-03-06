import { truncateAddress, formatNumber } from '@/lib/formatters'
import { Code2 } from 'lucide-react'

interface ApplicationCardProps {
  data: Record<string, unknown>
}

export function ApplicationCard({ data }: ApplicationCardProps) {
  const applicationId = data.applicationId as number
  const creator = data.creator as string | undefined
  const globalStateSchema = data.globalStateSchema as
    | { numUint: number; numByteSlice: number }
    | undefined
  const localStateSchema = data.localStateSchema as
    | { numUint: number; numByteSlice: number }
    | undefined

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <Code2 className="w-3.5 h-3.5 text-algo-teal shrink-0" />
        <span className="text-xs font-medium text-algo-teal">
          App #{formatNumber(applicationId)}
        </span>
      </div>
      {creator && (
        <div className="text-xs mb-1">
          <span className="text-algo-muted">Creator: </span>
          <span className="font-mono">{truncateAddress(creator)}</span>
        </div>
      )}
      {(globalStateSchema || localStateSchema) && (
        <div className="text-xs text-algo-muted flex gap-3">
          {globalStateSchema && (
            <span>Global: {globalStateSchema.numUint} uint, {globalStateSchema.numByteSlice} bytes</span>
          )}
          {localStateSchema && (
            <span>Local: {localStateSchema.numUint} uint, {localStateSchema.numByteSlice} bytes</span>
          )}
        </div>
      )}
    </div>
  )
}
