/**
 * In-TUI setup: a generic select list, the first-run BYOM model wizard, and
 * the keystore account picker — all Ink components, so the whole explore
 * experience is one renderer (mixing clack prompts with Ink breaks stdin).
 */

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'

import type { ProviderConfig } from '@initlabs/vibekit-agent'
import { theme } from './theme.js'

// --- Select list ---

export interface SelectItem<T> {
  label: string
  hint?: string
  value: T
}

export function SelectList<T>(props: {
  message: string
  items: Array<SelectItem<T>>
  onSelect: (value: T) => void
}): React.JSX.Element {
  const [index, setIndex] = useState(0)

  useInput((input, key) => {
    if (key.upArrow || input === 'k') setIndex((i) => (i - 1 + props.items.length) % props.items.length)
    if (key.downArrow || input === 'j') setIndex((i) => (i + 1) % props.items.length)
    if (key.return) props.onSelect(props.items[index]!.value)
  })

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>{props.message}</Text>
      {props.items.map((item, i) => (
        <Text key={item.label} color={i === index ? theme.accent : undefined}>
          {i === index ? '● ' : '○ '}
          {item.label}
          {item.hint && <Text color={theme.subtle}> — {item.hint}</Text>}
        </Text>
      ))}
      <Text color={theme.subtle}>↑/↓ choose · enter confirms</Text>
    </Box>
  )
}

// --- Text question ---

function Question(props: {
  message: string
  placeholder?: string
  initial?: string
  onSubmit: (value: string) => void
}): React.JSX.Element {
  const [value, setValue] = useState(props.initial ?? '')
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>{props.message}</Text>
      <Box>
        <Text color={theme.accent}>❯ </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={(v) => props.onSubmit(v.trim())}
          placeholder={props.placeholder}
        />
      </Box>
    </Box>
  )
}

// --- Model wizard ---

const MODEL_PLACEHOLDERS: Record<ProviderConfig['provider'], string> = {
  anthropic: 'claude-sonnet-5',
  openai: 'gpt-5',
  ollama: 'qwen3:8b',
  'openai-compatible': 'model id',
}

type WizardStep = 'provider' | 'model' | 'baseUrl' | 'apiKey'

export function ModelWizard(props: {
  configPath: string
  onDone: (config: ProviderConfig) => void
}): React.JSX.Element {
  const [step, setStep] = useState<WizardStep>('provider')
  const [draft, setDraft] = useState<Partial<ProviderConfig>>({})

  const finish = (config: ProviderConfig) => props.onDone(config)

  if (step === 'provider') {
    return (
      <Box flexDirection="column">
        <Text color={theme.muted}>
          No model configured yet <Text color={theme.subtle}>({props.configPath})</Text>
        </Text>
        <SelectList<ProviderConfig['provider']>
          message="Which model provider?"
          items={[
            { value: 'anthropic', label: 'Anthropic', hint: 'API key (or ANTHROPIC_API_KEY)' },
            { value: 'openai', label: 'OpenAI', hint: 'API key (or OPENAI_API_KEY)' },
            { value: 'ollama', label: 'Ollama', hint: 'local models, no key needed' },
            { value: 'openai-compatible', label: 'OpenAI-compatible', hint: 'custom baseUrl' },
          ]}
          onSelect={(provider) => {
            setDraft({ provider })
            setStep('model')
          }}
        />
      </Box>
    )
  }

  const provider = draft.provider!

  if (step === 'model') {
    return (
      <Question
        message="Model id:"
        placeholder={MODEL_PLACEHOLDERS[provider]}
        onSubmit={(value) => {
          const model = value === '' ? MODEL_PLACEHOLDERS[provider] : value
          setDraft((d) => ({ ...d, model }))
          if (provider === 'ollama' || provider === 'openai-compatible') setStep('baseUrl')
          else setStep('apiKey')
        }}
      />
    )
  }

  if (step === 'baseUrl') {
    const fallback = provider === 'ollama' ? 'http://localhost:11434/v1' : ''
    return (
      <Question
        message="Base URL:"
        placeholder={fallback || 'https://…/v1'}
        initial={fallback}
        onSubmit={(value) => {
          const next = { ...draft, ...(value ? { baseUrl: value } : {}) }
          setDraft(next)
          if (provider === 'ollama') {
            finish(next as ProviderConfig)
          } else {
            setStep('apiKey')
          }
        }}
      />
    )
  }

  return (
    <Question
      message="API key (empty = use the environment variable):"
      onSubmit={(value) => {
        finish({ ...draft, ...(value ? { apiKey: value } : {}) } as ProviderConfig)
      }}
    />
  )
}

// --- Account picker ---

export function AccountPicker(props: {
  addresses: string[]
  onPick: (address: string | null) => void
}): React.JSX.Element {
  return (
    <SelectList<string | null>
      message="Keystore daemon detected — sign with an account?"
      items={[
        ...props.addresses.map((address) => ({
          value: address as string | null,
          label: `${address.slice(0, 12)}…${address.slice(-6)}`,
        })),
        { value: null, label: 'No — read-only session' },
      ]}
      onSelect={props.onPick}
    />
  )
}
