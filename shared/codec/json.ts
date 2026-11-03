export function encodeJsonMessage(message: unknown): string {
  return JSON.stringify(message);
}

export function decodeJsonMessage(data: string | Uint8Array): unknown {
  const text = typeof data === "string" ? data : new TextDecoder().decode(data);
  return JSON.parse(text);
}
