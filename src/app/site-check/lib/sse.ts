/** Server-Sent Events framing, split out so the streaming reader can be tested without a network. */

export interface SseEvent {
  name: string | null;
  data: unknown;
}

/**
 * One SSE block (everything up to the blank line that ends a message) into its `event:` name and parsed `data:`
 * JSON. Returns null for a block with no data line, which is how keep-alive comments arrive.
 */
export function parseSseBlock(block: string): SseEvent | null {
  let name: string | null = null;
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event: ")) name = line.slice("event: ".length);
    else if (line.startsWith("data: ")) dataLines.push(line.slice("data: ".length));
  }
  if (dataLines.length === 0) return null;
  let data: unknown = null;
  try {
    data = JSON.parse(dataLines.join("\n"));
  } catch {
    data = null;
  }
  return { name, data };
}

/** The event's type: the JSON's own `type` field when there is one, else the SSE event name. */
export function eventType(name: string | null, data: unknown): string {
  if (data && typeof data === "object" && "type" in data && typeof (data as { type: unknown }).type === "string") {
    return (data as { type: string }).type;
  }
  return name ?? "unknown";
}
