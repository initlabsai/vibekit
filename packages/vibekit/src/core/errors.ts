/**
 * The error contract: handlers throw, hosts map once (MCP `isError`, API error
 * JSON). Tools never return `{ error }` result shapes.
 */
export class ToolError extends Error {
  constructor(
    /** Stable machine-readable code, e.g. 'INVALID_ADDRESS', 'NO_SIGNER'. */
    public readonly code: string,
    /** User-safe message — shown verbatim to the model/user. */
    message: string,
  ) {
    super(message)
    this.name = 'ToolError'
  }
}
