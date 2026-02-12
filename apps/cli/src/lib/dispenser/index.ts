/**
 * Dispenser Service Layer
 *
 * Pure business logic - no CLI dependencies (@clack/prompts, picocolors).
 * Used by: commands/dispenser/, commands/init/phases/auth.ts
 */

export * from './auth'
export * from './login'

import { hasDispenserToken as dbHasDispenserToken, getDispenserToken } from '@vibekit/db'

export function hasDispenserToken(): boolean {
  return dbHasDispenserToken()
}

export function loadDispenserToken(): string | null {
  return getDispenserToken()
}
