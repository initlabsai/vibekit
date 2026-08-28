/** The agent route's NDJSON stream, one parsed event at a time. */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newline = buffer.indexOf('\n')
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (line) yield JSON.parse(line)
      newline = buffer.indexOf('\n')
    }
  }
  const rest = buffer.trim()
  if (rest) yield JSON.parse(rest)
}
