import {
  resolveDeployment as resolveCoreDeployment,
  type DeploymentOptions,
  type ResolvedDeployment as CoreDeployment,
} from '../core/index.js'

export interface VibekitMcpOptions extends DeploymentOptions {
  /** Server identity advertised to clients. */
  name?: string
  version?: string
}

export interface ResolvedMcpDeployment extends CoreDeployment {
  name: string
  version: string
}

/**
 * Validate the tool registry and build pooled per-network contexts
 * (core's resolveDeployment), plus the MCP server identity.
 */
export function resolveMcpDeployment(options: VibekitMcpOptions): ResolvedMcpDeployment {
  return {
    ...resolveCoreDeployment(options),
    name: options.name ?? 'vibekit',
    version: options.version ?? '0.0.0',
  }
}
