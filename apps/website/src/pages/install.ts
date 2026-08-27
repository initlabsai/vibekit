/**
 * Serves the canonical repo-root install.sh at https://getvibekit.ai/install
 * so `curl -fsSL https://getvibekit.ai/install | sh` works. Imported with
 * ?raw at build time: one source of truth, no copy to drift.
 */
import installScript from '../../../../install.sh?raw'

export const GET = () =>
  new Response(installScript, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
