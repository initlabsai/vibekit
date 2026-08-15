import { Semaphore, type ToolContext } from '@initlabs/vibekit-core'

/**
 * Rich network status with TPS, block times, supply, and participation metrics.
 * Samples recent blocks from the indexer for throughput stats.
 */
export async function getNetworkStatus(ctx: ToolContext) {
  const [status, supply] = await Promise.all([ctx.algod.status().do(), ctx.algod.supply().do()])

  const latestRound = Number(status.lastRound)
  const timeSinceLastRound = Number(status.timeSinceLastRound) / 1_000_000_000
  const totalSupply = Number(supply.totalMoney) / 1_000_000
  const onlineStake = Number(supply.onlineMoney) / 1_000_000
  const participation = onlineStake / totalSupply

  // Sample recent blocks for TPS stats. Public free-tier indexers rate-limit
  // bursts, so pace at 3 concurrent and tolerate partial failures — a network
  // status dashboard from 6 blocks beats a 429 for the whole tool.
  const sampleSize = 10
  const pace = new Semaphore(3)
  const settled = await Promise.allSettled(
    Array.from({ length: sampleSize }, (_, i) =>
      pace.run(() => ctx.indexer.lookupBlock(latestRound - i).do()),
    ),
  )
  const blocks = settled
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<ReturnType<typeof ctx.indexer.lookupBlock>['do']>>> => r.status === 'fulfilled')
    .map((r) => r.value)

  const blockData = blocks
    .map((b) => ({
      round: Number(b.round),
      timestamp: Number(b.timestamp),
      txnCount: b.transactions?.length ?? 0,
    }))
    .sort((a, b) => a.round - b.round)

  const blockTimes: number[] = []
  const tpsPerBlock: number[] = []
  for (let i = 1; i < blockData.length; i++) {
    const dt = blockData[i]!.timestamp - blockData[i - 1]!.timestamp
    if (dt > 0) {
      blockTimes.push(dt)
      tpsPerBlock.push(blockData[i]!.txnCount / dt)
    }
  }

  const avgBlockTime =
    blockTimes.length > 0 ? blockTimes.reduce((a, b) => a + b, 0) / blockTimes.length : 0
  const avgTps =
    tpsPerBlock.length > 0 ? tpsPerBlock.reduce((a, b) => a + b, 0) / tpsPerBlock.length : 0
  const totalTxns = blockData.reduce((sum, b) => sum + b.txnCount, 0)

  return {
    network: ctx.network.id,
    latestRound,
    timeSinceLastRound: Math.round(timeSinceLastRound * 100) / 100,
    totalSupply,
    onlineStake,
    participation: Math.round(participation * 1000) / 10,
    avgBlockTime: Math.round(avgBlockTime * 100) / 100,
    avgTps: Math.round(avgTps * 10) / 10,
    peakTps: tpsPerBlock.length > 0 ? Math.round(Math.max(...tpsPerBlock)) : 0,
    avgTxnPerBlock: blockData.length > 0 ? Math.round(totalTxns / blockData.length) : 0,
    totalTxns,
    minBlockTime: blockTimes.length > 0 ? Math.round(Math.min(...blockTimes) * 100) / 100 : 0,
    maxBlockTime: blockTimes.length > 0 ? Math.round(Math.max(...blockTimes) * 100) / 100 : 0,
    consensusVersion: String(status.lastVersion ?? ''),
    catchupTime: Number(status.catchupTime ?? 0),
    blockDetails: blockData.slice(1).map((b, i) => ({
      round: b.round,
      txnCount: b.txnCount,
      blockTime: blockTimes[i] ?? 0,
      tps: Math.round((tpsPerBlock[i] ?? 0) * 10) / 10,
    })),
  }
}
