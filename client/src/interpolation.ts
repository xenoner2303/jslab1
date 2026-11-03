import type { EntitySnapshot } from '../../shared/protocol.ts';

export type SnapshotFrame = {
  readonly receivedAt: number;
  readonly entities: readonly EntitySnapshot[];
};

function interpolateAngle(from: number, to: number, alpha: number): number {
  const difference = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + difference * alpha;
}

export function getInterpolatedEntities(
  snapshots: readonly SnapshotFrame[],
  targetTime: number,
  localPlayerId: string
): EntitySnapshot[] {
  if (snapshots.length === 0) return [];

  let beforeIndex = -1;
  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    if (snapshot && snapshot.receivedAt <= targetTime) beforeIndex = i;
    else break;
  }

  const first = snapshots[0];
  if (beforeIndex === -1) return first ? [...first.entities] : [];

  const before = snapshots[beforeIndex];
  if (!before) return [];
  const after = snapshots[beforeIndex + 1];
  if (!after) return [...before.entities];
  const latest = snapshots[snapshots.length - 1];
  if (!latest) return [...before.entities];

  const latestById = new Map(
    latest.entities.map((entity) => [entity.id, entity])
  );
  const denominator = after.receivedAt - before.receivedAt;
  const alpha =
    denominator <= 0
      ? 1
      : Math.min(1, (targetTime - before.receivedAt) / denominator);
  const afterEntities = new Map(
    after.entities.map((entity) => [entity.id, entity])
  );

  return before.entities.flatMap((entity): EntitySnapshot[] => {
    if (entity.kind === 'mainShip' && entity.playerId === localPlayerId) {
      const latestEntity = latestById.get(entity.id);
      return latestEntity ? [latestEntity] : [];
    }

    const next = afterEntities.get(entity.id);
    if (!next || next.kind !== entity.kind) return [entity];

    const x = entity.x + (next.x - entity.x) * alpha;
    const y = entity.y + (next.y - entity.y) * alpha;
    const angle = interpolateAngle(entity.angle, next.angle, alpha);
    const position = { x, y };

    switch (entity.kind) {
      case 'mainShip':
        if (next.kind !== 'mainShip') return [entity];
        return [{ ...entity, x, y, angle, pos: position }];
      case 'miniRocket':
        if (next.kind !== 'miniRocket') return [entity];
        return [{ ...entity, x, y, angle, pos: position }];
      case 'bliblie':
        if (next.kind !== 'bliblie') return [entity];
        return [{ ...entity, x, y, angle, pos: position }];
      case 'pickup':
        if (next.kind !== 'pickup') return [entity];
        return [{ ...entity, x, y, angle, pos: position }];
      case 'explosion':
        if (next.kind !== 'explosion') return [entity];
        return [{ ...entity, x, y, angle, pos: position }];
      default: {
        const exhaustiveCheck: never = entity;
        return [exhaustiveCheck];
      }
    }
  });
}
