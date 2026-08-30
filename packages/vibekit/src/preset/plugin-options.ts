/** Plugin options a Node host reads from its environment. */

/** Alpha Arcade's API needs a key (ALPHA_API_KEY, from the platform's Account page); without one, markets come from a slow on-chain scan. */
export function alphaOptions(): { apiKey?: string } {
  const apiKey = process.env.ALPHA_API_KEY
  return apiKey ? { apiKey } : {}
}

/** Exa answers keyless for a few calls; a key (EXA_API_KEY) lifts the limit. */
export function webOptions(): { apiKey?: string } {
  const apiKey = process.env.EXA_API_KEY
  return apiKey ? { apiKey } : {}
}
