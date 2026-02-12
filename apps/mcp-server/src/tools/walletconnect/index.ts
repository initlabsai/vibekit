/**
 * WalletConnect Tools
 *
 * Tools for connecting and managing mobile wallet connections via WalletConnect.
 */

import type { ToolRegistration } from '../types.js'
import { connectWalletconnectTool } from './connect.js'
import { walletconnectStatusTool } from './status.js'
import { disconnectWalletconnectTool } from './disconnect.js'

export const walletconnectTools: ToolRegistration[] = [
  connectWalletconnectTool,
  walletconnectStatusTool,
  disconnectWalletconnectTool,
]
