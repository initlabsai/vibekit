'use client'

import { AccountSummary } from '../explorer/account-summary'
import { TransactionList } from '../explorer/transaction-list'
import { TransactionDetail } from '../explorer/transaction-detail'
import { AssetInfo } from '../explorer/asset-info'
import { AssetHolders } from '../explorer/asset-holders'
import { BlockInfo } from '../explorer/block-info'
import { ApplicationInfo } from '../explorer/application-info'
import { AssetList } from '../explorer/asset-list'
import { AccountPortfolio } from '../explorer/account-portfolio'
import { NfdCard } from '../explorer/nfd-card'
import { NfdList } from '../explorer/nfd-list'
import { AccountList } from '../explorer/account-list'
import { ApplicationList } from '../explorer/application-list'
import { BlockList } from '../explorer/block-list'
import { ApplicationLocalState } from '../explorer/application-local-state'
import { TransactionGroup } from '../explorer/transaction-group'
import { NetworkStatus } from '../explorer/network-status'

interface ToolResultProps {
  toolName: string
  result: unknown
}

export function ToolResult({ toolName, result }: ToolResultProps) {
  // Surface tool errors with distinct styling
  if (result && typeof result === 'object' && 'error' in result) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
        <p className="text-xs font-medium text-red-400">Tool error: {toolName}</p>
        <p className="text-xs text-red-400/70 mt-1">{(result as { error: string }).error}</p>
        <p className="text-xs text-red-400/50 mt-2">
          Something wrong?{' '}
          <a
            href="https://github.com/gabrielkuettel/vibekit/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-red-400 transition-colors"
          >
            Report an issue
          </a>
        </p>
      </div>
    )
  }

  switch (toolName) {
    case 'lookup_account':
      return <AccountSummary data={result as Record<string, unknown>} />

    case 'search_account_transactions':
    case 'search_transactions':
    case 'search_asset_transactions':
      return <TransactionList data={result as Record<string, unknown>} />

    case 'lookup_transaction':
      return <TransactionDetail data={result as Record<string, unknown>} />

    case 'lookup_asset':
      return <AssetInfo data={result as Record<string, unknown>} />

    case 'get_account_portfolio':
      return <AccountPortfolio data={result as Record<string, unknown>} />

    case 'search_asset_balances':
      return <AssetHolders data={result as Record<string, unknown>} />

    case 'lookup_block':
      return <BlockInfo data={result as Record<string, unknown>} />

    case 'lookup_application':
      return <ApplicationInfo data={result as Record<string, unknown>} />

    case 'get_account_assets':
    case 'search_assets':
      return <AssetList data={result as Record<string, unknown>} />

    case 'resolve_nfd':
    case 'reverse_resolve_nfd':
      return <NfdCard data={result as Record<string, unknown>} />

    case 'batch_reverse_resolve_nfd':
      return <NfdList data={result as Record<string, unknown>} />

    case 'search_accounts':
    case 'batch_lookup_accounts':
      return <AccountList data={result as Record<string, unknown>} />

    case 'get_account_app_local_states':
      return <ApplicationLocalState data={result as Record<string, unknown>} />

    case 'search_applications':
      return <ApplicationList data={result as Record<string, unknown>} />

    case 'lookup_transaction_group':
      return <TransactionGroup data={result as Record<string, unknown>} />

    case 'get_network_status':
      return <NetworkStatus data={result as Record<string, unknown>} />

    case 'search_block_headers':
      return <BlockList data={result as Record<string, unknown>} />

    default:
      return <GenericResult data={result} />
  }
}

function GenericResult({ data }: { data: unknown }) {
  return (
    <div className="rounded-lg border border-algo-border bg-algo-card p-3 overflow-x-auto">
      <pre className="text-xs text-algo-muted whitespace-pre-wrap">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}
