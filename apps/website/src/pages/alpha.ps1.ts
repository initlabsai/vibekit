/**
 * Serves the canonical install.ps1 at https://getvibekit.ai/alpha.ps1 with the
 * channel pre-set, so the prerelease one-liner is short enough to read:
 *
 *   irm https://getvibekit.ai/alpha.ps1 | iex
 *
 * The line is prepended rather than substituted into the script, so it cannot
 * silently stop applying if install.ps1 is reworded. An explicit
 * VIBEKIT_CHANNEL still wins.
 */
import installScript from '../../../../install.ps1?raw'

const alphaScript = `if (-not $env:VIBEKIT_CHANNEL) { $env:VIBEKIT_CHANNEL = 'alpha' }\n${installScript}`

export const GET = () =>
  new Response(alphaScript, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
