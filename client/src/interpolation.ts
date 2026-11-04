import type { EntitySnapshot } from '../../shared/protocol.ts';

export type SnapshotFrame = {
  readonly receivedAt: number;
  readonly entities: readonly EntitySnapshot[];
};

const latestById = new Map<EntitySnapshot['id'], EntitySnapshot>();
const afterEntities = new Map<EntitySnapshot['id'], EntitySnapshot>();

function interpolateAngle(from: number, to: number, alpha: number): number {
  const difference = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + difference * alpha;
}

export function getInterpolatedEntities(
  snapshots: readonly SnapshotFrame[],
  targetTime: number,
  localPlayerId: string,
  output: EntitySnapshot[] = []
): EntitySnapshot[] {
  output.length = 0;

  if (snapshots.length === 0) return output;

  let beforeIndex = -1;
  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    if (snapshot && snapshot.receivedAt <= targetTime) {
      beforeIndex = i;
    } else {
      break;
    }
  }

  const first = snapshots[0];
  if (beforeIndex === -1) {
    if (first) {
      for (const entity of first.entities) output.push(entity);
    }
    return output;
  }

  const before = snapshots[beforeIndex];
  if (!before) return output;

  const after = snapshots[beforeIndex + 1];
  if (!after) {
    for (const entity of before.entities) output.push(entity);
    return output;
  }

  const latest = snapshots[snapshots.length - 1];
  if (!latest) {
    for (const entity of before.entities) output.push(entity);
    return output;
  }

  latestById.clear();
  for (const entity of latest.entities) {
    latestById.set(entity.id, entity);
  }

  afterEntities.clear();
  for (const entity of after.entities) {
    afterEntities.set(entity.id, entity);
  }

  const denominator = after.receivedAt - before.receivedAt;
  const alpha =
    denominator <= 0
      ? 1
      : Math.min(1, (targetTime - before.receivedAt) / denominator);

  for (const entity of before.entities) {
    if (entity.kind === 'mainShip' && entity.playerId === localPlayerId) {
      const latestEntity = latestById.get(entity.id);
      if (latestEntity) output.push(latestEntity);
      continue;
    }

    const next = afterEntities.get(entity.id);
    if (!next || next.kind !== entity.kind) {
      output.push(entity);
      continue;
    }

    const x = entity.x + (next.x - entity.x) * alpha;
    const y = entity.y + (next.y - entity.y) * alpha;
    const angle = interpolateAngle(entity.angle, next.angle, alpha);
    const position = { x, y };

    output.push({ ...entity, x, y, angle, pos: position });
  }

  return output;
}
