// ---------------------------------------------------------------------------
// Tool name preset arrays
// ---------------------------------------------------------------------------

export const alphaArcadeTools = [
  'get_live_markets',
  'get_market',
  'get_orderbook',
  'get_positions',
  'get_open_orders',
] as const

export const accountTools = [
  'lookup_account',
  'batch_lookup_accounts',
  'search_accounts',
  'search_account_transactions',
  'get_account_assets',
  'get_account_app_local_states',
  'get_account_portfolio',
] as const

export const assetTools = [
  'lookup_asset',
  'search_asset_balances',
  'search_asset_transactions',
  'search_assets',
] as const

export const transactionTools = [
  'lookup_transaction',
  'search_transactions',
  'lookup_transaction_group',
] as const

export const contractTools = [
  'lookup_application',
  'search_applications',
  'lookup_application_logs',
  'read_global_state',
  'read_local_state',
  'read_box_state',
] as const

export const networkTools = [
  'get_network_status',
  'lookup_block',
  'search_block_headers',
] as const

export const nfdTools = [
  'resolve_nfd',
  'reverse_resolve_nfd',
  'batch_reverse_resolve_nfd',
] as const

export const ecosystemTools = ['search_ecosystem'] as const

export const explorerTools = [
  ...accountTools,
  ...assetTools,
  ...transactionTools,
  ...contractTools,
  ...networkTools,
  ...nfdTools,
  ...ecosystemTools,
] as const

export const allTools = [...explorerTools, ...alphaArcadeTools] as const
