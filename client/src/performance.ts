let measurementId = 0;

export function measure<T>(name: string, callback: () => T): T {
  const id = measurementId++;
  const startMark = `${name}:start:${id}`;
  const endMark = `${name}:end:${id}`;

  performance.mark(startMark);

  try {
    return callback();
  } finally {
    performance.mark(endMark);
    performance.measure(name, startMark, endMark);

    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
  }
}

export async function measureAsync<T>(
  name: string,
  callback: () => Promise<T>
): Promise<T> {
  const id = measurementId++;
  const startMark = `${name}:start:${id}`;
  const endMark = `${name}:end:${id}`;

  performance.mark(startMark);

  try {
    return await callback();
  } finally {
    performance.mark(endMark);
    performance.measure(name, startMark, endMark);

    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
  }
}
