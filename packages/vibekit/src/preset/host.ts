/**
 * The stock host: a signerless compose-mode deployment over the built-in
 * tools on one network, as reads-as-records, an ActionHost, and the block
 * tail — what the Explorer TUI and the web agent's server build on. Nothing
 * here can sign; a keystore or a wallet adds that behind an approval.
 */
import { resolveDeployment, type NetworkConfig } from '../core/index.js'
import { createActionHost, type DeploymentActionHost } from '../actions/index.js'
import { tickFromAlgodBlock, type BlockTailTick } from '../views/block-tail.js'
import type { LiveNetworkId, ReadHost } from '../views/host.js'
import { createDeploymentReadHost } from '../views/read-host.js'
import { accountQueries, assetQueries, contractQueries, networkQueries, transactionActions, transactionQueries } from '../tools/index.js'

export interface Host extends ReadHost, DeploymentActionHost {
  /** True when the network's algod answers within the timeout. */
  probe(timeoutMs?: number): Promise<boolean>
  /** Current algod lastRound. */
  statusRound(): Promise<{ lastRound: number }>
  /** Resolves when lastRound is greater than `round` (algod wait-for-block). */
  waitAfterBlock(round: number): Promise<{ lastRound: number }>
  /** Reads one confirmed round from algod as feed-ready block + transaction records. */
  readBlockTick(round: number): Promise<BlockTailTick>
}

export function createHost(config: LiveNetworkId | NetworkConfig = 'localnet'): Host {
  const network = typeof config === 'string' ? config : config.id
  const deployment = resolveDeployment({
    network: config,
    mode: 'compose',
    // Every query, so callTool can page any list an agent or a lane fetched; the transaction actions draft.
    tools: [...transactionActions, ...transactionQueries, ...accountQueries, ...assetQueries, ...contractQueries, ...networkQueries],
  })
  const context = deployment.contexts.get(network)
  if (!context) throw new Error(`Deployment is missing network ${network}`)
  const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`
  return {
    ...createDeploymentReadHost(deployment, network),
    ...createActionHost(deployment, network),
    network,
    async probe(timeoutMs = 1500) {
      try {
        await Promise.race([context.algod.status().do(), new Promise((_, reject) => setTimeout(() => reject(new Error('probe timeout')), timeoutMs))])
        return true
      } catch {
        return false
      }
    },
    async statusRound() {
      return { lastRound: Number((await context.algod.status().do()).lastRound) }
    },
    async waitAfterBlock(round) {
      return { lastRound: Number((await context.algod.statusAfterBlock(round).do()).lastRound) }
    },
    async readBlockTick(round) {
      const response = await context.algod.block(round).do()
      const payset = response.block.payset ?? []
      return tickFromAlgodBlock(
        { resultId: newId('result-block-tick'), toolCallId: newId('tool-call-block-tick'), network },
        response.block.header,
        payset.map((entry) => ({ txn: entry.signedTxn.signedTxn.txn, hasGenesisID: entry.hasGenesisID, hasGenesisHash: entry.hasGenesisHash, apply: entry.signedTxn.applyData })),
      )
    },
  }
}
