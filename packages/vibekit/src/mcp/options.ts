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

export interface ResolvedDeployment extends CoreDeployment {
  name: string
  version: string
}

/**
 * Validate the tool registry and build pooled per-network contexts
 * (core's resolveDeployment), plus the MCP server identity.
 */
export function resolveDeployment(options: VibekitMcpOptions): ResolvedDeployment {
  return {
    ...resolveCoreDeployment(options),
    name: options.name ?? 'vibekit',
    version: options.version ?? '0.0.0',
  }
}
