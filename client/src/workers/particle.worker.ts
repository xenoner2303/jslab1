type ParticleInput = { pos: { x: number; y: number }; radius: number };
type ExplosionInput = { id: number; particles: ParticleInput[] };
type WorkerRequest = { explosions: ExplosionInput[] };
type WorkerResult = { id: number; buffer: ArrayBuffer };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
};

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const results: WorkerResult[] = event.data.explosions.map((explosion) => {
    const values = new Float32Array(explosion.particles.length * 3);
    explosion.particles.forEach((particle, index) => {
      const offset = index * 3;
      values[offset] = particle.pos.x;
      values[offset + 1] = particle.pos.y;
      values[offset + 2] = particle.radius;
    });
    return { id: explosion.id, buffer: values.buffer };
  });

  workerScope.postMessage(
    { results },
    results.map((result) => result.buffer)
  );
};
