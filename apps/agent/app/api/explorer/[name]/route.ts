/**
 * The browser's reads: `POST /api/explorer/<tool>` runs any tool on the same
 * deployment the public query route serves, but house-billed — a card's
 * lookup costs the reader nothing. The body's `network` picks the network.
 */
import { restHandler } from '../../tools/deployment'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function POST(request: Request, { params }: { params: Promise<{ name: string }> }): Promise<Response> {
  return restHandler().call((await params).name, request)
}
