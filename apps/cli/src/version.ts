import packageJson from '../package.json' with { type: 'json' }

export const VERSION: string = packageJson.version
