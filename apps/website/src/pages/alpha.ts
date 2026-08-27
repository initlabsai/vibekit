/**
 * Serves the canonical install.sh at https://getvibekit.ai/alpha with the
 * channel pre-set, so the prerelease one-liner is short enough to read:
 *
 *   curl -fsSL getvibekit.ai/alpha | sh
 *
 * The line is inserted after the shebang rather than substituted into the
 * script, so it cannot silently stop applying if install.sh is reworded.
 * An explicit VIBEKIT_CHANNEL still wins.
 */
import installScript from '../../../../install.sh?raw'

const [shebang, ...rest] = installScript.split('\n')
const alphaScript = [shebang, 'VIBEKIT_CHANNEL="${VIBEKIT_CHANNEL:-alpha}"', ...rest].join('\n')

export const GET = () =>
  new Response(alphaScript, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
