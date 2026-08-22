import type {
  ApplicationDetailViewModel,
  ApplicationExplanationViewModel,
  ApplicationMethodsViewModel,
  ApplicationProgramViewModel,
} from '@initlabs/vibekit-experience'

import { COLORS, shorten } from '../theme.js'
import {
  Button,
  Fact,
  FooterNote,
  Frame,
  Header,
  Hero,
  innerWidth,
  markdownStyle,
  Rule,
  Unavailable,
} from '../ui.js'
import { bytesDisplay, pageNotes } from './shared.js'

export function ApplicationCard({
  model,
  width,
  onTransactions,
  onExplain,
}: {
  model: ApplicationDetailViewModel | undefined
  width: number
  onTransactions?: () => void
  /** Asks the agent to read and explain the program (cost-confirmed). */
  onExplain?: () => void
}) {
  if (!model) return <Unavailable title="APPLICATION" width={width} />
  const body = innerWidth(width)
  const global = model.globalStateSchema
  const local = model.localStateSchema
  return (
    <Frame width={width}>
      <Header
        kicker="APPLICATION"
        pill={model.network.toUpperCase()}
        tone="idle"
        action={
          <>
            {onExplain ? <Button label="explain ▸" onPress={onExplain} /> : null}
            {onTransactions ? <Button label="transactions ▸" onPress={onTransactions} /> : null}
          </>
        }
      />
      <Hero value={`#${model.applicationId}`} copy={String(model.applicationId)} />
      <box marginTop={1} flexDirection="column">
        <Rule width={body} />
        <Fact
          label="creator"
          value={model.creator ?? '—'}
          copy={model.creator}
          width={body}
        />
        {model.account ? (
          <Fact label="account" value={model.account} copy={model.account} width={body} />
        ) : null}
        <Fact
          label="keys"
          value={`${model.globalStateCount} key${model.globalStateCount === 1 ? '' : 's'}`}
          width={body}
        />
        {global ? <Fact label="g-bytes" value={String(global.numByteSlice)} width={body} /> : null}
        {global ? <Fact label="g-uint" value={String(global.numUint)} width={body} /> : null}
        {local ? <Fact label="l-bytes" value={String(local.numByteSlice)} width={body} /> : null}
        {local ? <Fact label="l-uint" value={String(local.numUint)} width={body} /> : null}
        {model.globalState && model.globalState.length > 0 ? (
          <>
            <Rule width={body} />
            {model.globalState.map((entry, index) => (
              <Fact
                key={`${entry.key}-${index}`}
                label={entry.key}
                value={entry.type === 'uint' ? String(entry.uint ?? 0) : bytesDisplay(entry.bytes ?? '')}
                width={body}
              />
            ))}
          </>
        ) : null}
      </box>
    </Frame>
  )
}

const PROGRAM_PREVIEW_LINES = 10

