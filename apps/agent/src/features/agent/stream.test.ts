import { describe, expect, test } from 'bun:test'

import { readEvents } from './stream.js'

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

describe('agent event stream', () => {
  test('events split on newlines across chunk boundaries', async () => {
    const events: unknown[] = []
    for await (const event of readEvents(streamOf(['{"type":"text-delta","te', 'xt":"hi"}\n{"type":"fin', 'ish"}\n']))) events.push(event)
    expect(events).toEqual([{ type: 'text-delta', text: 'hi' }, { type: 'finish' }])
  })

  test('a final line without a newline still arrives', async () => {
    const events: unknown[] = []
    for await (const event of readEvents(streamOf(['{"type":"messages","messages":[]}']))) events.push(event)
    expect(events).toEqual([{ type: 'messages', messages: [] }])
  })
})
