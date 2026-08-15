/** The full read-tool surface: five published domain packages (Phase 2). */
import type { AnyTool } from '@initlabs/vibekit-core'
import { accountTools } from '@initlabs/vibekit-tools-accounts'
import { assetTools, assetWriteTools } from '@initlabs/vibekit-tools-assets'
import { contractTools, contractWriteTools } from '@initlabs/vibekit-tools-contracts'
import { networkTools } from '@initlabs/vibekit-tools-network'
import { transactionTools, transactionWriteTools } from '@initlabs/vibekit-tools-transactions'

export const tools: AnyTool[] = [
  ...networkTools,
  ...accountTools,
  ...assetTools,
  ...transactionTools,
  ...contractTools,
  ...transactionWriteTools,
  ...assetWriteTools,
  ...contractWriteTools,
]
