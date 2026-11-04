export const HEARTBEAT_INTERVAL_MS = 15_000;

export type HeartbeatClient = {
  readyState: number;
  missedPongs: number;
  terminate(): void;
  ping(): void;
};

export function tickHeartbeat(
  clients: Iterable<HeartbeatClient>,
  openState: number,
  maxMissedPongs = 2,
): void {
  for (const client of clients) {
    if (client.readyState !== openState) {
      continue;
    }
    if (client.missedPongs >= maxMissedPongs) {
      client.terminate();
      continue;
    }
    client.missedPongs += 1;
    client.ping();
  }
}

export function startHeartbeat(
  clients: Iterable<HeartbeatClient>,
  openState: number,
): ReturnType<typeof setInterval> {
  return setInterval(() => {
    tickHeartbeat(clients, openState);
  }, HEARTBEAT_INTERVAL_MS);
}
