import { z } from 'zod'

import {
  accountListDataSchema,
  accountSummaryDataSchema,
  applicationBoxDataSchema,
  applicationListDataSchema,
  applicationLogsDataSchema,
  applicationStateDataSchema,
  assetHoldersDataSchema,
  assetListDataSchema,
  blockListDataSchema,
  transactionCollectionDataSchema,
} from '../catalog.js'
import type { ViewSpec } from '../protocol.js'
import { resolveResultReference, type ResultStore } from '../results.js'
import type { ViewModelError } from './transaction-detail.js'

function derive<S extends z.ZodType, View extends string>(
  store: ResultStore,
  view: ViewSpec,
  schema: S,
  viewId: View,
  message: string,
):
  | { ok: true; model: { view: View; network: string } & z.infer<S> }
  | { ok: false; error: ViewModelError } {
  const resolution = resolveResultReference(store, view.source)
  if (!resolution.ok) return resolution
  const parsed = schema.safeParse(resolution.value)
  if (!parsed.success) {
    return { ok: false, error: { code: 'INVALID_VIEW_DATA', message } }
  }
  return {
    ok: true,
    model: {
      view: viewId,
      network: resolution.record.network,
      ...(parsed.data as Record<string, unknown>),
    } as { view: View; network: string } & z.infer<S>,
  }
}

function viewModelFor<S extends z.ZodType, View extends string>(
  schema: S,
  viewId: View,
  label: string,
) {
  return (store: ResultStore, view: ViewSpec) =>
    derive(store, view, schema, viewId, `${label} did not match the trusted schema`)
}

/** Derives a transaction list or group model. */
export function createTransactionCollectionViewModel(
  store: ResultStore,
  view: ViewSpec,
): ReturnType<typeof derive<typeof transactionCollectionDataSchema, 'transaction.list' | 'transaction.group'>> {
  const viewId = view.view === 'transaction.group' ? 'transaction.group' : 'transaction.list'
  return derive(
    store,
    view,
    transactionCollectionDataSchema,
    viewId,
    'Transaction collection did not match the trusted schema',
  )
}

export const createAccountSummaryViewModel = viewModelFor(accountSummaryDataSchema, 'account.summary' as const, 'Account summary')
export const createAccountListViewModel = viewModelFor(accountListDataSchema, 'account.list' as const, 'Account list')
export const createAssetListViewModel = viewModelFor(assetListDataSchema, 'asset.list' as const, 'Asset list')
export const createAssetHoldersViewModel = viewModelFor(assetHoldersDataSchema, 'asset.holders' as const, 'Asset holders')
export const createApplicationListViewModel = viewModelFor(applicationListDataSchema, 'application.list' as const, 'Application list')
export const createApplicationStateViewModel = viewModelFor(applicationStateDataSchema, 'application.state' as const, 'Application state')
export const createApplicationLogsViewModel = viewModelFor(applicationLogsDataSchema, 'application.logs' as const, 'Application logs')
export const createApplicationBoxViewModel = viewModelFor(applicationBoxDataSchema, 'application.box' as const, 'Application box')
export const createBlockListViewModel = viewModelFor(blockListDataSchema, 'block.list' as const, 'Block list')

export type AccountSummaryViewModel = Extract<
  ReturnType<typeof createAccountSummaryViewModel>,
  { ok: true }
>['model']
export type AccountListViewModel = Extract<
  ReturnType<typeof createAccountListViewModel>,
  { ok: true }
>['model']
export type AssetListViewModel = Extract<ReturnType<typeof createAssetListViewModel>, { ok: true }>['model']
export type AssetHoldersViewModel = Extract<
  ReturnType<typeof createAssetHoldersViewModel>,
  { ok: true }
>['model']
export type ApplicationListViewModel = Extract<
  ReturnType<typeof createApplicationListViewModel>,
  { ok: true }
>['model']
export type ApplicationStateViewModel = Extract<
  ReturnType<typeof createApplicationStateViewModel>,
  { ok: true }
>['model']
export type ApplicationLogsViewModel = Extract<
  ReturnType<typeof createApplicationLogsViewModel>,
  { ok: true }
>['model']
export type ApplicationBoxViewModel = Extract<
  ReturnType<typeof createApplicationBoxViewModel>,
  { ok: true }
>['model']
export type BlockListViewModel = Extract<ReturnType<typeof createBlockListViewModel>, { ok: true }>['model']
export type TransactionCollectionViewModel = Extract<
  ReturnType<typeof createTransactionCollectionViewModel>,
  { ok: true }
>['model']
