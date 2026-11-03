import { on } from "node:events";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform, type TransformCallback } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Room, RoomLogEvent } from "../rooms.ts";

class NdjsonTransform extends Transform {
  constructor() {
    super({ writableObjectMode: true });
  }

  _transform(
    event: RoomLogEvent,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    try {
      callback(null, `${JSON.stringify(event)}\n`);
    } catch (error: unknown) {
      callback(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

export class MatchLog {
  readonly id: string;
  readonly filePath: string;
  #room: Room;
  #directory: string;
  #writePromise: Promise<void>;

  constructor(room: Room, directory: string) {
    this.#room = room;
    this.#directory = directory;
    this.id = `${room.id}-${Date.now()}`;
    this.filePath = path.join(directory, `${this.id}.ndjson`);

    this.#writePromise = this.#write();
    this.#writePromise.catch((error: unknown) => {
      console.error(`Match log '${this.id}' failed:`, error);
    });
  }

  async #write(): Promise<void> {
    const events = on(this.#room, "event", { close: ["close"] });
    await mkdir(this.#directory, { recursive: true });
    await pipeline(
      Readable.from(
        (async function* (): AsyncGenerator<RoomLogEvent> {
          for await (const [event] of events) {
            yield event;
          }
        })(),
      ),
      new NdjsonTransform(),
      createWriteStream(this.filePath, { flags: "wx" }),
    );
    console.log(`Match log saved: ${this.filePath}`);
  }

  async flush(): Promise<void> {
    await this.#writePromise;
  }
}
