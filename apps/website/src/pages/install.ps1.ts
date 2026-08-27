/**
 * Serves the canonical repo-root install.ps1 at https://getvibekit.ai/install.ps1
 * so `irm https://getvibekit.ai/install.ps1 | iex` works. Imported with
 * ?raw at build time: one source of truth, no copy to drift.
 */
import installScript from '../../../../install.ps1?raw'

export const GET = () =>
  new Response(installScript, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
