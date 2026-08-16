/**
 * The explore app: chat scrollback (<Static>), a live in-progress turn,
 * approval cards, and the composer. Consumes the orchestrator's AgentEvent
 * stream — all rendering derives from events + display hints.
 */

import React, { useReducer, useRef, useState } from 'react'
import { Box, Static, Text, useApp } from 'ink'
import TextInput from 'ink-text-input'

import type { AgentSession, ProviderConfig } from '@initlabs/vibekit-agent'
import { AccountPicker, ModelWizard } from './setup.js'
import {
  ApprovalCard,
  ChatItemView,
  Header,
  Spinner,
  type ChatItem,
  type PendingApproval,
  type ToolItem,
} from './components.js'
import { theme } from './theme.js'

export interface ApprovalBridge {
  request?: (call: { toolName: string; input: unknown }) => Promise<boolean>
}

/** Setup phases (model wizard, account picker), then the chat. All Ink. */
export interface ExploreRootProps {
  configPath: string
  initialModel?: ProviderConfig
  /** Keystore daemon address book; empty when the daemon is down. */
  addresses: string[]
  networks: string[]
  defaultNetwork: string
  saveModel: (config: ProviderConfig) => Promise<void>
  createSession: (model: ProviderConfig, signingAddress: string | null) => AgentSession
  approvalBridge: ApprovalBridge
}

export function ExploreRoot(props: ExploreRootProps): React.JSX.Element {
  const [model, setModel] = useState<ProviderConfig | undefined>(props.initialModel)
  const [picked, setPicked] = useState<string | null | undefined>(
    props.addresses.length === 0 ? null : undefined,
  )
  const session = useRef<AgentSession | null>(null)

  if (!model) {
    return (
      <ModelWizard
        configPath={props.configPath}
        onDone={(config) => {
          void props.saveModel(config)
          setModel(config)
        }}
      />
    )
  }

  if (picked === undefined) {
    return <AccountPicker addresses={props.addresses} onPick={setPicked} />
  }

  session.current ??= props.createSession(model, picked)

  return (
    <ExploreApp
      session={session.current}
      model={`${model.provider}/${model.model}`}
      networks={props.networks}
      defaultNetwork={props.defaultNetwork}
      signingAddress={picked ?? undefined}
      approvalBridge={props.approvalBridge}
    />
  )
}

export interface ExploreAppProps {
  session: AgentSession
  model: string
  networks: string[]
  defaultNetwork: string
  signingAddress?: string
  approvalBridge: ApprovalBridge
}

export function ExploreApp(props: ExploreAppProps): React.JSX.Element {
  const { exit } = useApp()
  const [items, setItems] = useState<ChatItem[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null)

  // The live turn mutates during streaming; a version counter drives re-render.
  const live = useRef<{ items: ChatItem[]; text: string }>({ items: [], text: '' })
  const [, bump] = useReducer((x: number) => x + 1, 0)

  props.approvalBridge.request = (call) =>
    new Promise<boolean>((resolve) => {
      setPendingApproval({
        ...call,
        resolve: (approved) => {
          setPendingApproval(null)
          resolve(approved)
        },
      })
    })

  const flushText = () => {
    if (live.current.text.trim() !== '') {
      live.current.items.push({ kind: 'assistant', text: live.current.text })
    }
    live.current.text = ''
  }

  async function runTurn(text: string): Promise<void> {
    live.current = { items: [{ kind: 'user', text }], text: '' }
    setBusy(true)
    bump()

    try {
      for await (const event of props.session.stream(text)) {
        switch (event.type) {
          case 'text-delta':
            live.current.text += event.text
            break
          case 'tool-call':
            flushText()
            live.current.items.push({
              kind: 'tool',
              id: event.id,
              name: event.toolName,
              input: event.input,
              status: 'running',
            })
            break
          case 'tool-result': {
            const tool = live.current.items.find(
              (item): item is ToolItem => item.kind === 'tool' && item.id === event.id,
            )
            if (tool) {
              tool.status = event.isError ? 'error' : 'done'
              tool.output = event.output
              tool.display = event.display
            }
            break
          }
          case 'error':
            flushText()
            live.current.items.push({ kind: 'error', text: `error: ${event.message}` })
            break
          default:
            break
        }
        bump()
      }
    } catch (error) {
      live.current.items.push({
        kind: 'error',
        text: error instanceof Error ? error.message : String(error),
      })
    }

    flushText()
    const finished = live.current.items
    live.current = { items: [], text: '' }
    setItems((previous) => [...previous, ...finished])
    setBusy(false)
  }

  const onSubmit = (raw: string) => {
    const text = raw.trim()
    setInput('')
    if (text === '' || busy) return

    if (text === '/exit' || text === '/quit') {
      exit()
      return
    }
    if (text === '/new') {
      props.session.reset()
      setItems((previous) => [...previous, { kind: 'notice', text: '── conversation reset ──' }])
      return
    }
    if (text === '/help') {
      setItems((previous) => [
        ...previous,
        { kind: 'notice', text: 'Ask anything about Algorand. /new resets, /exit quits.' },
      ])
      return
    }

    void runTurn(text)
  }

  const staticItems: Array<ChatItem | 'header'> = ['header', ...items]

  const showSpinner =
    busy &&
    !pendingApproval &&
    live.current.text === '' &&
    !live.current.items.some((item) => item.kind === 'tool' && item.status === 'running')

  return (
    <Box flexDirection="column">
      <Static items={staticItems}>
        {(item, index) =>
          item === 'header' ? (
            <Header
              key="header"
              model={props.model}
              networks={props.networks}
              defaultNetwork={props.defaultNetwork}
              signingAddress={props.signingAddress}
            />
          ) : (
            <ChatItemView key={index} item={item} />
          )
        }
      </Static>

      {live.current.items.map((item, index) => (
        <ChatItemView key={index} item={item} />
      ))}
      {live.current.text !== '' && (
        <ChatItemView item={{ kind: 'assistant', text: live.current.text }} />
      )}
      {showSpinner && (
        <Box marginTop={1}>
          <Spinner label="thinking…" />
        </Box>
      )}
      {pendingApproval && <ApprovalCard pending={pendingApproval} />}

      {!busy && !pendingApproval && (
        <Box marginTop={1}>
          <Text bold color={theme.accent}>
            ❯{' '}
          </Text>
          <TextInput value={input} onChange={setInput} onSubmit={onSubmit} />
        </Box>
      )}
    </Box>
  )
}
