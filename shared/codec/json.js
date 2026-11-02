export function encodeJsonMessage(message) {
  return JSON.stringify(message);
}

export function decodeJsonMessage(data) {
  return JSON.parse(
    typeof data === "string" ? data : data.toString("utf8")
  );
}
