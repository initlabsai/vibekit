/**
 * The stock host wiring, shared by every stock host (CLI mcp/tool
 * commands, the reference MCP server). One place to add a tool domain or a
 * plugin; hosts that want a different mix keep composing by hand.
 */
import { readFile } from 'node:fs/promises'

import type { AnyTool, NetworkId, ToolPlugin } from '../core/index.js'
import { alphaArcadePlugin } from '../plugins/alpha-arcade/index.js'
import { nfdPlugin } from '../plugins/nfd/index.js'
import { peraPlugin } from '../plugins/pera/index.js'
import { vestigePlugin } from '../plugins/vestige/index.js'
import { webPlugin } from '../plugins/web/index.js'
import {
  createFundTestnetTool,
  createSigningAccountTool,
  createSigningAddressesTool,
  hasDispenserToken,
  type KeystoreSigner,
} from '../signer-keystore/index.js'
import {
  accountQueries,
  assetQueries,
  assetActions,
  contractQueries,
  contractActions,
  networkQueries,
  transactionQueries,
  transactionActions,
} from '../tools/index.js'

/** Every read, by domain. */
export const defaultQueries: AnyTool[] = [
  ...networkQueries,
  ...accountQueries,
  ...assetQueries,
  ...transactionQueries,
  ...contractQueries,
]

/** Every action — tools that draft a signer-gated transaction group. */
export const defaultActions: AnyTool[] = [...transactionActions, ...assetActions, ...contractActions]

/** The full tool surface: queries before actions. */
export const defaultTools: AnyTool[] = [...defaultQueries, ...defaultActions]

/** The default plugin set — names, market data, asset trust. Fresh instances per call. */
export function defaultPlugins(): ToolPlugin[] {
  return [nfdPlugin(), alphaArcadePlugin(), vestigePlugin(), peraPlugin(), webPlugin()]
}

/**
 * Base tools plus keystore account/signing tools when a signer is up, and
 * the testnet funding tool when its dispenser token is configured.
 */
export async function withKeystoreTools(
  base: AnyTool[],
  signer: KeystoreSigner | undefined,
): Promise<AnyTool[]> {
  if (!signer) return base
  const tools = [...base, createSigningAddressesTool(signer), createSigningAccountTool(signer)]
  if (signer.secrets && (await hasDispenserToken(signer.secrets))) {
    tools.push(createFundTestnetTool(signer.secrets))
  }
  return tools
}

/** The file grant a local host passes as `readFile`: tools may read the user's own files (app specs by path). */
export const readLocalFile = (path: string): Promise<string> => readFile(path, 'utf8')

/** The NETWORK / NETWORKS env convention every stock host reads. */
export function networksFromEnv(
  defaults: { network: NetworkId; networks: NetworkId[] },
  env: Record<string, string | undefined> = process.env,
): { network: NetworkId; networks: NetworkId[] } {
  return {
    network: (env.NETWORK as NetworkId) ?? defaults.network,
    networks:
      (env.NETWORKS?.split(',')
        .map((entry) => entry.trim())
        .filter(Boolean) as NetworkId[]) ?? defaults.networks,
  }
}

export { createHost, type Host } from './host.js'
export {
  createExplorerAgent,
  explorerContext,
  explorerPlugins,
  explorerSystemPrompt,
  explorerTools,
  networkOfCall,
  type ExplorerAgentOptions,
} from './explorer.js'
export { explainApplicationTool } from './explain-tool.js'
