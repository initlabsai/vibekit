/** Default result limit for paginated queries. */
export const DEFAULT_LIMIT = 20

/** Drop nextToken when the result set is smaller than the requested page size. */
export function stripFinalToken(count: number, limit: number, token?: string): string | undefined {
  return count < limit ? undefined : token
}
