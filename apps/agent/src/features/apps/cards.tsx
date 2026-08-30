'use client'

import type { ApplicationDetailViewModel, ApplicationExplanationViewModel, ApplicationMethodsViewModel, ApplicationProgramViewModel } from '@initlabs/vibekit/views'

import { bytesDisplay, MoreFooter, Table, type Column } from '../../generic-cards'
import { Button, Copyable, Fact, Facts, FooterNote, Frame, Header, Hero, Unavailable } from '../../primitives'
import { shorten } from '../../theme'

type StateEntry = { key: string; value: string; type?: string }

function StateFacts({ entries, max = 12 }: { entries: ReadonlyArray<StateEntry>; max?: number }) {
  return (
    <>
      {entries.slice(0, max).map((entry) => (
        <Fact key={entry.key} label={shorten(entry.key, 16)} value={entry.type ? `${entry.type} · ${entry.value}` : entry.value} />
      ))}
      {entries.length > max ? <FooterNote text={`${entries.length - max} more keys`} /> : null}
    </>
  )
}

export function ApplicationCard({
  model,
  onTransactions,
}: {
  model: ApplicationDetailViewModel | undefined
  onTransactions?: () => void
}) {
  if (!model) return <Unavailable title="APPLICATION" />
  const global = model.globalStateSchema
  const local = model.localStateSchema
  return (
    <Frame>
      <Header
        kicker="APPLICATION"
        chip={model.deleted ? 'deleted' : undefined}
        pill={model.deleted ? 'DELETED' : model.network.toUpperCase()}
        tone={model.deleted ? 'danger' : 'idle'}
        action={onTransactions ? <Button label="transactions ▸" onPress={onTransactions} /> : undefined}
      />
      <Hero value={`#${model.applicationId}`} copy={String(model.applicationId)} />
      <Facts>
        <Fact label="creator" value={model.creator ?? '—'} copy={model.creator} />
        {model.createdAtRound === undefined ? null : (
          <Fact label="created" value={`round ${model.createdAtRound}`} copy={String(model.createdAtRound)} open={{ kind: 'block', round: model.createdAtRound }} />
        )}
        {model.deleted ? (
          <Fact
            label="deleted"
            tone="danger"
            value={model.deletedAtRound === undefined ? 'yes' : `round ${model.deletedAtRound}`}
            {...(model.deletedAtRound === undefined ? {} : { copy: String(model.deletedAtRound), open: { kind: 'block' as const, round: model.deletedAtRound } })}
          />
        ) : null}
        {model.account ? <Fact label="account" value={model.account} copy={model.account} /> : null}
        <Fact label="keys" value={String(model.globalStateCount)} />
        {global ? <Fact label="global schema" value={`${global.numByteSlice} bytes · ${global.numUint} uint`} /> : null}
        {local ? <Fact label="local schema" value={`${local.numByteSlice} bytes · ${local.numUint} uint`} /> : null}
      </Facts>
      {model.globalState && model.globalState.length > 0 ? (
        <Facts>
          {model.globalState.map((entry, index) => (
            <Fact
              key={`${entry.key}-${index}`}
              label={shorten(entry.key, 16)}
              value={entry.type === 'uint' ? String(entry.uint ?? 0) : bytesDisplay(entry.bytes ?? '')}
            />
          ))}
        </Facts>
      ) : null}
    </Frame>
  )
}

const PROGRAM_PREVIEW_LINES = 40

/** One page of disassembled TEAL with the facts a static pass can prove. */
export function ApplicationProgramCard({ model }: { model: ApplicationProgramViewModel | undefined }) {
  if (!model) return <Unavailable title="PROGRAM" />
  const facts = model.analysis
  const reads = [
    facts.guards.rekey ? 'RekeyTo' : '',
    facts.guards.closeRemainder ? 'CloseRemainderTo' : '',
    facts.guards.assetClose ? 'AssetCloseTo' : '',
  ].filter(Boolean)
  const handled = facts.onCompletion.filter((e) => e.outcome === 'handled').map((e) => e.action)
  const rejected = facts.onCompletion.filter((e) => e.outcome === 'rejected').map((e) => e.action)
  const onComplete = [handled.length ? `${handled.join(', ')} handled` : '', rejected.length ? `${rejected.join(', ')} rejected` : '']
    .filter(Boolean)
    .join(' · ')
  const preview = model.teal.split('\n').slice(0, PROGRAM_PREVIEW_LINES)
  const hidden = model.totalLines - model.fromLine + 1 - preview.length
  const tail = hidden > 0 ? `${hidden.toLocaleString()} more lines · this page read ${model.fromLine}–${model.toLine}` : ''
  const firstPage = model.fromLine === 1
  return (
    <Frame>
      <Header
        kicker="PROGRAM"
        chip={firstPage ? (facts.entrypoints.length === 0 ? `${model.program} · bare calls only` : model.program) : `${model.program} · lines ${model.fromLine}–${model.toLine}`}
        pill={model.network.toUpperCase()}
      />
      {firstPage ? (
        <>
          <Hero
            value={`#${model.applicationId}`}
            copy={String(model.applicationId)}
            unit={`${facts.version !== undefined ? `v${facts.version} · ` : ''}${model.bytes.toLocaleString()} bytes · ${model.totalLines.toLocaleString()} lines`}
          />
          <Facts>
            {facts.stateKeys.global.length > 0 ? <Fact label="global" value={facts.stateKeys.global.join(', ')} /> : null}
            {facts.stateKeys.local.length > 0 ? <Fact label="local" value={facts.stateKeys.local.join(', ')} /> : null}
            {facts.stateKeys.box.length > 0 ? <Fact label="boxes" value={facts.stateKeys.box.join(', ')} /> : null}
            {facts.arc4Returns ? <Fact label="returns" value="ARC-4 — logged behind the 0x151f7c75 return prefix" /> : null}
            <Fact label="reads" value={reads.length ? reads.join(', ') : 'none of RekeyTo, CloseRemainderTo, AssetCloseTo'} />
            <Fact label="inner txns" value={String(facts.innerTransactions)} />
            {onComplete ? <Fact label="oncomplete" value={onComplete} /> : null}
          </Facts>
        </>
      ) : null}
      <pre className="raw">{preview.join('\n')}</pre>
      {tail ? <FooterNote text={tail} /> : null}
    </Frame>
  )
}

