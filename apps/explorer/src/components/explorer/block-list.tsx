import { Box } from 'lucide-react'
import { BlockCard } from './block-card'

interface BlockListProps {
  data: Record<string, unknown>
}

export function BlockList({ data }: BlockListProps) {
  const blocks = (data.blocks ?? []) as Record<string, unknown>[]

  return (
    <div className="rounded-lg border border-algo-border bg-algo-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-algo-border">
        <Box className="w-4 h-4 text-algo-teal" />
        <h3 className="text-sm font-semibold text-algo-teal">Blocks ({blocks.length})</h3>
      </div>
      <div className="divide-y divide-algo-border/50">
        {blocks.map((block) => (
          <BlockCard key={String(block.round)} data={block} />
        ))}
      </div>
      {data.nextToken ? (
        <div className="px-4 py-2 text-xs text-algo-muted border-t border-algo-border">
          More results available
        </div>
      ) : null}
    </div>
  )
}
