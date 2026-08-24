/**
 * Application state read handlers.
 *
 * Domain logic for reading global state, local state, and box storage.
 */
import { base64ToBytes, bytesToBase64, ToolError, type ToolContext } from '@initlabs/vibekit-core'
import { ABIUintType, decodeAddress, encodeAddress } from 'algosdk'
import { isNotFound } from '../../shared/errors.js'

// ============================================================================
// Shared types and helpers
// ============================================================================

export interface StateValue {
  /** App-spec name when resolvable, else UTF-8 decode of the raw key. */
  key: string
  /** base64 of the exact key bytes. */
  keyBase64: string
  /**
   * Display value: uint64 state as bigint (jsonSafe emits number | decimal
   * string); bytes state decoded the way explorers do without a spec — a
   * 32-byte value as an Algorand address, printable bytes as text, else base64.
   */
  value: string | number | bigint
  /** base64 of the exact value bytes (bytes-typed state only). */
  valueBase64?: string
  type: 'uint' | 'bytes'
}

/** Raw bytes from a Uint8Array or a base64 string. */
function toBytes(bytes: Uint8Array | string): Uint8Array {
  return typeof bytes === 'string' ? base64ToBytes(bytes) : bytes
}

/**
 * A bytes state/box value for display, matching explorer convention with no
 * spec: exactly 32 bytes reads as an Algorand address, all-printable bytes as
 * text, anything else as base64. Raw base64 always stays in `valueBase64`.
 */
export function bytesToDisplay(bytes: Uint8Array | string): string {
  const arr = toBytes(bytes)
  if (arr.length === 32) return encodeAddress(arr)
  const text = new TextDecoder().decode(arr)
  return /^[^\p{C}]*$/u.test(text) ? text : bytesToBase64(arr)
}

/** Decode bytes to a UTF-8 string. If input is a string, treats it as base64. */
function bytesToString(bytes: Uint8Array | string): string {
  if (typeof bytes === 'string') {
    try {
      return atob(bytes)
    } catch {
      return bytes
    }
  }
  return new TextDecoder().decode(bytes)
}

/** Convert bytes to base64. If input is already a string, returns unchanged. */
function toBase64(bytes: Uint8Array | string): string {
  if (typeof bytes === 'string') {
    return bytes
  }
  return bytesToBase64(bytes)
}

/**
 * Parse an ARC-56/ARC-32 app spec to build a map from state key (base64/string) to human-readable name.
 */
function buildStateKeyMap(
  appSpecJson: string,
  scope: 'global' | 'local',
): Map<string, string> | undefined {
  const appSpec = JSON.parse(appSpecJson)
  const stateKeyMap = new Map<string, string>()

  if (appSpec.state?.keys?.[scope]) {
    for (const [name, info] of Object.entries(appSpec.state.keys[scope])) {
      const keyInfo = info as { key: string }
      stateKeyMap.set(keyInfo.key, name)
    }
  }

  return stateKeyMap.size > 0 ? stateKeyMap : undefined
}

/**
 * Decode a state key-value array into a readable format.
 */
function decodeStateItems(
  items: Array<{
    key: Uint8Array | string
    value: { type: number | bigint; bytes: Uint8Array | string; uint: number | bigint }
  }>,
  stateKeyMap?: Map<string, string>,
): StateValue[] {
  const state: StateValue[] = []
  for (const item of items) {
    const keyString = bytesToString(item.key)
    const keyBase64 = toBase64(item.key)
    const displayKey = stateKeyMap?.get(keyBase64) || stateKeyMap?.get(keyString) || keyString

    if (Number(item.value.type) === 1) {
      state.push({
        key: displayKey,
        keyBase64,
        value: bytesToDisplay(item.value.bytes),
        valueBase64: toBase64(item.value.bytes),
        type: 'bytes',
      })
    } else {
      state.push({
        key: displayKey,
        keyBase64,
        value: item.value.uint,
        type: 'uint',
      })
    }
  }
  return state
}

// ============================================================================
// Read Global State
// ============================================================================

export interface ReadGlobalStateArgs {
  appId: number
  appSpec?: string
}

export async function readGlobalState(
  ctx: ToolContext,
  args: ReadGlobalStateArgs,
): Promise<{
  appId: number
  scope: 'global'
  state: StateValue[]
}> {
  const { appId, appSpec } = args
  const appInfo = await ctx.algod.getApplicationByID(appId).do()
  const stateKeyMap = appSpec ? buildStateKeyMap(appSpec, 'global') : undefined
  const state = appInfo.params?.globalState
    ? decodeStateItems(appInfo.params.globalState, stateKeyMap)
    : []
  return { appId, scope: 'global', state }
}

// ============================================================================
// Read Local State
// ============================================================================

export interface ReadLocalStateArgs {
  appId: number
  address: string
  appSpec?: string
}

