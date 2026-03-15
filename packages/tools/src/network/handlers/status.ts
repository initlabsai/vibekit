import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { sanitizeBigInts, indexerSemaphore as indexerSem } from '@vibekit/core'

/** Rich network status with TPS, block times, supply, and participation metrics. */
export async function getNetworkStatus(algorand: AlgorandClient): Promise<Record<string, unknown>> {
  const algod = algorand.client.algod
  const indexer = algorand.client.indexer

  // Fetch status and supply in parallel
  const [status, supply] = await Promise.all([algod.status().do(), algod.supply().do()])

  const latestRound = Number(status.lastRound)
  const timeSinceLastRound = Number(status.timeSinceLastRound) / 1_000_000_000
  const genesisId = ((status as unknown as Record<string, unknown>)['genesis-id'] as string) ?? ''
  const genesisHash =
    ((status as unknown as Record<string, unknown>)['genesis-hash'] as string) ?? ''
  const lastVersion = status.lastVersion ?? ''
  const catchupTime = Number(status.catchupTime ?? 0)
  const totalSupply = Number(supply.totalMoney) / 1_000_000
  const onlineStake = Number(supply.onlineMoney) / 1_000_000
  const participation = onlineStake / totalSupply

  // Sample recent blocks for TPS and block time stats
  const sampleSize = 10
  const blocks = await Promise.all(
    Array.from({ length: sampleSize }, (_, i) =>
      indexerSem.run(() => indexer.lookupBlock(latestRound - i).do())
    )
  )

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
    const dt = blockData[i].timestamp - blockData[i - 1].timestamp
    if (dt > 0) {
      blockTimes.push(dt)
      tpsPerBlock.push(blockData[i].txnCount / dt)
    }
  }

  const avgBlockTime =
    blockTimes.length > 0 ? blockTimes.reduce((a, b) => a + b, 0) / blockTimes.length : 0
  const avgTps =
    tpsPerBlock.length > 0 ? tpsPerBlock.reduce((a, b) => a + b, 0) / tpsPerBlock.length : 0
  const peakTps = tpsPerBlock.length > 0 ? Math.max(...tpsPerBlock) : 0
  const totalTxns = blockData.reduce((sum, b) => sum + b.txnCount, 0)
  const avgTxnPerBlock = blockData.length > 0 ? totalTxns / blockData.length : 0

  return sanitizeBigInts({
    latestRound,
    timeSinceLastRound: Math.round(timeSinceLastRound * 100) / 100,
    totalSupply,
    onlineStake,
    participation: Math.round(participation * 1000) / 10,
    avgBlockTime: Math.round(avgBlockTime * 100) / 100,
    avgTps: Math.round(avgTps * 10) / 10,
    peakTps: Math.round(peakTps),
    avgTxnPerBlock: Math.round(avgTxnPerBlock),
    sampleBlocks: sampleSize,
    tpsTrend: tpsPerBlock,
    blockDetails: blockData.slice(1).map((b, i) => ({
      round: b.round,
      txnCount: b.txnCount,
      blockTime: blockTimes[i] ?? 0,
      tps: Math.round((tpsPerBlock[i] ?? 0) * 10) / 10,
    })),
    totalTxns,
    minBlockTime: blockTimes.length > 0 ? Math.round(Math.min(...blockTimes) * 100) / 100 : 0,
    maxBlockTime: blockTimes.length > 0 ? Math.round(Math.max(...blockTimes) * 100) / 100 : 0,
    genesisId,
    genesisHash,
    consensusVersion: lastVersion,
    catchupTime,
    blockTimeTrend: blockTimes,
  }) as Record<string, unknown>
}
