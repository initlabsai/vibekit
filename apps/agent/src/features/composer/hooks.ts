/**
 * What a composer submission or a card drill-in does: route the input, open
 * a section in the transcript, and hand it to the lane that owns it. Screen
 * names are routes; everything else lands in the feed.
 */
import type { LiveNetworkId } from '@initlabs/vibekit-explorer'
import { useCallback } from 'react'

import { HELP, routeComposerInput } from '../../commands'
import type { Feed } from '../../feed/hooks'
import type { useLookups } from '../../lookup'
import type { OpenTarget } from '../../result-card'
import { NETWORKS } from '../network/hooks'
import type { useWriteFlow } from '../write-flow/hooks'

export function useComposer({
  pathname,
  push,
  feed,
  lookups,
  payment,
  networkRef,
  setNetwork,
  setStatus,
  runAgent,
  buyCredits,
}: {
  pathname: string
  push: (href: string) => void
  feed: Feed
  lookups: ReturnType<typeof useLookups>
  payment: ReturnType<typeof useWriteFlow>
  networkRef: { current: LiveNetworkId }
  setNetwork: (network: LiveNetworkId) => void
  setStatus: (text: string) => void
  /** The agent lane; it says so itself when no agent is configured. */
  runAgent: (sectionId: number, input: string) => Promise<void>
  /** Buys a credit pack through the wallet; resolves to the line to show. */
  buyCredits: () => Promise<string>
}) {
  const { createSection, appendNote } = feed
  const goHome = useCallback(() => {
    if (pathname !== '/') push('/')
  }, [pathname, push])

  const switchNetwork = useCallback(
    (target: LiveNetworkId | undefined, sectionId?: number) => {
      const report = (text: string, tone: 'muted' | 'error' = 'muted') =>
        sectionId === undefined ? setStatus(text) : appendNote(sectionId, text, tone)
      if (payment.flowRef.current !== null) {
        report('Finish or deny the write before switching networks.', 'error')
        return
      }
      const current = networkRef.current
      const next = target ?? NETWORKS[(NETWORKS.indexOf(current) + 1) % NETWORKS.length]!
      if (next === current) {
        report(`Already on ${next}.`)
        return
      }
      setNetwork(next)
      report(`Switched to ${next}. Existing sections keep their original network.`)
    },
    [appendNote, networkRef, payment.flowRef, setNetwork, setStatus],
  )

  /** Drill-in from any card: its own section, same lanes as typed input. */
  const openTarget = useCallback(
    (target: OpenTarget) => {
      goHome()
      switch (target.kind) {
        case 'transaction':
          return void lookups.openTransaction(createSection(target.txid), target.txid)
        case 'group':
          return void lookups.openGroup(createSection(`group ${target.groupId.slice(0, 8)}…`), target.groupId)
        case 'account':
          return void lookups.openAccount(createSection(target.address), target.address)
        case 'asset':
          return void lookups.openAsset(createSection(`asset ${target.assetId}`), target.assetId)
        case 'application':
          return void lookups.openApplication(createSection(`app ${target.applicationId}`), target.applicationId)
        case 'block':
          return void lookups.openBlock(createSection(`block ${target.round}`), target.round)
        case 'holdings':
          return void lookups.openHoldings(createSection(`assets of ${target.address.slice(0, 8)}…`), target.address)
        case 'transactions':
          return void lookups.openTransactions(createSection('transactions'), target.filter)
      }
    },
    [createSection, goHome, lookups],
  )

  const submit = useCallback(
    (raw: string) => {
      const outcome = routeComposerInput(raw)
      if (outcome.status === 'nav') return push(`/${outcome.screen}`)
      goHome()
      const sectionId = createSection(raw.trim())
      switch (outcome.status) {
        case 'payment':
          return payment.startPayment(sectionId, outcome.amountMicroAlgos, outcome.to)
        case 'transaction':
          return void lookups.openTransaction(sectionId, outcome.txid)
        case 'group':
          return void lookups.openGroup(sectionId, outcome.groupId)
        case 'account':
          return void lookups.openAccount(sectionId, outcome.address)
        case 'account-name':
          return void lookups.openAccountName(sectionId, outcome.name)
        case 'account-list':
          return void lookups.openMyAccounts(sectionId)
        case 'asset':
          return void lookups.openAsset(sectionId, outcome.assetId)
        case 'application':
          return void lookups.openApplication(sectionId, outcome.applicationId)
        case 'block':
          return void lookups.openBlock(sectionId, outcome.round)
        case 'network':
          if (outcome.network) return switchNetwork(outcome.network, sectionId)
          return appendNote(sectionId, `You're on ${networkRef.current}. Use "/network localnet|testnet|mainnet" or click the chip to switch.`)
        case 'network-status':
          return void lookups.openNetworkStatus(sectionId)
        case 'buy':
          appendNote(sectionId, 'Opening your wallet to pay…')
          return void buyCredits().then(
            (line) => appendNote(sectionId, line),
            (error: unknown) => appendNote(sectionId, `Couldn't buy — ${error instanceof Error ? error.message : String(error)}`, 'error'),
          )
        case 'help':
          return appendNote(sectionId, HELP)
        case 'ambiguous':
          return void lookups.openAmbiguous(sectionId, outcome.value)
        case 'text':
          return void runAgent(sectionId, outcome.text)
      }
    },
    [appendNote, buyCredits, createSection, goHome, lookups, networkRef, payment, push, runAgent, switchNetwork],
  )

  return { submit, openTarget, switchNetwork, goHome }
}
