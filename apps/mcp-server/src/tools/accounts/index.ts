/**
 * Account Tools (MCP-specific)
 *
 * Tools that depend on MCP AppState for account management.
 * Payment operations are now in @vibekit/accounts domain package.
 */

import type { ToolRegistration } from '../types.js'

import { listAccountsTool, handleListAccounts } from './list-accounts.js'
import { getAccountInfoTool, handleGetAccountInfo } from './get-account-info.js'
import { fundAccountTool, handleFundAccount } from './fund-account.js'
import { createAccountTool, handleCreateAccount } from './create-account.js'
import { switchAccountTool, handleSwitchAccount } from './switch-account.js'
import { getActiveAccountTool, handleGetActiveAccount } from './get-active-account.js'

// Re-export requireProviderAvailable from service for backwards compatibility
export { requireProviderAvailable } from '../../lib/account-service.js'

export const accountTools: ToolRegistration[] = [
  { definition: listAccountsTool, handler: handleListAccounts },
  { definition: getAccountInfoTool, handler: handleGetAccountInfo },
  { definition: fundAccountTool, handler: handleFundAccount },
  { definition: createAccountTool, handler: handleCreateAccount },
  { definition: switchAccountTool, handler: handleSwitchAccount },
  { definition: getActiveAccountTool, handler: handleGetActiveAccount },
]
