/**
 * Contract write handlers
 *
 * Domain logic for smart contract deployment and management.
 */

import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { ResolveSenderFn, ResolveAppSpecFn } from '@vibekit/core'
import { sendTransactions } from '../../transactions/compose/index'

// ============================================================================
// app_deploy
// ============================================================================

export interface AppDeployArgs {
  appSpec?: string
  appSpecPath?: string
  method?: string
  args?: unknown[]
  deployTimeParams?: Record<string, string | number | bigint | Uint8Array>
  sender?: string
}

export async function appDeploy(
  algorand: AlgorandClient,
  args: AppDeployArgs,
  resolveSender: ResolveSenderFn,
  resolveAppSpec: ResolveAppSpecFn
) {
  const { appSpec, appSpecPath, method, args: methodArgs, deployTimeParams, sender } = args

  const resolvedAppSpec = await resolveAppSpec(appSpec, appSpecPath)
  if (!resolvedAppSpec) {
    throw new Error('Must provide either appSpec or appSpecPath')
  }

  const { address: senderAddress } = await resolveSender(algorand, sender)

  const factory = algorand.client.getAppFactory({
    appSpec: resolvedAppSpec,
    defaultSender: senderAddress,
    deployTimeParams,
  })

  if (method) {
    const { appClient, result } = await factory.send.create({
      method,
      args: methodArgs as Parameters<typeof factory.send.create>[0]['args'],
    })
    return {
      success: true,
      appId: Number(appClient.appId),
      appAddress: appClient.appAddress.toString(),
      txId: result.transaction.txID(),
      confirmedRound: result.confirmation?.confirmedRound
        ? Number(result.confirmation.confirmedRound)
        : undefined,
    }
  } else {
    const { appClient, result } = await factory.send.bare.create()
    return {
      success: true,
      appId: Number(appClient.appId),
      appAddress: appClient.appAddress.toString(),
      txId: result.transaction.txID(),
      confirmedRound: result.confirmation?.confirmedRound
        ? Number(result.confirmation.confirmedRound)
        : undefined,
    }
  }
}

// ============================================================================
// app_call
// ============================================================================

export interface AppCallArgs {
  appId: number
  method?: string
  args?: unknown[]
  sender?: string
  appSpec?: string
  appSpecPath?: string
  methodSignature?: string
  extraFee?: number
  maxFee?: number
}

export async function appCall(
  algorand: AlgorandClient,
  args: AppCallArgs,
  resolveSender: ResolveSenderFn,
  resolveAppSpec: ResolveAppSpecFn
) {
  const {
    appId,
    method,
    args: methodArgs = [],
    sender,
    appSpec,
    appSpecPath,
    methodSignature,
    extraFee,
    maxFee,
  } = args

  if (!appSpec && !appSpecPath && !methodSignature) {
    throw new Error('Must provide either appSpec, appSpecPath, or methodSignature')
  }

  // Resolve appSpec if path provided, for passing through sendTransactions
  const resolvedAppSpec = await resolveAppSpec(appSpec, appSpecPath)

  const result = await sendTransactions(
    {
      transactions: [
        {
          type: 'app_call',
          appId,
          methodSignature,
          appSpec: resolvedAppSpec,
          method,
          args: methodArgs,
          extraFee,
          maxFee,
          sender,
        },
      ],
    },
    algorand,
    resolveSender,
    resolveAppSpec
  )

  return {
    success: true,
    txId: result.txIds[0],
    confirmedRound: result.confirmedRound,
    return: result.returns?.[0],
    appId,
    method: methodSignature || method || '',
  }
}

// ============================================================================
// app_opt_in
// ============================================================================

export interface AppOptInArgs {
  appId: number
  appSpec?: string
  appSpecPath?: string
  method?: string
  args?: unknown[]
  sender?: string
  extraFee?: number
  maxFee?: number
}

export async function appOptIn(
  algorand: AlgorandClient,
  args: AppOptInArgs,
  resolveSender: ResolveSenderFn,
  resolveAppSpec: ResolveAppSpecFn
) {
  const { appId, appSpec, appSpecPath, method, args: methodArgs, sender, extraFee, maxFee } = args

  const resolvedAppSpec = await resolveAppSpec(appSpec, appSpecPath)

  const result = await sendTransactions(
    {
      transactions: [
        {
          type: 'app_opt_in',
          appId,
          appSpec: resolvedAppSpec,
          method,
          args: methodArgs,
          extraFee,
          maxFee,
          sender,
        },
      ],
    },
    algorand,
    resolveSender,
    resolveAppSpec
  )

  return {
    success: true,
    txId: result.txIds[0],
    confirmedRound: result.confirmedRound,
    appId,
  }
}

// ============================================================================
// app_close_out
// ============================================================================

