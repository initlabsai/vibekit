import { Wallet } from 'lucide-react'
import { AccountCard } from './account-card'

interface AccountListProps {
  data: Record<string, unknown>
}

export function AccountList({ data }: AccountListProps) {
  const accounts = (data.accounts ?? []) as Record<string, unknown>[]

  return (
    <div className="rounded-lg border border-algo-border bg-algo-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-algo-border">
        <Wallet className="w-4 h-4 text-algo-teal" />
        <h3 className="text-sm font-semibold text-algo-teal">Accounts ({accounts.length})</h3>
      </div>
      <div className="divide-y divide-algo-border/50">
        {accounts.map((account) => (
          <AccountCard key={String(account.address)} data={account} />
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
