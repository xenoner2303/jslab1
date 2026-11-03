даваimport { on } from "node:events";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

class NdjsonTransform extends Transform {
  constructor() {
    super({ writableObjectMode: true });
  }

  _transform(event, encoding, callback) {
    try {
      callback(null, `${JSON.stringify(event)}\n`);
    } catch (error) {
      callback(error);
    }
  }
}

export class MatchLog {
  #room;
  #directory;
  #writePromise;

  constructor(room, directory) {
    this.#room = room;
    this.#directory = directory;
    this.id = `${room.id}-${Date.now()}`;
    this.filePath = path.join(directory, `${this.id}.ndjson`);

    this.#writePromise = this.#write();
    this.#writePromise.catch((error) => {
      console.error(`Match log '${this.id}' failed:`, error);
    });
  }

  async #write() {
    const events = on(this.#room, "event");
    await mkdir(this.#directory, { recursive: true });
    await pipeline(
      Readable.from(
        (async function* () {
          for await (const [event] of events) {
            yield event;
          }
        })()
      ),
      new NdjsonTransform(),
      createWriteStream(this.filePath, { flags: "wx" })
    );
    console.log(`Match log saved: ${this.filePath}`);
  }

  async flush() {
    await this.#writePromise;
  }
}
