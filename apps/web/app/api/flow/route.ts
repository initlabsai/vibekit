/**
 * Provisional signerless flow route: the browser's PaymentFlowHost backend.
 * Compose-only by construction — the deployment has no signer, so nothing
 * here can sign or submit. Phase 7's hosted API replaces this route.
 */
import { structuredResultSchema } from '@initlabs/vibekit-experience'
import { createPaymentComposeHost } from '@initlabs/vibekit-experience/live'
import { z } from 'zod'

const host = createPaymentComposeHost()

const flowRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('draft'),
    params: z.object({
      sender: z.string().min(1),
      receiver: z.string().min(1),
      amountMicroAlgos: z.number().int().positive(),
      note: z.string().min(1).optional(),
    }),
  }),
  z.object({
    action: z.literal('simulate'),
    draftRecord: structuredResultSchema,
  }),
  z.object({
    action: z.literal('lookup-account'),
    address: z.string().min(1),
  }),
  z.object({
    action: z.literal('lookup-accounts'),
    addresses: z.array(z.string().min(1)).min(1),
  }),
])

export async function GET(): Promise<Response> {
  return Response.json({ network: host.network, live: await host.probe() })
}

export async function POST(request: Request): Promise<Response> {
  let parsed
  try {
    parsed = flowRequestSchema.safeParse(await request.json())
  } catch {
    return Response.json({ error: 'Malformed JSON body' }, { status: 400 })
  }
  if (!parsed.success) {
    return Response.json({ error: 'Invalid flow request' }, { status: 400 })
  }
  try {
    const record =
      parsed.data.action === 'draft'
        ? await host.draftPayment(parsed.data.params)
        : parsed.data.action === 'simulate'
          ? await host.simulateDraft(parsed.data.draftRecord)
          : parsed.data.action === 'lookup-accounts'
            ? await host.lookupAccounts(parsed.data.addresses)
            : await host.lookupAccount(parsed.data.address)
    return Response.json({ record })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 502 })
  }
}
