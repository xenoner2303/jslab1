function interpolateAngle(from, to, alpha) {
  const difference = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + difference * alpha;
}

export function getInterpolatedEntities(
  snapshots,
  targetTime,
  localPlayerId
) {
  if (snapshots.length === 0) return [];

  let beforeIndex = -1;
  for (let i = 0; i < snapshots.length; i += 1) {
    if (snapshots[i].receivedAt <= targetTime) beforeIndex = i;
    else break;
  }

  if (beforeIndex === -1) {
    return snapshots[0].entities;
  }

  const before = snapshots[beforeIndex];
  const after = snapshots[beforeIndex + 1];
  if (!after) return before.entities;
  const latestEntities = snapshots[snapshots.length - 1].entities;
  const latestById = new Map(latestEntities.map((entity) => [entity.id, entity]));

  const alpha = Math.min(
    1,
    (targetTime - before.receivedAt) / (after.receivedAt - before.receivedAt)
  );
  const afterEntities = new Map(after.entities.map((entity) => [entity.id, entity]));

  const interpolatedEntities = before.entities.flatMap((entity) => {
    if (entity.kind === 'mainShip' && entity.playerId === localPlayerId) {
      const latest = latestById.get(entity.id);
      return latest ? [latest] : [];
    }

    const next = afterEntities.get(entity.id);
    if (!next) return [entity];

    const interpolated = {
      ...entity,
      x: entity.x + (next.x - entity.x) * alpha,
      y: entity.y + (next.y - entity.y) * alpha,
    };

    if (Number.isFinite(entity.angle) && Number.isFinite(next.angle)) {
      interpolated.angle = interpolateAngle(entity.angle, next.angle, alpha);
    }
    if (entity.pos && next.pos) {
      interpolated.pos = { x: interpolated.x, y: interpolated.y };
    }

    return [interpolated];
  });

  return interpolatedEntities;
}