/** The call surface: entrypoint names from the program, signatures when a spec is known. */
export function ApplicationMethodsCard({ model }: { model: ApplicationMethodsViewModel | undefined }) {
  if (!model) return <Unavailable title="METHODS" />
  const bySelector = new Map(model.methods.map((m) => [`0x${m.selector}`, m]))
  const rows = model.analysis.entrypoints.map((entry) => {
    const known = bySelector.get(entry)
    const args = known?.args?.map((a) => (a.name ? `${a.name}: ${a.type}` : a.type)).join(', ')
    return {
      name: known?.name ?? entry,
      signature: known?.signature ? `(${args ?? ''}) → ${known.returns ?? 'void'}` : '',
      readonly: known?.readonly === true,
      description: known?.description,
    }
  })
  const specKnown = rows.some((row) => row.signature)
  return (
    <Frame>
      <Header kicker="METHODS" chip={`${rows.length} · ${model.methods.length > 0 ? 'ARC-4' : 'string-routed'}`} pill={model.network.toUpperCase()} />
      {rows.length === 0 ? (
        <FooterNote text="no entrypoints — bare calls only" />
      ) : (
        <Facts>
          {rows.map((row) => (
            <Fact key={row.name} label={shorten(row.name, 16)}>
              <span>{row.signature || row.name}</span>
              {row.readonly ? <span className="muted"> · read-only</span> : null}
              {row.description ? <span className="line muted">{row.description}</span> : null}
            </Fact>
          ))}
        </Facts>
      )}
      {rows.length > 0 && !specKnown ? <FooterNote text="no spec known for this app — entrypoints show as selectors" /> : null}
    </Frame>
  )
}

/** The agent's write-up as plain text; the AGENT pill says whose words these are. */
export function ApplicationExplanationCard({ model }: { model: ApplicationExplanationViewModel | undefined }) {
  if (!model) return <Unavailable title="EXPLANATION" />
  return (
    <Frame>
      <Header kicker="EXPLANATION" chip={`app ${model.applicationId}`} pill="AGENT" tone="warn" />
      <pre className="prose">{model.markdown}</pre>
    </Frame>
  )
}

type ApplicationRow = { applicationId: number | string; creator?: string; globalStateCount?: number }

export function ApplicationListCard({
  applications,
  nextToken,
  onMore,
  loadingMore,
  onOpen,
}: {
  applications: ReadonlyArray<ApplicationRow>
  nextToken?: string
  onMore?: () => void
  loadingMore?: boolean
  onOpen?: (applicationId: number) => void
}) {
  const columns: Column<ApplicationRow>[] = [
    { key: 'id', label: 'id', width: 'minmax(6rem, .7fr)', sortValue: (a) => BigInt(a.applicationId), cell: (a) => <span className="tt-kind">{String(a.applicationId)}</span> },
    { key: 'creator', label: 'creator', width: 'minmax(10rem, 1.6fr)', cell: (a) => (a.creator ? <Copyable value={a.creator} display={shorten(a.creator, 20)} /> : '') },
    { key: 'keys', label: 'keys', align: 'right', width: 'minmax(4rem, .5fr)', sortValue: (a) => a.globalStateCount ?? 0, cell: (a) => String(a.globalStateCount ?? 0) },
  ]
  return (
    <Frame>
      <Header kicker="APPLICATIONS" pill={String(applications.length)} tone="idle" />
      {applications.length === 0 ? (
        <FooterNote text="No applications." />
      ) : (
        <Table
          columns={columns}
          rows={applications}
          keyOf={(a) => String(a.applicationId)}
          searchText={(a) => `${a.applicationId} ${a.creator ?? ''}`}
          onOpen={onOpen ? (a) => onOpen(Number(a.applicationId)) : undefined}
        />
      )}
      <MoreFooter count={applications.length} nextToken={nextToken} onMore={onMore} loadingMore={loadingMore} />
    </Frame>
  )
}

