import { base64ToBytes } from '@initlabs/vibekit-core'
import type { ApplicationDetailViewModel } from '@initlabs/vibekit-experience'

import { COLORS, shorten } from '../theme.js'
import {
  Fact,
  FooterNote,
  Frame,
  Header,
  Hero,
  innerWidth,
  Rule,
  Unavailable,
} from '../ui.js'
import { pageNotes } from './shared.js'

export function ApplicationCard({
  model,
  width,
}: {
  model: ApplicationDetailViewModel | undefined
  width: number
}) {
  if (!model) return <Unavailable title="APPLICATION" width={width} />
  const body = innerWidth(width)
  const global = model.globalStateSchema
  const local = model.localStateSchema
  return (
    <Frame width={width}>
      <Header kicker="APPLICATION" pill={model.network.toUpperCase()} tone="idle" />
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

/** base64 bytes as printable text when they are, else the base64 itself. */
function bytesDisplay(base64: string): string {
  try {
    const text = new TextDecoder().decode(base64ToBytes(base64))
    return /^[^\p{C}]+$/u.test(text) ? text : base64
  } catch {
    return base64
  }
}

export function ApplicationListCard({
  applications,
  nextToken,
  width,
}: {
  applications: ReadonlyArray<{
    applicationId: number | string
    creator?: string
    globalStateCount?: number
  }>
  nextToken?: string
  width: number
}) {
  const body = innerWidth(width)
  const rows = applications.slice(0, 10)
  return (
    <Frame width={width}>
      <Header kicker="APPLICATIONS" pill={String(applications.length)} tone="idle" />
      <box flexDirection="column">
        {rows.map((application, index) => (
          <box key={String(application.applicationId)} flexDirection="column" marginTop={1}>
            <Fact
              label="id"
              value={String(application.applicationId)}
              copy={String(application.applicationId)}
              width={body}
            />
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
