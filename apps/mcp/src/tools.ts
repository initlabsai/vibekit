/** The full read-tool surface: five published domain packages (Phase 2). */
import type { AnyTool } from '@initlabs/core'
import { accountTools } from '@initlabs/tools-accounts'
import { assetTools, assetWriteTools } from '@initlabs/tools-assets'
import { contractTools, contractWriteTools } from '@initlabs/tools-contracts'
import { networkTools } from '@initlabs/tools-network'
import { transactionTools, transactionWriteTools } from '@initlabs/tools-transactions'

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
