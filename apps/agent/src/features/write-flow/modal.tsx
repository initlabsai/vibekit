'use client'

/**
 * The write decision as a true modal: centered over the feed, it owns input
 * until answered. The graph and facts come from the decoded draft bytes —
 * the same record the signer will be handed. Red frame when the simulation
 * failed or the network is mainnet: money on the line, right now.
 */
import type { LiveNetworkId, WriteFlowViewModel } from '@initlabs/vibekit-explorer'
import { useEffect, useRef } from 'react'

import { Button, Header } from '../../primitives'
import { WriteFlowBody, writeKind } from './cards'
import { TransactionsGraphView } from './graph'

export function ApprovalModal({
  model,
  network,
  busy,
  onApprove,
  onDeny,
}: {
  model: WriteFlowViewModel | undefined
  network: LiveNetworkId
  busy: boolean
  onApprove: () => void
  onDeny: () => void
}) {
  const failed = model?.simulation?.wouldSucceed === false
  const danger = failed || network === 'mainnet'
  const approveRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    approveRef.current?.focus()
  }, [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (busy) return
      if (event.key === 'Escape') onDeny()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onDeny])
  const question = model ? `APPROVE THIS ${writeKind(model)}?` : 'APPROVE?'
  return (
    <div className="modal-backdrop" role="presentation">
      <div className={`modal${danger ? ' modal-danger' : ''}`} role="dialog" aria-modal="true" aria-label={question}>
        <p className="modal-title">
          SIGN ▸ <span className={network === 'mainnet' ? 'net-mainnet' : ''}>{network.toUpperCase()}</span>
        </p>
        <Header kicker={question} pill={failed ? 'WOULD FAIL' : 'SIMULATED OK'} tone={failed ? 'danger' : 'ok'} />
        {model ? (
          <>
            {model.graph ? <TransactionsGraphView graph={model.graph} /> : null}
            <WriteFlowBody model={model} />
          </>
        ) : (
          <p className="muted">The write record could not be derived.</p>
        )}
        {failed ? <p className="flow-warning">This group WOULD FAIL if submitted.</p> : null}
        <p className="footnote">Composed from what you typed — these decoded bytes are exactly what gets signed.</p>
        <div className="actions modal-actions">
          <button
            ref={approveRef}
            type="button"
            className={`button ${danger ? 'button-danger' : 'button-primary'}`}
            disabled={busy || !model}
            onClick={onApprove}
          >
            {busy ? 'working…' : failed ? 'approve anyway' : 'approve & sign'}
          </button>
          <Button label="deny" disabled={busy} onPress={onDeny} />
          <span className="footnote modal-keys">enter approve · esc deny</span>
        </div>
      </div>
    </div>
  )
}
