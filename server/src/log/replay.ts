import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

export async function* readReplay(
  filePath: string,
): AsyncGenerator<unknown, void, void> {
  const input = createReadStream(filePath);
  const lines = createInterface({ input, crlfDelay: Infinity });

  try {
    for await (const line of lines) {
      if (line.length > 0) {
        const record: unknown = JSON.parse(line);
        yield record;
      }
    }
  } finally {
    lines.close();
    input.destroy();
  }
}
