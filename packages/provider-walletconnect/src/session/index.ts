/**
 * Session Module
 *
 * Session persistence and serialization for wallet connections.
 */

export { saveSession, loadSession, clearSession, hasSession } from './store.js'
export {
  WalletConnectSessionManager,
  toClientMeta,
  extractSessionData,
  buildSessionOptions,
} from './serialization.js'
