export const GITHUB_PAT_PREFIXES = ['ghp_', 'github_pat_'] as const

const CLASSIC_TOKEN_PATTERN = /^[0-9a-fA-F]{40}$/

export function isValidGitHubPATFormat(pat: string): boolean {
  return GITHUB_PAT_PREFIXES.some((prefix) => pat.startsWith(prefix)) || CLASSIC_TOKEN_PATTERN.test(pat)
}
