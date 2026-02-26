// Vault Docker management

import { exec as execCallback } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { writeFile } from 'fs/promises'
import { ensureVibekitDir } from '@vibekit/config'
import { getDockerComposePath, VAULT_URL } from './paths'
import type { VaultStatus } from './types'

const exec = promisify(execCallback)

const DOCKER_COMPOSE_CONTENT = `services:
  vault:
    image: hashicorp/vault:latest
    container_name: vibekit-vault
    ports:
      - "127.0.0.1:8200:8200"
    restart: unless-stopped
    volumes:
      - vibekit-vault-logs:/vault/logs
      - vibekit-vault-data:/vault/file
    environment:
      VAULT_LOCAL_CONFIG: '{"storage": {"file": {"path": "/vault/file"}},"listener": {"tcp": {"address": "0.0.0.0:8200","tls_disable": true}},"ui": true}'
      VAULT_ADDR: http://127.0.0.1:8200
    cap_add:
      - IPC_LOCK
    command: server

volumes:
  vibekit-vault-logs:
  vibekit-vault-data:
`

export async function checkDocker(): Promise<boolean> {
  try {
    await exec('docker --version')
    return true
  } catch {
    return false
  }
}

export async function checkDockerCompose(): Promise<boolean> {
  try {
    await exec('docker compose version')
    return true
  } catch {
    try {
      await exec('docker-compose --version')
      return true
    } catch {
      return false
    }
  }
}

async function getComposeCommand(): Promise<string> {
  try {
    await exec('docker compose version')
    return 'docker compose'
  } catch {
    return 'docker-compose'
  }
}

export async function ensureDockerCompose(): Promise<void> {
  await ensureVibekitDir()
  const composePath = getDockerComposePath()
  if (!existsSync(composePath)) {
    await writeFile(composePath, DOCKER_COMPOSE_CONTENT, 'utf-8')
  }
}

export async function startContainers(): Promise<void> {
  await ensureDockerCompose()
  const compose = await getComposeCommand()
  await exec(`${compose} -f "${getDockerComposePath()}" up -d`)
}

export async function stopContainers(removeVolumes: boolean = false): Promise<void> {
  const composePath = getDockerComposePath()
  if (!existsSync(composePath)) return

  const compose = await getComposeCommand()
  const flags = removeVolumes ? 'down -v' : 'down'
  await exec(`${compose} -f "${composePath}" ${flags}`)
}

export async function getContainerStatus(name: string): Promise<boolean> {
  try {
    const { stdout } = await exec(`docker inspect -f "{{.State.Running}}" ${name}`)
    return stdout.trim() === 'true'
  } catch {
    return false
  }
}

export async function isVaultSealed(): Promise<boolean> {
  try {
    const response = await fetch(`${VAULT_URL}/v1/sys/seal-status`)
    const data = (await response.json()) as { sealed: boolean }
    return data.sealed
  } catch {
    return true
  }
}

export async function isVaultInitialized(): Promise<boolean> {
  try {
    const response = await fetch(`${VAULT_URL}/v1/sys/seal-status`)
    const data = (await response.json()) as { initialized: boolean }
    return data.initialized
  } catch {
    return false
  }
}

export async function waitForVault(timeoutMs: number = 30000): Promise<boolean> {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${VAULT_URL}/v1/sys/health`)
      // 200 = initialized, unsealed, active
      // 501 = not initialized
      // 503 = sealed
      if (response.ok || response.status === 501 || response.status === 503) {
        return true
      }
    } catch {
      // Vault not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return false
}

export async function getVaultStatus(): Promise<VaultStatus> {
  const initialized = existsSync(getDockerComposePath())
  const vaultRunning = await getContainerStatus('vibekit-vault')
  const vaultSealed = vaultRunning ? await isVaultSealed() : true

  return {
    initialized,
    vaultRunning,
    vaultSealed,
    vaultUrl: VAULT_URL,
  }
}

export async function pullImages(): Promise<void> {
  await exec('docker pull hashicorp/vault:latest')
}
