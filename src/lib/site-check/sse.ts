const encoder = new TextEncoder();

/** One Server-Sent Events message: an `event:` line with the type, a `data:` line with the JSON, then the blank line that ends it. */
export function encodeEvent(name: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** An SSE comment (a keep-alive ping). Comment lines start with ":" and are ignored by clients. */
export function encodeComment(text: string): Uint8Array {
  return encoder.encode(`: ${text}\n\n`);
}
