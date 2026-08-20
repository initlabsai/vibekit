import { z } from 'zod'

import {
  focusTargetSchema,
  viewSpecSchema,
  workspaceCommandSchema,
  type ViewSpec,
  type WorkspaceCommand,
} from './protocol.js'
import { resultReferenceSchema, sameResultReference, type ResultReference } from './results.js'
import { EXPERIENCE_PROTOCOL_VERSION, experienceProtocolVersionSchema } from './version.js'

/** One tab-backed artifact in the client-owned Explorer workspace. */
export const workspaceArtifactSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    view: viewSpecSchema,
    pinned: z.boolean(),
    resultReferences: z.array(resultReferenceSchema),
  })
  .strict()

/** One tab-backed artifact in the client-owned Explorer workspace. */
export type WorkspaceArtifact = z.infer<typeof workspaceArtifactSchema>

/** The complete shared workspace state owned by one client process or browser tab. */
export const workspaceStateSchema = z
  .object({
    protocolVersion: experienceProtocolVersionSchema,
    tabs: z.array(z.string().min(1)),
    artifacts: z.record(z.string(), workspaceArtifactSchema),
    activeArtifactId: z.string().min(1).nullable(),
    focus: focusTargetSchema,
  })
  .strict()
  .superRefine((state, context) => {
    const seenTabs = new Set<string>()
    for (const artifactId of state.tabs) {
      if (seenTabs.has(artifactId)) {
        context.addIssue({
          code: 'custom',
          path: ['tabs'],
          message: `Duplicate tab: ${artifactId}`,
        })
      }
      seenTabs.add(artifactId)
      if (!state.artifacts[artifactId]) {
        context.addIssue({
          code: 'custom',
          path: ['tabs'],
          message: `Tab has no artifact: ${artifactId}`,
        })
      }
    }
    for (const [key, artifact] of Object.entries(state.artifacts)) {
      if (key !== artifact.id) {
        context.addIssue({
          code: 'custom',
          path: ['artifacts', key, 'id'],
          message: `Artifact key ${key} does not match id ${artifact.id}`,
        })
      }
      if (!seenTabs.has(key)) {
        context.addIssue({
          code: 'custom',
          path: ['artifacts', key],
          message: `Artifact has no tab: ${key}`,
        })
      }
      if (
        artifact.resultReferences.length !== 1 ||
        !sameResultReference(artifact.resultReferences[0]!, artifact.view.source)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['artifacts', key, 'resultReferences'],
          message: `Artifact result references do not match its trusted view: ${key}`,
        })
      }
    }
    if (state.activeArtifactId !== null && !seenTabs.has(state.activeArtifactId)) {
      context.addIssue({
        code: 'custom',
        path: ['activeArtifactId'],
        message: `Active artifact has no tab: ${state.activeArtifactId}`,
      })
    }
    if (
      state.focus.area === 'workspace' &&
      state.focus.artifactId !== undefined &&
      !seenTabs.has(state.focus.artifactId)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['focus', 'artifactId'],
        message: `Focused artifact has no tab: ${state.focus.artifactId}`,
      })
    }
  })

/** The complete shared workspace state owned by one client process or browser tab. */
export type WorkspaceState = z.infer<typeof workspaceStateSchema>

function resultReferencesFor(view: ViewSpec): ResultReference[] {
  return [view.source]
}

function artifactFrom(
  id: string,
  title: string,
  view: ViewSpec,
  pinned: boolean,
): WorkspaceArtifact {
  return {
    id,
    title,
    view,
    pinned,
    resultReferences: resultReferencesFor(view),
  }
}

/** Creates a fresh empty workspace with composer focus and no ambient current state. */
export function createInitialWorkspaceState(): WorkspaceState {
  return {
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    tabs: [],
    artifacts: {},
    activeArtifactId: null,
    focus: { area: 'composer' },
  }
}

/** Applies one validated semantic command without mutating the prior workspace value. */
export function workspaceReducer(
  state: WorkspaceState,
  rawCommand: WorkspaceCommand,
): WorkspaceState {
  const command = workspaceCommandSchema.parse(rawCommand)

  switch (command.command) {
    case 'open': {
      const current = state.artifacts[command.artifactId]
      const artifact = artifactFrom(
        command.artifactId,
        command.title,
        command.view,
        current?.pinned ?? false,
      )
      return {
        ...state,
        tabs: current ? state.tabs : [...state.tabs, command.artifactId],
        artifacts: { ...state.artifacts, [command.artifactId]: artifact },
        activeArtifactId: command.activate ? command.artifactId : state.activeArtifactId,
      }
    }
    case 'replace': {
      const current = state.artifacts[command.artifactId]
      if (!current) return state
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          [command.artifactId]: artifactFrom(
            current.id,
            command.title ?? current.title,
            command.view,
            current.pinned,
          ),
        },
      }
    }
    case 'patch': {
      const current = state.artifacts[command.artifactId]
      if (!current) return state
      const view = command.patch.source
        ? { ...current.view, source: command.patch.source }
        : current.view
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          [command.artifactId]: artifactFrom(
            current.id,
            command.patch.title ?? current.title,
            view,
            current.pinned,
          ),
        },
      }
    }
    case 'focus': {
      if (
        command.target.area === 'workspace' &&
        command.target.artifactId !== undefined &&
        !state.artifacts[command.target.artifactId]
      ) {
        return state
      }
      return { ...state, focus: command.target }
    }
    case 'pin': {
      const current = state.artifacts[command.artifactId]
      if (!current || current.pinned === command.pinned) return state
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          [command.artifactId]: { ...current, pinned: command.pinned },
        },
      }
    }
  }
}

/** Returns the active artifact, if the workspace currently has one. */
export function selectActiveArtifact(state: WorkspaceState): WorkspaceArtifact | undefined {
  return state.activeArtifactId === null ? undefined : state.artifacts[state.activeArtifactId]
}
