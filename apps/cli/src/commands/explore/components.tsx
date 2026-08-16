/**
 * Explore's component library: header, chat items, result cards, approval
 * card. Result cards are the primary answer surface — rendered from tool
 * output data + display hints, never from model prose.
 */

import React, { useEffect, useState } from 'react'
import { Box, Text, useInput } from 'ink'

import type { DisplayHint } from '@initlabs/vibekit-core'
import { inline, Markdown } from './markdown.js'
import { kvEntries, renderJson, tableModel, tableRows } from './render.js'
import { theme } from './theme.js'

// --- Chat model ---

export type ChatItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'notice'; text: string }
  | { kind: 'error'; text: string }
  | ToolItem

export interface ToolItem {
  kind: 'tool'
  id: string
  name: string
  input: unknown
  status: 'running' | 'done' | 'error'
  output?: unknown
  display?: DisplayHint
}

// --- Header ---

export function Header(props: {
  model: string
  networks: string[]
  defaultNetwork: string
  signingAddress?: string
}): React.JSX.Element {
  const signing = props.signingAddress
    ? `signing as ${props.signingAddress.slice(0, 8)}…${props.signingAddress.slice(-4)}`
    : 'read-only'
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text>
        <Text bold color={theme.accent}>
          ✦ vibekit
        </Text>
        <Text bold> explore</Text>
        <Text color={theme.subtle}> — ask about the Algorand network in plain English</Text>
      </Text>
      <Text color={theme.muted}>
        {props.model} · {props.networks.join(', ')} (default {props.defaultNetwork}) · {signing}
      </Text>
      <Text color={theme.subtle}>/new resets · /exit quits</Text>
    </Box>
  )
}

// --- Result cards ---

function TableView({ rows }: { rows: Array<Record<string, unknown>> }): React.JSX.Element {
  if (rows.length === 0) return <Text color={theme.subtle}>(no rows)</Text>
  const model = tableModel(rows)
  return (
    <Box flexDirection="column">
      <Text bold color={theme.accent}>
        {model.columns.map((column, i) => column.padEnd(model.widths[i]!)).join('  ').trimEnd()}
      </Text>
      <Text color={theme.border}>{model.widths.map((w) => '─'.repeat(w)).join('──')}</Text>
      {model.rows.map((row, index) => (
        <Text key={index}>
          {row.map((text, i) => text.padEnd(model.widths[i]!)).join('  ').trimEnd()}
        </Text>
      ))}
      {model.more > 0 && <Text color={theme.subtle}>… {model.more} more rows</Text>}
    </Box>
  )
}

function KeyValueView({ data }: { data: Record<string, unknown> }): React.JSX.Element {
  const entries = kvEntries(data)
  if (entries.length === 0) return <Text color={theme.subtle}>(empty)</Text>
  const width = Math.min(Math.max(...entries.map(([key]) => key.length)), 32)
  return (
    <Box flexDirection="column">
      {entries.map(([key, text]) => (
        <Text key={key}>
          <Text color={theme.muted}>{key.padEnd(width)}</Text>  {text}
        </Text>
      ))}
    </Box>
  )
}

export function ResultBody({ output, display }: { output: unknown; display?: DisplayHint }): React.JSX.Element {
  if (display === 'table') {
    const rows = tableRows(output)
    if (rows) return <TableView rows={rows} />
  }
  if (
    (display === 'account' || display === 'asset' || display === 'txn') &&
    typeof output === 'object' &&
    output !== null &&
    !Array.isArray(output)
  ) {
    return <KeyValueView data={output as Record<string, unknown>} />
  }
  if (display === 'markdown' && typeof output === 'string') {
    return <Markdown>{output}</Markdown>
  }
  return <Text>{renderJson(output)}</Text>
}

function compactArgs(input: unknown): string {
  const json = JSON.stringify(input) ?? ''
  return json.length > 80 ? json.slice(0, 79) + '…' : json
}

export function ToolView({ item }: { item: ToolItem }): React.JSX.Element {
  const error =
    item.status === 'error'
      ? ((item.output as { error?: { code?: string; message?: string } })?.error ?? {})
      : undefined
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={theme.muted}>
        <Text color={item.status === 'error' ? theme.error : theme.accentDark}>⚙ </Text>
        {item.name}
        <Text color={theme.subtle}>({compactArgs(item.input)})</Text>
        {item.status === 'running' && <Text color={theme.subtle}> …</Text>}
      </Text>
      {item.status === 'error' && (
        <Text color={theme.error}>
          {'  '}✗ {error?.code ?? 'ERROR'}: {error?.message ?? 'tool failed'}
        </Text>
      )}
      {item.status === 'done' && (
        <Box
          borderStyle="round"
          borderColor={theme.border}
          paddingX={1}
          marginLeft={2}
          alignSelf="flex-start"
        >
          <ResultBody output={item.output} display={item.display} />
        </Box>
      )}
    </Box>
  )
}

// --- Chat items ---

export function ChatItemView({ item }: { item: ChatItem }): React.JSX.Element {
  switch (item.kind) {
    case 'user':
      return (
        <Box marginTop={1}>
          <Text>
            <Text bold color={theme.accent}>
              ❯{' '}
            </Text>
            {item.text}
          </Text>
        </Box>
      )
    case 'assistant':
      return (
        <Box flexDirection="column" marginTop={1}>
          <Markdown>{item.text}</Markdown>
        </Box>
      )
    case 'notice':
      return (
        <Box marginTop={1}>
          <Text color={theme.subtle}>{item.text}</Text>
        </Box>
      )
    case 'error':
      return (
        <Box marginTop={1}>
          <Text color={theme.error}>{item.text}</Text>
        </Box>
      )
    case 'tool':
      return <ToolView item={item} />
  }
}

// --- Streaming affordances ---

const SPIN_FRAMES = ['◐', '◓', '◑', '◒']

export function Spinner({ label }: { label: string }): React.JSX.Element {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setFrame((f) => (f + 1) % SPIN_FRAMES.length), 120)
    return () => clearInterval(timer)
  }, [])
  return (
    <Text color={theme.subtle}>
      {SPIN_FRAMES[frame]} {label}
    </Text>
  )
}

// --- Approval card ---

export interface PendingApproval {
  toolName: string
  input: unknown
  resolve: (approved: boolean) => void
}

export function ApprovalCard({ pending }: { pending: PendingApproval }): React.JSX.Element {
  useInput((input) => {
    if (input === 'y' || input === 'Y') pending.resolve(true)
    if (input === 'n' || input === 'N') pending.resolve(false)
  })

  const args =
    typeof pending.input === 'object' && pending.input !== null
      ? (pending.input as Record<string, unknown>)
      : { input: pending.input }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.warn}
      paddingX={1}
      marginTop={1}
      alignSelf="flex-start"
    >
      <Text bold color={theme.warn}>
        ⚠ Approval required: {inline('`' + pending.toolName + '`', 'ap')}
      </Text>
      <KeyValueView data={args} />
      <Text color={theme.muted}>
        Press <Text color={theme.accent}>y</Text> to sign & send · <Text color={theme.error}>n</Text> to deny
      </Text>
    </Box>
  )
}
