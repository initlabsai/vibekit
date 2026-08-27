/**
 * Bundled skills — pre-fetched at build time by scripts/bundle-skills.ts.
 */

import { BUNDLED_SKILLS } from './bundled.js'
import { qualifiedCatalogNames } from './catalogs.js'

export interface SkillFile {
  path: string
  content: string
}

export interface SkillDirectory {
  name: string
  files: SkillFile[]
}

/** Array of skill names selected by the user. */

export function getSkillNames(): string[] {
  return BUNDLED_SKILLS.map((skill) => skill.name)
}

export function getSkillsByNames(names: string[]): SkillDirectory[] {
  return BUNDLED_SKILLS.filter((skill) => names.includes(skill.name))
}

/** Everything selectable: bundled names plus `<catalog>/<skill>` catalog names. */
export function getAllSkillNames(): string[] {
  return [...getSkillNames(), ...qualifiedCatalogNames()]
}
