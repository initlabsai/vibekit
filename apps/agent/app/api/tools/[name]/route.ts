/**
 * `POST /api/tools/<tool>` with the tool's arguments as the JSON body. Queries
 * return their result; actions return a draft (an unsigned group) and never
 * sign. One turn per call — free by IP, then a bought pack, else 402.
 */
import { chargeTurn, restHandler } from '../deployment'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request, { params }: { params: Promise<{ name: string }> }): Promise<Response> {
  const refused = await chargeTurn(request)
  if (refused) return refused
  return restHandler().call((await params).name, request)
}