export function ApplicationStateCard({
  applicationId,
  scope,
  address,
  optedIn,
  entries,
}: {
  applicationId: number | string
  scope: 'global' | 'local'
  address?: string
  optedIn?: boolean
  entries: ReadonlyArray<StateEntry>
}) {
  return (
    <Frame>
      <Header kicker="APP STATE" pill={scope.toUpperCase()} tone="idle" />
      <Facts>
        <Fact label="app" value={String(applicationId)} copy={String(applicationId)} open={{ kind: 'application', applicationId: Number(applicationId) }} />
        {address ? <Fact label="address" value={address} copy={address} /> : null}
        {optedIn === undefined ? null : <Fact label="opted" value={optedIn ? 'yes' : 'no'} />}
        <Fact label="keys" value={`${entries.length} key${entries.length === 1 ? '' : 's'}`} />
        <StateFacts entries={entries} />
      </Facts>
    </Frame>
  )
}

export function ApplicationLocalsCard({
  address,
  apps,
  nextToken,
  onMore,
  loadingMore,
  onOpen,
}: {
  address?: string
  apps: ReadonlyArray<{ applicationId: number | string; entries: ReadonlyArray<StateEntry> }>
  nextToken?: string
  onMore?: () => void
  loadingMore?: boolean
  onOpen?: (applicationId: number) => void
}) {
  return (
    <Frame>
      <Header kicker="APP LOCALS" pill={String(apps.length)} tone="idle" />
      {address ? (
        <Facts>
          <Fact label="address" value={address} copy={address} />
        </Facts>
      ) : null}
      {apps.map((app) => (
        <Facts key={String(app.applicationId)}>
          <Fact label="app">
            <Copyable value={String(app.applicationId)} open={{ kind: 'application', applicationId: Number(app.applicationId) }} />
          </Fact>
          <StateFacts entries={app.entries} max={6} />
        </Facts>
      ))}
      {apps.length === 0 ? <FooterNote text="No local state." /> : null}
      <MoreFooter count={apps.length} nextToken={nextToken} onMore={onMore} loadingMore={loadingMore} />
    </Frame>
  )
}

export function ApplicationLogsCard({
  applicationId,
  logData,
  nextToken,
  onMore,
  loadingMore,
  onOpen,
}: {
  applicationId: number | string
  logData: ReadonlyArray<{ txid: string; logs: string[] }>
  nextToken?: string
  onMore?: () => void
  loadingMore?: boolean
  onOpen?: (txid: string) => void
}) {
  return (
    <Frame>
      <Header kicker="APP LOGS" chip={`app ${applicationId}`} pill={String(logData.length)} tone="idle" />
      {logData.map((row) => (
        <Facts key={row.txid}>
          <Fact label="txn">
            <Copyable value={row.txid} display={shorten(row.txid, 20)} />
          </Fact>
          {row.logs.slice(0, 3).map((line, index) => (
            <Fact key={index} label={`log ${index}`} value={bytesDisplay(line)} />
          ))}
          {row.logs.length > 3 ? <FooterNote text={`${row.logs.length - 3} more logs`} /> : null}
        </Facts>
      ))}
      {logData.length === 0 ? <FooterNote text="No logs." /> : null}
      <MoreFooter count={logData.length} nextToken={nextToken} onMore={onMore} loadingMore={loadingMore} />
    </Frame>
  )
}

export function ApplicationBoxCard({
  applicationId,
  boxName,
  exists,
  value,
  size,
}: {
  applicationId: number | string
  boxName: string
  exists: boolean
  value?: string
  size?: number
}) {
  return (
    <Frame>
      <Header kicker="APP BOX" pill={exists ? 'EXISTS' : 'MISSING'} tone={exists ? 'ok' : 'idle'} />
      <Facts>
        <Fact label="app" value={String(applicationId)} copy={String(applicationId)} open={{ kind: 'application', applicationId: Number(applicationId) }} />
        <Fact label="name" value={boxName} />
        {exists && size !== undefined ? <Fact label="size" value={`${size} bytes`} /> : null}
        {exists ? <Fact label="value" value={value ?? ''} /> : null}
      </Facts>
      {exists ? null : <FooterNote text="box does not exist" />}
    </Frame>
  )
}

export function ApplicationBoxesCard({
  applicationId,
  boxes,
  truncated,
}: {
  applicationId: number | string
  boxes: ReadonlyArray<{ name: string; nameBase64: string }>
  truncated?: boolean
}) {
  return (
    <Frame>
      <Header kicker="APP BOXES" pill={String(boxes.length)} tone="idle" />
      <Hero value={`#${applicationId}`} copy={String(applicationId)} />
      {boxes.length === 0 ? (
        <FooterNote text="no boxes" />
      ) : (
        <Facts>
          {boxes.map((box, index) => (
            <Fact key={box.nameBase64} label={`box ${index + 1}`} value={box.name} copy={box.nameBase64} />
          ))}
        </Facts>
      )}
      {truncated ? <FooterNote text="more boxes beyond this page" /> : null}
    </Frame>
  )
}
