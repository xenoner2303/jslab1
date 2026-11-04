import { Vector2 } from '../../shared/sim/vector.ts';
import { integrateShip } from '../../shared/sim/integrate.ts';
import { wrap } from '../../shared/sim/arena.ts';
import {
  arenaHeight,
  arenaWidth,
  step,
} from '../../shared/config/settings.ts';
import type {
  ClientInputMessage,
  EntitySnapshot,
} from '../../shared/protocol.ts';

export type PredictedShip = Omit<
  Extract<EntitySnapshot, { kind: 'mainShip' }>,
  'pos' | 'vel'
> & {
  pos: Vector2;
  vel: Vector2;
};

export function reconcilePredictedShip(
  authoritativeShip: Extract<EntitySnapshot, { kind: 'mainShip' }>,
  pendingInputs: ReadonlyMap<number, ClientInputMessage>,
  acknowledgedSeq: number
): {
  predictedShip: PredictedShip;
  pendingInputs: Map<number, ClientInputMessage>;
} {
  const remaining = new Map<number, ClientInputMessage>();
  for (const [sequence, message] of pendingInputs) {
    if (sequence > acknowledgedSeq) remaining.set(sequence, message);
  }

  let predictedShip: PredictedShip = {
    ...authoritativeShip,
    pos: new Vector2(authoritativeShip.pos.x, authoritativeShip.pos.y),
    vel: new Vector2(authoritativeShip.vel.x, authoritativeShip.vel.y),
  };

  for (const message of remaining.values()) {
    if (!predictedShip.alive) break;
    const next = integrateShip(predictedShip, message, step);
    predictedShip = { ...predictedShip, ...next };
    wrap(predictedShip, arenaWidth, arenaHeight);
  }

  return { predictedShip, pendingInputs: remaining };
}
