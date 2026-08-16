/**
 * Minimal markdown → Ink nodes. Handles what models actually emit in chat:
 * headers, bullet/numbered lists, fenced code, inline bold/italic/code/links.
 * Anything else passes through as plain text.
 */

import React, { Fragment } from 'react'
import { Text } from 'ink'

import { theme } from './theme.js'

/** Inline spans: `code`, **bold**, *italic*, [text](url). */
export function inline(text: string, keyPrefix = ''): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let match: RegExpExecArray | null
  let i = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(<Fragment key={`${keyPrefix}t${i++}`}>{text.slice(last, match.index)}</Fragment>)
    }
    const token = match[0]
    if (token.startsWith('`')) {
      nodes.push(
        <Text key={`${keyPrefix}c${i++}`} color={theme.accent}>
          {token.slice(1, -1)}
        </Text>,
      )
    } else if (token.startsWith('**')) {
      nodes.push(
        <Text key={`${keyPrefix}b${i++}`} bold>
          {token.slice(2, -2)}
        </Text>,
      )
    } else if (token.startsWith('*')) {
      nodes.push(
        <Text key={`${keyPrefix}i${i++}`} italic>
          {token.slice(1, -1)}
        </Text>,
      )
    } else {
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(token)!
      nodes.push(
        <Fragment key={`${keyPrefix}l${i++}`}>
          <Text color={theme.accent}>{link[1]}</Text>
          <Text color={theme.subtle}> ({link[2]})</Text>
        </Fragment>,
      )
    }
    last = match.index + token.length
  }
  if (last < text.length) {
    nodes.push(<Fragment key={`${keyPrefix}t${i++}`}>{text.slice(last)}</Fragment>)
  }
  return nodes
}

export function Markdown({ children }: { children: string }): React.JSX.Element {
  const lines = children.split('\n')
  const blocks: React.ReactNode[] = []
  let inFence = false

  lines.forEach((line, index) => {
    const key = `md${index}`

    if (line.trimStart().startsWith('```')) {
      inFence = !inFence
      return // drop the fence markers themselves
    }
    if (inFence) {
      blocks.push(
        <Text key={key} color={theme.accentDark}>
          {'  ' + line}
        </Text>,
      )
      return
    }

    const header = /^(#{1,4})\s+(.*)$/.exec(line)
    if (header) {
      blocks.push(
        <Text key={key} bold color={theme.accent}>
          {header[2]}
        </Text>,
      )
      return
    }

    const bullet = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line)
    if (bullet) {
      const marker = /^\d+\.$/.test(bullet[2]!) ? bullet[2]! : '•'
      blocks.push(
        <Text key={key}>
          {bullet[1]}
          <Text color={theme.accent}>{marker} </Text>
          {inline(bullet[3]!, key)}
        </Text>,
      )
      return
    }

    blocks.push(<Text key={key}>{line === '' ? ' ' : inline(line, key)}</Text>)
  })

  return <>{blocks}</>
}