export async function readLocalState(
  ctx: ToolContext,
  args: ReadLocalStateArgs,
): Promise<{
  appId: number
  scope: 'local'
  address: string
  optedIn: boolean
  state: StateValue[]
}> {
  const { appId, address, appSpec } = args
  let accountInfo
  try {
    accountInfo = await ctx.algod.accountApplicationInformation(address, appId).do()
  } catch (error) {
    // algod 404s for an account that NEVER opted in (a closed-out account
    // still returns info without appLocalState) — both mean "not opted in".
    if (isNotFound(error)) {
      return { appId, scope: 'local' as const, address, optedIn: false, state: [] }
    }
    throw error
  }
  const stateKeyMap = appSpec ? buildStateKeyMap(appSpec, 'local') : undefined
  const state = accountInfo.appLocalState?.keyValue
    ? decodeStateItems(accountInfo.appLocalState.keyValue, stateKeyMap)
    : []
  // Distinguish "not opted in" from "opted in with empty state".
  return { appId, scope: 'local', address, optedIn: accountInfo.appLocalState != null, state }
}

// ============================================================================
// Read Box
// ============================================================================

export interface ReadBoxArgs {
  appId: number
  boxName?: string
  keyPrefix?: string
  key?: string | number
  keyType?: 'uint64' | 'address' | 'string'
  appSpec?: string
}

/**
 * Encode a BoxMap key based on its type
 */
function encodeBoxMapKey(
  key: string | number,
  keyType: 'uint64' | 'address' | 'string',
): Uint8Array {
  switch (keyType) {
    case 'uint64': {
      const value = typeof key === 'number' ? BigInt(key) : BigInt(key)
      return new ABIUintType(64).encode(value)
    }
    case 'address': {
      if (typeof key !== 'string') {
        throw new ToolError('INVALID_BOX_KEY', 'Address key must be a string')
      }
      return decodeAddress(key).publicKey
    }
    case 'string': {
      const strKey = typeof key === 'string' ? key : String(key)
      return new TextEncoder().encode(strKey)
    }
  }
}

/**
 * Build the box name bytes from either a simple name or BoxMap parameters
 */
function buildBoxNameBytes(args: ReadBoxArgs): {
  boxNameBytes: Uint8Array
  boxNameDisplay: string
} {
  const { boxName, keyPrefix, key, keyType } = args

  if (keyPrefix !== undefined && key !== undefined) {
    const prefixBytes = new TextEncoder().encode(keyPrefix)
    const keyBytes = encodeBoxMapKey(key, keyType ?? 'uint64')
    const boxNameBytes = new Uint8Array(prefixBytes.length + keyBytes.length)
    boxNameBytes.set(prefixBytes)
    boxNameBytes.set(keyBytes, prefixBytes.length)
    return { boxNameBytes, boxNameDisplay: `${keyPrefix}[${key}]` }
  }

  if (boxName !== undefined) {
    return {
      boxNameBytes: new TextEncoder().encode(boxName),
      boxNameDisplay: boxName,
    }
  }

  throw new ToolError(
    'MISSING_BOX_NAME',
    'Either boxName or keyPrefix+key must be provided to identify the box',
  )
}

export async function readBoxState(
  ctx: ToolContext,
  args: ReadBoxArgs,
): Promise<{
  appId: number
  boxName: string
  exists: boolean
  value?: string
  valueBase64?: string
  size?: number
}> {
  const { appId } = args
  const { boxNameBytes, boxNameDisplay } = buildBoxNameBytes(args)

  try {
    const boxResponse = await ctx.algod.getApplicationBoxByName(appId, boxNameBytes).do()

    const valueArray = new Uint8Array(boxResponse.value)
    const valueBase64 = bytesToBase64(valueArray)

    return {
      appId,
      boxName: boxNameDisplay,
      exists: true,
      value: bytesToDisplay(valueArray),
      valueBase64,
      size: valueArray.length,
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('box not found')) {
      return { appId, boxName: boxNameDisplay, exists: false }
    }
    throw error
  }
}

// ============================================================================
// List Application Boxes
// ============================================================================

export interface ListApplicationBoxesArgs {
  appId: number
  limit?: number
}

/**
 * Lists the boxes an application holds — names only, no values (a box value
 * needs its own read). Reads from algod so it reflects current boxes even
 * where the indexer has box indexing disabled; names decode the explorer way
 * (printable as text, else base64). Follow up with read_box_state for a value.
 */
export async function listApplicationBoxes(ctx: ToolContext, args: ListApplicationBoxesArgs) {
  const limit = Math.min(args.limit ?? 100, 1000)
  const response = await ctx.algod.getApplicationBoxes(args.appId).max(limit).do()
  const boxes = (response.boxes ?? []).map((box) => ({
    name: bytesToDisplay(box.name),
    nameBase64: bytesToBase64(box.name),
  }))

  return {
    appId: args.appId,
    boxes,
    // algod returns up to `max` with no page token; flag a likely-truncated page.
    truncated: boxes.length >= limit || undefined,
  }
}
