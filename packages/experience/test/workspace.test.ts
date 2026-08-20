import { describe, expect, test } from 'bun:test'

import {
  EXPERIENCE_PROTOCOL_VERSION,
  FIXTURE_ARTIFACT_ID,
  FIXTURE_RESULT_ID,
  FIXTURE_TOOL_CALL_ID,
  createInitialWorkspaceState,
  createTransactionFixtureOpenCommand,
  selectActiveArtifact,
  workspaceCommandSchema,
  workspaceReducer,
  workspaceStateSchema,
} from '../src/index.js'

describe('pure workspace reducer', () => {
  test('opens an active tab and owns its authoritative result references', () => {
    const initial = createInitialWorkspaceState()
    const next = workspaceReducer(initial, createTransactionFixtureOpenCommand())

    expect(initial).toEqual({
      protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
      tabs: [],
      artifacts: {},
      activeArtifactId: null,
      focus: { area: 'composer' },
    })
    expect(next.tabs).toEqual([FIXTURE_ARTIFACT_ID])
    expect(next.activeArtifactId).toBe(FIXTURE_ARTIFACT_ID)
    expect(selectActiveArtifact(next)?.resultReferences).toEqual([
      { source: 'result', id: FIXTURE_RESULT_ID },
    ])
    expect(workspaceStateSchema.safeParse(next).success).toBeTrue()
  })

  test('replaces, patches, focuses, and pins without mutating earlier states', () => {
    const opened = workspaceReducer(
      createInitialWorkspaceState(),
      createTransactionFixtureOpenCommand(),
    )
    const replacement = workspaceCommandSchema.parse({
      protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
      type: 'workspace.command',
      command: 'replace',
      artifactId: FIXTURE_ARTIFACT_ID,
      title: 'Tool-call result',
      view: {
        ...selectActiveArtifact(opened)!.view,
        source: { source: 'tool-call', id: FIXTURE_TOOL_CALL_ID },
      },
    })
    const replaced = workspaceReducer(opened, replacement)
    const patched = workspaceReducer(
      replaced,
      workspaceCommandSchema.parse({
        protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
        type: 'workspace.command',
        command: 'patch',
        artifactId: FIXTURE_ARTIFACT_ID,
        patch: {
          title: 'Sender value',
          source: { source: 'result', id: FIXTURE_RESULT_ID, path: ['sender'] },
        },
      }),
    )
    const focused = workspaceReducer(
      patched,
      workspaceCommandSchema.parse({
        protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
        type: 'workspace.command',
        command: 'focus',
        target: { area: 'workspace', artifactId: FIXTURE_ARTIFACT_ID },
      }),
    )
    const pinned = workspaceReducer(
      focused,
      workspaceCommandSchema.parse({
        protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
        type: 'workspace.command',
        command: 'pin',
        artifactId: FIXTURE_ARTIFACT_ID,
        pinned: true,
      }),
    )

    expect(selectActiveArtifact(opened)?.title).toBe('Transaction detail')
    expect(selectActiveArtifact(replaced)?.resultReferences).toEqual([
      { source: 'tool-call', id: FIXTURE_TOOL_CALL_ID },
    ])
    expect(selectActiveArtifact(patched)).toMatchObject({
      title: 'Sender value',
      resultReferences: [{ source: 'result', id: FIXTURE_RESULT_ID, path: ['sender'] }],
    })
    expect(focused.focus).toEqual({
      area: 'workspace',
      artifactId: FIXTURE_ARTIFACT_ID,
    })
    expect(selectActiveArtifact(pinned)?.pinned).toBeTrue()
    expect(selectActiveArtifact(focused)?.pinned).toBeFalse()
    expect(workspaceStateSchema.safeParse(pinned).success).toBeTrue()
  })

  test('ignores commands targeting artifacts the client does not own', () => {
    const initial = createInitialWorkspaceState()
    const command = workspaceCommandSchema.parse({
      protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
      type: 'workspace.command',
      command: 'pin',
      artifactId: 'missing-artifact',
      pinned: true,
    })
    expect(workspaceReducer(initial, command)).toBe(initial)
  })

  test('rejects persisted state whose result references drift from its trusted view', () => {
    const opened = workspaceReducer(
      createInitialWorkspaceState(),
      createTransactionFixtureOpenCommand(),
    )
    const artifact = selectActiveArtifact(opened)!
    const drifted = {
      ...opened,
      artifacts: {
        ...opened.artifacts,
        [artifact.id]: {
          ...artifact,
          resultReferences: [{ source: 'result', id: 'copied-or-stale-reference' }],
        },
      },
    }

    expect(workspaceStateSchema.safeParse(drifted).success).toBeFalse()
  })
})
