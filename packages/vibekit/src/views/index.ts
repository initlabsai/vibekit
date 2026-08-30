/**
 * Views: what a tool result looks like once a host has it — records by view
 * id, the view models a card renders, formatting, input classification, and
 * the recorded sample data. Browser-safe. The deployment-backed host that
 * produces live records is `@initlabs/vibekit/live`.
 */
export { RECORD_PROTOCOL_VERSION, recordProtocolVersionSchema } from '../actions/index.js'
export type { RecordProtocolVersion } from '../actions/index.js'
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
} from '../actions/index.js'
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
} from '../actions/index.js'
export {
  TRUSTED_VIEW_IDS,
  approvalDecisionSchema,
  approvalRequestSchema,
  createApprovalDecisionEvent,
  createApprovalRequestEvent,
  createStageEvent,
  viewSpecSchema,
  confirmStageEventSchema,
  draftStageEventSchema,
  inspectStageEventSchema,
  signStageEventSchema,
  simulateStageEventSchema,
  stageEventSchema,
} from '../actions/index.js'
export type {
  ApprovalDecision,
  ApprovalRequest,
  OpenView,
  TrustedViewId,
  ViewSpec,
  StageEvent,
} from '../actions/index.js'
export { formatAssetAmount, formatBaseUnits, formatMicroAlgos } from './format.js'
export {
  classifyExplorerInput,
  parseEntityComposerCommand,
  routeExplorerComposerInput,
} from './input.js'
export type { ExplorerComposerRoute } from './input.js'
export { loadNextPage, mergePages, nextPageArgs } from './pages.js'
export {
  createAccountListViewModel,
  createAccountOpenView,
  createAccountPortfolioViewModel,
  createAccountSummaryViewModel,
} from './account.js'
export type {
  AccountListViewModel,
  AccountPortfolioViewModel,
  AccountSummaryViewModel,
} from './account.js'
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
} from './application.js'
export type {
  ApplicationDetailViewModel,
  ApplicationExplanationViewModel,
  ApplicationMethodsViewModel,
  ApplicationProgramViewModel,
} from './application.js'
export {
  buildAssetHoldingsRecord,
  createAssetDetailViewModel,
  createAssetHoldersViewModel,
  createAssetHoldingsViewModel,
  createAssetListViewModel,
} from './asset.js'
export type { AssetDetailViewModel } from './asset.js'
export {
  createBlockDetailViewModel,
  createBlockListViewModel,
  formatBlockTxnType,
  formatExplorerTime,
  formatOnCompletion,
} from './block.js'
export type { BlockDetailViewModel } from './block.js'
export { createNetworkStatusViewModel } from './network.js'
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
} from './plugins.js'
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
} from './plugins.js'
export type { NetworkStatusViewModel } from './network.js'
export {
  createTransactionCollectionViewModel,
  createTransactionDetailViewModel,
} from './transaction.js'
export type {
  TransactionDetailViewModel,
  TransactionRowData,
  TransactionSearchFilter,
} from './transaction.js'
export { buildTransactionsGraph, transactionKind } from './transaction-graph.js'
export type {
  GraphHorizontal,
  GraphLabel,
  GraphMarkerTag,
  GraphTransaction,
  GraphVertical,
  TransactionsGraph,
} from './transaction-graph.js'
export { createActionViewModel } from './action.js'
export type { ActionViewModel } from './action.js'
export { draftDataSchema } from '../actions/index.js'
export type { ActionState } from '../actions/index.js'
export {
  submitAction,
  performActionStep,
  startAction,
  startActionFromDraft,
} from '../actions/index.js'
export type { ActionDraft, ActionHost } from '../actions/index.js'
export {
  createWalletSignDraft,
  signGroupForDraft,
  unsignedTransactionsForDraft,
  type DraftSigner,
} from '../actions/index.js'
export { bridgeToolResult, unsignedGroupFromToolResult } from './bridge.js'
export { createReadHost, recordForToolCall } from './read-host.js'
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
export type { TransactionKind, TransactionKindSource } from './transaction-graph.js'