/** One page of disassembled TEAL with the facts a static pass can prove. */
export function ApplicationProgramCard({
  model,
  width,
}: {
  model: ApplicationProgramViewModel | undefined
  width: number
}) {
  if (!model) return <Unavailable title="PROGRAM" width={width} />
  const body = innerWidth(width)
  const facts = model.analysis
  const nameOf = new Map(model.methods.filter((m) => m.name).map((m) => [`0x${m.selector}`, m.name!]))
  const entrypoints = facts.entrypoints.map((entry) => nameOf.get(entry) ?? entry)
  const methodsLine =
    entrypoints.length === 0
      ? 'none found (bare calls only)'
      : `${entrypoints.length}${facts.selectors.length > 0 ? ' ABI' : ''} · ${entrypoints.join(', ')}`
  const reads = [
    facts.guards.rekey ? 'RekeyTo' : '',
    facts.guards.closeRemainder ? 'CloseRemainderTo' : '',
    facts.guards.assetClose ? 'AssetCloseTo' : '',
  ].filter(Boolean)
  const handled = facts.onCompletion.filter((e) => e.outcome === 'handled').map((e) => e.action)
  const rejected = facts.onCompletion.filter((e) => e.outcome === 'rejected').map((e) => e.action)
  const onComplete = [
    handled.length ? `${handled.join(', ')} handled` : '',
    rejected.length ? `${rejected.join(', ')} rejected` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  const preview = model.teal.split('\n').slice(0, PROGRAM_PREVIEW_LINES)
  const hidden = model.totalLines - model.fromLine + 1 - preview.length
  const tail = hidden > 0 ? `${hidden.toLocaleString()} more lines · the agent read ${model.fromLine}–${model.toLine}` : ''
  // Later pages of the same program: the facts are on the first card already.
  if (model.fromLine > 1) {
    return (
      <Frame width={width}>
        <Header kicker="PROGRAM" chip={`${model.program} · lines ${model.fromLine}–${model.toLine}`} pill={model.network.toUpperCase()} tone="idle" />
        <text fg={COLORS.faint} marginTop={1} content={preview.map((line) => shorten(line, body)).join('\n')} />
        {tail ? <FooterNote text={tail} width={body} /> : null}
      </Frame>
    )
  }
  return (
    <Frame width={width}>
      <Header kicker="PROGRAM" chip={model.program} pill={model.network.toUpperCase()} tone="idle" />
      <Hero
        value={`#${model.applicationId}`}
        copy={String(model.applicationId)}
        unit={`${facts.version !== undefined ? `v${facts.version} · ` : ''}${model.bytes.toLocaleString()} bytes · ${model.totalLines.toLocaleString()} lines`}
      />
      <box marginTop={1} flexDirection="column">
        <Rule width={body} />
        <Fact label="entrypoints" value={methodsLine} width={body} />
        {facts.stateKeys.global.length > 0 ? (
          <Fact label="global" value={facts.stateKeys.global.join(', ')} width={body} />
        ) : null}
        {facts.stateKeys.local.length > 0 ? (
          <Fact label="local" value={facts.stateKeys.local.join(', ')} width={body} />
        ) : null}
        {facts.stateKeys.box.length > 0 ? (
          <Fact label="boxes" value={facts.stateKeys.box.join(', ')} width={body} />
        ) : null}
        {facts.arc4Returns ? (
          <Fact label="returns" value="ARC-4 — logged behind the 0x151f7c75 return prefix" width={body} />
        ) : null}
        <Fact label="reads" value={reads.length ? reads.join(', ') : 'none of RekeyTo, CloseRemainderTo, AssetCloseTo'} width={body} />
        <Fact label="inner txns" value={String(facts.innerTransactions)} width={body} />
        {onComplete ? <Fact label="oncomplete" value={onComplete} width={body} /> : null}
        <Rule width={body} />
        <text
          fg={COLORS.faint}
          content={preview.map((line) => shorten(line, body)).join('\n')}
        />
        {tail ? <FooterNote text={tail} width={body} /> : null}
      </box>
    </Frame>
  )
}

/** The call surface: entrypoint names from the program, signatures when a spec is known. */
export function ApplicationMethodsCard({
  model,
  width,
}: {
  model: ApplicationMethodsViewModel | undefined
  width: number
}) {
  if (!model) return <Unavailable title="METHODS" width={width} />
  const body = innerWidth(width)
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
  const arc4 = model.methods.length > 0
  const specKnown = rows.some((row) => row.signature)
  const nameWidth = Math.min(18, Math.max(6, ...rows.map((row) => row.name.length))) + 2
  return (
    <Frame width={width}>
      <Header
        kicker="METHODS"
        chip={`${rows.length} · ${arc4 ? 'ARC-4' : 'string-routed'}`}
        pill={model.network.toUpperCase()}
        tone="idle"
      />
      <box marginTop={1} flexDirection="column">
        {rows.length === 0 ? (
          <text fg={COLORS.faint} content="no entrypoints — bare calls only" />
        ) : (
          rows.map((row) => (
            <box key={row.name} flexDirection="column">
              <box flexDirection="row" height={1}>
                <text fg={COLORS.text} content={shorten(row.name, nameWidth - 1).padEnd(nameWidth)} />
                {row.signature ? (
                  <text fg={COLORS.muted} content={shorten(row.signature, Math.max(8, body - nameWidth - 12))} />
                ) : null}
                {row.readonly ? <text fg={COLORS.faint} content="  read-only" /> : null}
              </box>
              {row.description ? (
                <text fg={COLORS.faint} content={`${' '.repeat(nameWidth)}${shorten(row.description, body - nameWidth)}`} />
              ) : null}
            </box>
          ))
        )}
        {rows.length > 0 && !specKnown ? (
          <FooterNote
            text="no spec · put the app's ARC-56 in the working directory to see arguments"
            width={body}
          />
        ) : null}
      </box>
    </Frame>
  )
}

/** The agent's write-up, rendered markdown. The AGENT pill says whose words these are. */
export function ApplicationExplanationCard({
  model,
  width,
}: {
  model: ApplicationExplanationViewModel | undefined
  width: number
}) {
  if (!model) return <Unavailable title="EXPLANATION" width={width} />
  return (
    <Frame width={width} accent={COLORS.brass}>
      <Header kicker="EXPLANATION" chip={`app ${model.applicationId}`} pill="AGENT" tone="warn" />
      <box marginTop={1} flexDirection="column">
        <markdown content={model.markdown} syntaxStyle={markdownStyle()} />
      </box>
    </Frame>
  )
}

export function ApplicationListCard({
  applications,
  nextToken,
  width,
  onOpen,
}: {
  applications: ReadonlyArray<{
    applicationId: number | string
    creator?: string
    globalStateCount?: number
  }>
  nextToken?: string
  width: number
  onOpen?: (applicationId: number) => void
}) {
  const body = innerWidth(width)
  const rows = applications.slice(0, 10)
  return (
    <Frame width={width}>
      <Header kicker="APPLICATIONS" pill={String(applications.length)} tone="idle" />
      <box flexDirection="column">
        {rows.map((application, index) => (
          <box key={String(application.applicationId)} flexDirection="column" marginTop={1}>
            <box flexDirection="row" justifyContent="space-between" height={1}>
              <Fact
                label="id"
                value={String(application.applicationId)}
                copy={String(application.applicationId)}
                width={body - 12}
              />
              {onOpen ? (
                <Button label="open ▸" onPress={() => onOpen(Number(application.applicationId))} />
              ) : null}
            </box>
            {application.creator ? (
              <Fact
                label="creator"
                value={application.creator}
                copy={application.creator}
                width={body}
              />
            ) : null}
            <Fact
              label="keys"
              value={`${application.globalStateCount ?? 0} key${(application.globalStateCount ?? 0) === 1 ? '' : 's'}`}
              width={body}
            />
            {index < rows.length - 1 ? <Rule width={body} /> : null}
          </box>
        ))}
        {pageNotes(applications.length, rows.length, nextToken).map((note) => (
          <FooterNote key={note} text={note} width={body} />
        ))}
      </box>
    </Frame>
  )
}

export function ApplicationStateCard({
  applicationId,
  scope,
  address,
  optedIn,
  entries,
  width,
}: {
  applicationId: number | string
  scope: 'global' | 'local'
  address?: string
  optedIn?: boolean
  entries: ReadonlyArray<{ key: string; value: string; type?: string }>
  width: number
}) {
  const body = innerWidth(width)
  return (
    <Frame width={width}>
      <Header kicker="APP STATE" pill={scope.toUpperCase()} tone="idle" />
      <Fact
        label="app"
        value={String(applicationId)}
        copy={String(applicationId)}
        width={body}
      />
      {address ? (
        <Fact label="address" value={address} copy={address} width={body} />
      ) : null}
      {optedIn === undefined ? null : (
        <Fact label="opted" value={optedIn ? 'yes' : 'no'} width={body} />
      )}
      <box marginTop={1} flexDirection="column">
        <Fact
          label="keys"
          value={`${entries.length} key${entries.length === 1 ? '' : 's'}`}
          width={body}
        />
        {entries.slice(0, 6).map((entry) => (
          <Fact
            key={entry.key}
            label={shorten(entry.key, 9)}
            value={entry.type ? `${entry.type} · ${entry.value}` : entry.value}
            width={body}
          />
        ))}
        {entries.length > 6 ? (
          <FooterNote text={`${entries.length - 6} more keys`} width={body} />
        ) : null}
      </box>
    </Frame>
  )
}

export function ApplicationLocalsCard({
  address,
  apps,
  nextToken,
  width,
}: {
  address?: string
  apps: ReadonlyArray<{
    applicationId: number | string
    entries: ReadonlyArray<{ key: string; value: string; type?: string }>
  }>
  nextToken?: string
  width: number
}) {
  const body = innerWidth(width)
  const shown = apps.slice(0, 6)
  return (
    <Frame width={width}>
      <Header kicker="APP LOCALS" pill={String(apps.length)} tone="idle" />
      {address ? (
        <Fact label="address" value={address} copy={address} width={body} />
      ) : null}
      <box marginTop={1} flexDirection="column">
        {shown.map((app) => (
          <box key={String(app.applicationId)} flexDirection="column" marginTop={1}>
            <Fact
              label="app"
              value={String(app.applicationId)}
              copy={String(app.applicationId)}
              width={body}
            />
            <Fact
              label="keys"
              value={`${app.entries.length} key${app.entries.length === 1 ? '' : 's'}`}
              width={body}
            />
            {app.entries.slice(0, 6).map((entry) => (
              <Fact
                key={entry.key}
                label={shorten(entry.key, 9)}
                value={entry.type ? `${entry.type} · ${entry.value}` : entry.value}
                width={body}
              />
            ))}
            {app.entries.length > 6 ? (
              <FooterNote text={`${app.entries.length - 6} more keys`} width={body} />
            ) : null}
          </box>
        ))}
        {apps.length > 6 ? <FooterNote text={`${apps.length - 6} more apps`} width={body} /> : null}
        {nextToken ? <FooterNote text="more pages available" width={body} /> : null}
      </box>
    </Frame>
  )
}

export function ApplicationLogsCard({
  applicationId,
  logData,
  nextToken,
  width,
}: {
  applicationId: number | string
  logData: ReadonlyArray<{ txid: string; logs: string[] }>
  nextToken?: string
  width: number
}) {
  const body = innerWidth(width)
  const rows = logData.slice(0, 10)
  return (
    <Frame width={width}>
      <Header kicker="APP LOGS" pill={String(applicationId)} tone="idle" />
      <box flexDirection="column">
        {rows.map((row, index) => (
          <box key={row.txid} flexDirection="column" marginTop={1}>
            <Fact label="id" value={row.txid} copy={row.txid} width={body} />
            <Fact
              label="logs"
              value={`${row.logs.length} log${row.logs.length === 1 ? '' : 's'}`}
              width={body}
            />
            {row.logs.slice(0, 3).map((line, logIndex) => (
              <Fact key={`${row.txid}-${logIndex}`} label="log" value={line} width={body} />
            ))}
            {row.logs.length > 3 ? (
              <FooterNote text={`${row.logs.length - 3} more logs`} width={body} />
            ) : null}
            {index < rows.length - 1 ? <Rule width={body} /> : null}
          </box>
        ))}
        {pageNotes(logData.length, rows.length, nextToken).map((note) => (
          <FooterNote key={note} text={note} width={body} />
        ))}
      </box>
    </Frame>
  )
}

export function ApplicationBoxCard({
  applicationId,
  boxName,
  exists,
  value,
  size,
  width,
}: {
  applicationId: number | string
  boxName: string
  exists: boolean
  value?: string
  size?: number
  width: number
}) {
  const body = innerWidth(width)
  return (
    <Frame width={width} accent={exists ? COLORS.border : COLORS.muted}>
      <Header kicker="APP BOX" pill={exists ? 'EXISTS' : 'MISSING'} tone={exists ? 'ok' : 'idle'} />
      <box marginTop={1} flexDirection="column">
        <Fact
          label="app"
          value={String(applicationId)}
          copy={String(applicationId)}
          width={body}
        />
        <Fact label="name" value={boxName} width={body} />
        {exists && size !== undefined ? (
          <Fact label="size" value={`${size} bytes`} width={body} />
        ) : null}
        {exists ? <Fact label="value" value={value ?? ''} width={body} /> : null}
        {exists ? null : (
          <text fg={COLORS.muted} marginTop={1} content="box does not exist" />
        )}
      </box>
    </Frame>
  )
}

export function ApplicationBoxesCard({
  applicationId,
  boxes,
  truncated,
  width,
}: {
  applicationId: number | string
  boxes: ReadonlyArray<{ name: string; nameBase64: string }>
  truncated?: boolean
  width: number
}) {
  const body = innerWidth(width)
  const rows = boxes.slice(0, 12)
  return (
    <Frame width={width}>
      <Header kicker="APP BOXES" pill={String(boxes.length)} tone="idle" />
      <Hero value={`#${applicationId}`} copy={String(applicationId)} />
      <box marginTop={1} flexDirection="column">
        <Rule width={body} />
        {boxes.length === 0 ? (
          <text fg={COLORS.muted} content="no boxes" />
        ) : (
          rows.map((box, index) => (
            <Fact key={box.nameBase64} label={`box ${index + 1}`} value={box.name} copy={box.nameBase64} width={body} />
          ))
        )}
        {boxes.length > rows.length ? (
          <FooterNote text={`${boxes.length - rows.length} more`} width={body} />
        ) : null}
        {truncated ? <FooterNote text="more boxes beyond this page" width={body} /> : null}
      </box>
    </Frame>
  )
}
