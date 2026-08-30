/** The catalogue: every query and action this host serves, with its input schema. */
import { restHandler } from './deployment'

export const runtime = 'nodejs'

export async function GET(): Promise<Response> {
  return Response.json({ tools: restHandler().catalogue() })
}
