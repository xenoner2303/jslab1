export function encodeJsonMessage(message: unknown): string {
  return JSON.stringify(message);
}

export function decodeJsonMessage(data: string | ArrayBufferView): unknown {
  const text =
    typeof data === "string"
      ? data
      : new TextDecoder().decode(
          new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
        );
  return JSON.parse(text);
}