export interface AppCloseOutArgs {
  appId: number
  appSpec?: string
  appSpecPath?: string
  method?: string
  args?: unknown[]
  sender?: string
  extraFee?: number
  maxFee?: number
}

export async function appCloseOut(
  algorand: AlgorandClient,
  args: AppCloseOutArgs,
  resolveSender: ResolveSenderFn,
  resolveAppSpec: ResolveAppSpecFn
) {
  const { appId, appSpec, appSpecPath, method, args: methodArgs, sender, extraFee, maxFee } = args

  const resolvedAppSpec = await resolveAppSpec(appSpec, appSpecPath)

  const result = await sendTransactions(
    {
      transactions: [
        {
          type: 'app_close_out',
          appId,
          appSpec: resolvedAppSpec,
          method,
          args: methodArgs,
          extraFee,
          maxFee,
          sender,
        },
      ],
    },
    algorand,
    resolveSender,
    resolveAppSpec
  )

  return {
    success: true,
    txId: result.txIds[0],
    confirmedRound: result.confirmedRound,
    appId,
  }
}

// ============================================================================
// app_delete
// ============================================================================

export interface AppDeleteArgs {
  appId: number
  appSpec?: string
  appSpecPath?: string
  method?: string
  args?: unknown[]
  sender?: string
  extraFee?: number
  maxFee?: number
}

export async function appDelete(
  algorand: AlgorandClient,
  args: AppDeleteArgs,
  resolveSender: ResolveSenderFn,
  resolveAppSpec: ResolveAppSpecFn
) {
  const { appId, appSpec, appSpecPath, method, args: methodArgs, sender, extraFee, maxFee } = args

  const resolvedAppSpec = await resolveAppSpec(appSpec, appSpecPath)

  const result = await sendTransactions(
    {
      transactions: [
        {
          type: 'app_delete',
          appId,
          appSpec: resolvedAppSpec,
          method,
          args: methodArgs,
          extraFee,
          maxFee,
          sender,
        },
      ],
    },
    algorand,
    resolveSender,
    resolveAppSpec
  )

  return {
    success: true,
    txId: result.txIds[0],
    confirmedRound: result.confirmedRound,
    appId,
  }
}

// ============================================================================
// app_get_info (read handler, uses algod)
// ============================================================================

export interface AppGetInfoArgs {
  appId: number
}

export async function appGetInfo(algorand: AlgorandClient, args: AppGetInfoArgs) {
  const { appId } = args

  const appInfo = await algorand.client.algod.getApplicationByID(appId).do()

  const approvalBytes = appInfo.params.approvalProgram
  const clearBytes = appInfo.params.clearStateProgram

  return {
    appId,
    creator: appInfo.params.creator.toString(),
    globalStateSchema: {
      numUint: appInfo.params.globalStateSchema?.numUint || 0,
      numByteSlice: appInfo.params.globalStateSchema?.numByteSlice || 0,
    },
    localStateSchema: {
      numUint: appInfo.params.localStateSchema?.numUint || 0,
      numByteSlice: appInfo.params.localStateSchema?.numByteSlice || 0,
    },
    approvalProgram: approvalBytes
      ? btoa(String.fromCharCode(...new Uint8Array(approvalBytes)))
      : '',
    clearStateProgram: clearBytes ? btoa(String.fromCharCode(...new Uint8Array(clearBytes))) : '',
  }
}

// ============================================================================
// app_list_methods (read handler, no network needed)
// ============================================================================

export interface AppListMethodsArgs {
  appSpec?: string
  appSpecPath?: string
}

interface MethodInfo {
  name: string
  signature: string
  description?: string
  args: Array<{
    name: string
    type: string
    description?: string
  }>
  returns: {
    type: string
    description?: string
  }
}

export async function appListMethods(
  args: AppListMethodsArgs,
  resolveAppSpec: ResolveAppSpecFn
): Promise<{ methods: MethodInfo[] }> {
  const resolvedAppSpecJson = await resolveAppSpec(args.appSpec, args.appSpecPath)
  if (!resolvedAppSpecJson) {
    throw new Error('Must provide either appSpec or appSpecPath')
  }

  const appSpec = JSON.parse(resolvedAppSpecJson)

  const methods: MethodInfo[] = []
  const rawMethods = appSpec.methods || appSpec.contract?.methods || []

  for (const method of rawMethods) {
    const argTypes = method.args?.map((a: { type: string }) => a.type).join(',') || ''
    const returnType = method.returns?.type || 'void'

    methods.push({
      name: method.name,
      signature: `${method.name}(${argTypes})${returnType}`,
      description: method.desc || method.description,
      args: (method.args || []).map((a: { name: string; type: string; desc?: string }) => ({
        name: a.name,
        type: a.type,
        description: a.desc,
      })),
      returns: {
        type: returnType,
        description: method.returns?.desc,
      },
    })
  }

  return { methods }
}
