/**
 * Algorand Network Configuration
 *
 * The MCP server has built-in presets for localnet, testnet, and mainnet.
 * No env vars are needed for default operation - the server will:
 * 1. Use saved network from DB (if user previously switched networks)
 * 2. Default to localnet with standard AlgoKit endpoints
 *
 * Env vars are only needed for custom network configurations (e.g., custom nodes).
 */

/**
 * Environment variables for MCP execution.
 * Empty by default - MCP server uses built-in presets.
 *
 * To use a custom network configuration, set these env vars in your MCP config:
 * - ALGORAND_NETWORK: 'localnet' | 'testnet' | 'mainnet'
 * - ALGORAND_ALGOD: Algod server URL
 * - ALGORAND_TOKEN: Algod auth token
 * - ALGORAND_KMD: KMD server URL (localnet only)
 * - ALGORAND_KMD_TOKEN: KMD auth token (localnet only)
 * - ALGORAND_INDEXER: Indexer server URL
 */
export const MCP_ENV_VARS = {} as const
