/**
 * Application state read handlers
 *
 * Domain logic for reading global state, local state, and box storage.
 */

import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { ABIUintType, decodeAddress } from 'algosdk'

// ============================================================================
// Shared types and helpers
// ============================================================================

interface StateValue {
  key: string
  value: unknown
  type: 'uint' | 'bytes'
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
function bytesToBase64(bytes: Uint8Array | string): string {
  if (typeof bytes === 'string') {
    return bytes
  }
  return btoa(String.fromCharCode(...bytes))
}

/** Encode a Uint8Array to base64 */
function encodeBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
}

/**
 * Parse an ARC-56/ARC-32 app spec to build a map from state key (base64/string) to human-readable name.
 */
function buildStateKeyMap(
  appSpecJson: string,
  scope: 'global' | 'local'
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
  items: Array<{ key: Uint8Array | string; value: { type: number; bytes: Uint8Array | string; uint: number | bigint } }>,
  stateKeyMap?: Map<string, string>
): StateValue[] {
  const state: StateValue[] = []
  for (const item of items) {
    const keyString = bytesToString(item.key)
    const keyBase64 = bytesToBase64(item.key)
    const displayKey = stateKeyMap?.get(keyBase64) || stateKeyMap?.get(keyString) || keyString

    if (item.value.type === 1) {
      state.push({
        key: displayKey,
        value: bytesToString(item.value.bytes),
        type: 'bytes',
      })
    } else {
      state.push({
        key: displayKey,
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
  algorand: AlgorandClient,
  args: ReadGlobalStateArgs
): Promise<{
  appId: number
  state: StateValue[]
}> {
  const { appId, appSpec } = args
  const appInfo = await algorand.client.algod.getApplicationByID(appId).do()
  const stateKeyMap = appSpec ? buildStateKeyMap(appSpec, 'global') : undefined
  const state = appInfo.params.globalState ? decodeStateItems(appInfo.params.globalState, stateKeyMap) : []
  return { appId, state }
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
  algorand: AlgorandClient,
  args: ReadLocalStateArgs
): Promise<{
  appId: number
  address: string
  state: StateValue[]
}> {
  const { appId, address, appSpec } = args
  const accountInfo = await algorand.client.algod.accountApplicationInformation(address, appId).do()
  const stateKeyMap = appSpec ? buildStateKeyMap(appSpec, 'local') : undefined
  const state = accountInfo.appLocalState?.keyValue
    ? decodeStateItems(accountInfo.appLocalState.keyValue, stateKeyMap)
    : []
  return { appId, address, state }
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
  keyType: 'uint64' | 'address' | 'string'
): Uint8Array {
  switch (keyType) {
    case 'uint64': {
      const value = typeof key === 'number' ? BigInt(key) : BigInt(key)
      return new ABIUintType(64).encode(value)
    }
    case 'address': {
      if (typeof key !== 'string') {
        throw new Error('Address key must be a string')
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

  throw new Error('Either boxName or keyPrefix+key must be provided to identify the box')
}

export async function readBoxState(
  algorand: AlgorandClient,
  args: ReadBoxArgs
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
    const boxResponse = await algorand.client.algod
      .getApplicationBoxByName(appId, boxNameBytes)
      .do()

    const valueArray = new Uint8Array(boxResponse.value)
    const valueString = new TextDecoder().decode(valueArray)
    const valueBase64 = encodeBase64(valueArray)

    return {
      appId,
      boxName: boxNameDisplay,
      exists: true,
      value: valueString,
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
