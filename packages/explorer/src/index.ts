/**
 * The Explorer protocol and what the two apps build on: result records, view
 * ids and view models, the write flow, formatting, input classification, and
 * the recorded sample data. The live host is the separate `./live` subpath.
 */
export { EXPLORER_PROTOCOL_VERSION, explorerProtocolVersionSchema } from './core/version.js'
export type { ExplorerProtocolVersion } from './core/version.js'
export {
  addResult,
  createResultStore,
  failedResultSchema,
  findResultRecord,
  jsonValueSchema,
  resolveResultReference,
  resultPathSchema,
  resultPathSegmentSchema,
  resultReferenceSchema,
  sameResultReference,
  structuredResultSchema,
  successfulResultSchema,
} from './core/results.js'
export type {
  FailedResult,
  JsonValue,
  ResultIdentity,
  ResultReference,
  ResultResolution,
  ResultResolutionError,
  ResultStore,
  StructuredResult,
  SuccessfulResult,
  ViewModelError,
} from './core/results.js'
export {
  TRUSTED_VIEW_IDS,
  approvalDecisionSchema,
  approvalRequestSchema,
  createApprovalDecisionEvent,
  createApprovalRequestEvent,
  createWriteStageEvent,
  viewSpecSchema,
  writeConfirmEventSchema,
  writeDraftEventSchema,
  writeInspectEventSchema,
  writeSignEventSchema,
  writeSimulateEventSchema,
  writeStageEventSchema,
} from './core/protocol.js'
export type {
  ApprovalDecision,
  ApprovalRequest,
  OpenView,
  TrustedViewId,
  ViewSpec,
  WriteStageEvent,
} from './core/protocol.js'
export { formatAssetAmount, formatBaseUnits, formatMicroAlgos } from './format.js'
export {
  classifyExplorerInput,
  parseEntityComposerCommand,
  routeExplorerComposerInput,
} from './input.js'
export type { ExplorerComposerRoute } from './input.js'
export { loadNextPage, mergePages, nextPageArgs } from './views/pages.js'
export {
  createAccountListViewModel,
  createAccountOpenView,
  createAccountPortfolioViewModel,
  createAccountSummaryViewModel,
} from './views/account.js'
export type {
  AccountListViewModel,
  AccountPortfolioViewModel,
  AccountSummaryViewModel,
} from './views/account.js'
export {
  applicationExplanationDataSchema,
  createApplicationBoxViewModel,
  createApplicationBoxesViewModel,
  createApplicationDetailViewModel,
  createApplicationExplanationViewModel,
  createApplicationListViewModel,
  createApplicationLocalsViewModel,
  createApplicationLogsViewModel,
  createApplicationMethodsViewModel,
  createApplicationProgramViewModel,
  createApplicationStateViewModel,
} from './views/application.js'
export type {
  ApplicationDetailViewModel,
  ApplicationExplanationViewModel,
  ApplicationMethodsViewModel,
  ApplicationProgramViewModel,
} from './views/application.js'
export {
  buildAssetHoldingsRecord,
  createAssetDetailViewModel,
  createAssetHoldersViewModel,
  createAssetHoldingsViewModel,
  createAssetListViewModel,
} from './views/asset.js'
export type { AssetDetailViewModel } from './views/asset.js'
export {
  createBlockDetailViewModel,
  createBlockListViewModel,
  formatBlockTxnType,
  formatExplorerTime,
  formatOnCompletion,
} from './views/block.js'
export type { BlockDetailViewModel } from './views/block.js'
export { createNetworkStatusViewModel } from './views/network.js'
export {
  buildPluginRecord,
  isPluginViewId,
  PLUGIN_VIEW_IDS,
  createArcadeMarketViewModel,
  createArcadeMarketsViewModel,
  createArcadeOrderbookViewModel,
  createArcadeOrdersViewModel,
  createArcadePositionsViewModel,
  createDefiProtocolsViewModel,
  createNfdListViewModel,
  createNfdProfileViewModel,
  createVestigeHistoryViewModel,
  createPeraAssetViewModel,
  createWebPageViewModel,
  createWebResultsViewModel,
  createSwapQuoteViewModel,
  createVestigeMarketsViewModel,
  createVestigePricesViewModel,
} from './views/plugins.js'
export type {
  AssetHistory,
  AssetPrices,
  AssetProfile,
  DefiProtocols,
  MarketRow,
  Markets,
  NfdList,
  NfdRecord,
  PluginViewId,
  OpenOrders,
  OrderbookView,
  Positions,
  RankedAssets,
  SwapQuote,
  WebPage,
  WebResults,
} from './views/plugins.js'
export type { NetworkStatusViewModel } from './views/network.js'
export {
  createTransactionCollectionViewModel,
  createTransactionDetailViewModel,
} from './views/transaction.js'
export type {
  TransactionDetailViewModel,
  TransactionRowData,
  TransactionSearchFilter,
} from './views/transaction.js'
export { buildTransactionsGraph, transactionKind } from './views/transaction-graph.js'
export type {
  GraphHorizontal,
  GraphLabel,
  GraphMarkerTag,
  GraphTransaction,
  GraphVertical,
  TransactionsGraph,
} from './views/transaction-graph.js'
export { createWriteFlowViewModel, writeDraftDataSchema } from './flows/write-flow.js'
export type { WriteFlowViewModel, WriteFlowState } from './flows/write-flow.js'
export {
  completeApprovedWriteFlow,
  performWriteFlowStep,
  startWriteFlow,
  startWriteFlowFromDraft,
} from './flows/write-flow-host.js'
export type { PaymentDraftParams, WriteFlowHost } from './flows/write-flow-host.js'
export { bridgeToolResult, unsignedGroupFromToolResult } from './bridge.js'
export type { ToolResultEventLike } from './bridge.js'
export { lookupAmbiguousEntity } from './entity-lookup.js'
export { FIXTURE_ADDRESS_BOOK } from './sample/account.js'
export {
  PAYMENT_FIXTURE_AMOUNT_MICROALGOS,
  PAYMENT_FIXTURE_SIGNED_TRANSACTION,
  PAYMENT_FIXTURE_TRANSACTION_ID,
  PAYMENT_FIXTURE_UNSIGNED_TRANSACTION,
  createSampleHost,
  parsePaymentComposerCommand,
} from './sample/payment.js'
export {
  FIXTURE_RECEIVER,
  FIXTURE_RESULT_ID,
  FIXTURE_SENDER,
  FIXTURE_TRANSACTION_ID,
  createFixtureResultStore,
  lookupFixture,
} from './sample/transaction.js'
export type { FixtureLookupOutcome } from './sample/transaction.js'
export type {
  AccountLookupHost,
  ApplicationLookupHost,
  AssetLookupHost,
  BlockLookupHost,
  EntityLookupHost,
  ExplorerReadHost,
  LiveNetworkId,
  ToolCallHost,
  TransactionLookupHost,
} from './host.js'
export type { TransactionKind, TransactionKindSource } from './views/transaction-graph.js'
