import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

export async function* readReplay(filePath) {
  const input = createReadStream(filePath);
  const lines = createInterface({ input, crlfDelay: Infinity });

  try {
    for await (const line of lines) {
      if (line.length > 0) {
        yield JSON.parse(line);
      }
    }
  } finally {
    lines.close();
    input.destroy();
  }
}
