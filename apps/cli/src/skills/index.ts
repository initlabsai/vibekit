/**
 * Bundled skills — pre-fetched at build time by scripts/bundle-skills.ts.
 */

import { BUNDLED_SKILLS } from './bundled.js'

export interface SkillFile {
  path: string
  content: string
}

export interface SkillDirectory {
  name: string
  files: SkillFile[]
}

/** Array of skill names selected by the user. */
export type SkillSelection = string[]

export function getSkillNames(): string[] {
  return BUNDLED_SKILLS.map((skill) => skill.name)
}

export function getSkillsByNames(names: SkillSelection): SkillDirectory[] {
  return BUNDLED_SKILLS.filter((skill) => names.includes(skill.name))
}
