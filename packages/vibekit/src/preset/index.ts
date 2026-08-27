/**
 * The batteries-included host wiring, shared by every stock host (CLI mcp/tool
 * commands, the reference MCP server). One place to add a tool domain or a
 * plugin; hosts that want a different mix keep composing by hand.
 */
import type { AnyTool, NetworkId, ToolPlugin } from '../core/index.js'
import { alphaArcadePlugin } from '../plugins/alpha-arcade/index.js'
import { nfdPlugin } from '../plugins/nfd/index.js'
import { peraPlugin } from '../plugins/pera/index.js'
import { vestigePlugin } from '../plugins/vestige/index.js'
import {
  createFundTestnetTool,
  createSigningAccountTool,
  createSigningAddressesTool,
  hasDispenserToken,
  type KeystoreSigner,
} from '../signer-keystore/index.js'
import {
  accountTools,
  assetTools,
  assetWriteTools,
  contractTools,
  contractWriteTools,
  networkTools,
  transactionTools,
  transactionWriteTools,
} from '../tools/index.js'

/** The full tool surface: every domain, reads before writes. */
export const defaultTools: AnyTool[] = [
  ...networkTools,
  ...accountTools,
  ...assetTools,
  ...transactionTools,
  ...contractTools,
  ...transactionWriteTools,
  ...assetWriteTools,
  ...contractWriteTools,
]

/** The default plugin set — names, market data, asset trust. Fresh instances per call. */
export function defaultPlugins(): ToolPlugin[] {
  return [nfdPlugin(), alphaArcadePlugin(), vestigePlugin(), peraPlugin()]
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
