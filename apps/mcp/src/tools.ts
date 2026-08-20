/** The full read-tool surface: the five tool domains (Phase 2). */
import type { AnyTool } from '@initlabs/vibekit-core'
import {
  accountTools,
  assetTools,
  assetWriteTools,
  contractTools,
  contractWriteTools,
  networkTools,
  transactionTools,
  transactionWriteTools,
} from '@initlabs/vibekit-tools'

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
