import { performance } from "node:perf_hooks";
import { WebSocket, type RawData } from "ws";

const baseUrl =
  process.env.LOAD_TEST_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const clientCounts = (process.env.LOAD_TEST_COUNTS ?? "8,32,64,128")
  .split(",")
  .map(Number)
  .filter((value) => Number.isInteger(value) && value > 0);
const durationMs = Number(process.env.LOAD_TEST_DURATION_MS ?? 30_000);
const rampDelayMs = Number(process.env.LOAD_TEST_RAMP_DELAY_MS ?? 10);

type Client = { socket: WebSocket; seq: number; interval: NodeJS.Timeout };
type ServerStats = {
  rooms: {
    roomId: string;
    lastTickDurationMs: number;
    lastTickJitterMs: number;
  }[];
  rssBytes: number;
  eventLoopUtilization: number;
};

function decodeWebSocketData(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  return data.toString("utf8");
}

function getWebSocketDataLength(data: RawData): number {
  if (Array.isArray(data)) {
    return data.reduce((length, part) => length + part.byteLength, 0);
  }
  return data.byteLength;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function createRoom(name: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, maxPlayers: 8 }),
  });
  if (!response.ok)
    throw new Error(
      `Room creation failed: ${response.status} ${await response.text()}`,
    );
  const result = (await response.json()) as { roomId: string };
  return result.roomId;
}

async function connectClient(roomId: string, index: number): Promise<Client> {
  const socket = new WebSocket(baseUrl.replace(/^http/, "ws"));
  await new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  socket.send(
    JSON.stringify({ type: "join", room: roomId, name: `Load-${index}` }),
  );
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Join timeout")), 5000);
    socket.on("message", (data) => {
      try {
        const message: unknown = JSON.parse(decodeWebSocketData(data));
        if (
          typeof message === "object" &&
          message !== null &&
          "type" in message &&
          message.type === "joined"
        ) {
          clearTimeout(timeout);
          resolve();
        }
      } catch {
        // Ignore non-JSON messages; protocol errors will close the socket.
      }
    });
    socket.once("close", () => {
      clearTimeout(timeout);
      reject(new Error(`Client ${index} disconnected before joining`));
    });
  });

  let seq = 0;
  const interval = setInterval(() => {
    seq = (seq + 1) >>> 0;
    socket.send(
      JSON.stringify({
        type: "input",
        seq,
        tick: seq,
        thrust: index % 2 === 0 ? 1 : 0,
        turn: index % 3 === 0 ? 1 : 0,
        fire: seq % 15 === 0,
      }),
    );
  }, 1000 / 30);
  return { socket, seq, interval };
}

async function readStats(): Promise<ServerStats> {
  const response = await fetch(`${baseUrl}/api/stats`);
  if (!response.ok) throw new Error(`Stats request failed: ${response.status}`);
  return (await response.json()) as ServerStats;
}

async function runScenario(clientCount: number): Promise<void> {
  console.log(
    `\nStarting load scenario: ${clientCount} clients for ${durationMs / 1000}s`,
  );
  const rooms: string[] = [];
  for (let index = 0; index < Math.ceil(clientCount / 8); index++) {
    rooms.push(await createRoom(`Load test ${clientCount} - ${index + 1}`));
  }

  const clients: Client[] = [];
  let connected = 0;
  let receivedBytes = 0;
  const startAt = performance.now();
  try {
    for (let index = 0; index < clientCount; index++) {
      const roomId = rooms[Math.floor(index / 8)];
      if (!roomId) continue;
      const client = await connectClient(roomId, index + 1);
      client.socket.on("message", (data) => {
        receivedBytes += getWebSocketDataLength(data);
      });
      clients.push(client);
      connected++;
      if (rampDelayMs > 0) await sleep(rampDelayMs);
    }

    const samples: number[] = [];
    let previousReceivedBytes = receivedBytes;
    let bytesPerSecond = 0;
    const sampleTimer = setInterval(() => {
      void sampleStats();
    }, 1000);

    async function sampleStats(): Promise<void> {
      try {
        const stats = await readStats();
        for (const room of stats.rooms) {
          if (rooms.includes(room.roomId))
            samples.push(room.lastTickDurationMs);
        }
        bytesPerSecond =
          ((receivedBytes - previousReceivedBytes) * 1000) / 1000;
        previousReceivedBytes = receivedBytes;
      } catch (error) {
        console.error("Could not sample server stats:", error);
      }
    }

    await sleep(durationMs);
    clearInterval(sampleTimer);
    const finalStats = await readStats();
    samples.sort((a, b) => a - b);
    const percentile = (p: number) =>
      samples.length
        ? (samples[
            Math.min(samples.length - 1, Math.ceil(samples.length * p) - 1)
          ] ?? 0)
        : 0;
    const totalDurationSeconds = (performance.now() - startAt) / 1000;
    console.log(
      JSON.stringify(
        {
          clients: clientCount,
          connected,
          durationSeconds: Number(totalDurationSeconds.toFixed(1)),
          tickTimeP99Ms: Number(percentile(0.99).toFixed(3)),
          tickTimeMaxMs: Number((samples.at(-1) ?? 0).toFixed(3)),
          eventLoopUtilization: Number(
            finalStats.eventLoopUtilization.toFixed(4),
          ),
          rssMB: Number((finalStats.rssBytes / 1024 / 1024).toFixed(2)),
          receivedBytesPerSecond: Math.round(bytesPerSecond),
          exceeds33msBudget: percentile(0.99) > 33,
        },
        null,
        2,
      ),
    );
  } finally {
    for (const client of clients) {
      clearInterval(client.interval);
      client.socket.close();
    }
  }
}

for (const count of clientCounts) {
  await runScenario(count);
  await sleep(3000);
}
