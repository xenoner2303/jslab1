import { describe, expect, it } from 'vitest';
import { EntitySnapshotSchema } from '../../shared/protocol.ts';
import { createInputMessage } from '../../shared/protocol/messages.ts';
import { Vector2 } from '../../shared/sim/vector.ts';
import { integrateShip } from '../../shared/sim/integrate.ts';
import { wrap } from '../../shared/sim/arena.ts';
import { z } from 'zod';
import {
  arenaHeight,
  arenaWidth,
  step,
} from '../../shared/config/settings.ts';
import { reconcilePredictedShip } from '../src/reconciliation.ts';

type MainShipSnapshot = Extract<z.infer<typeof EntitySnapshotSchema>, { kind: 'mainShip' }>;

const ship = EntitySnapshotSchema.parse({
  id: 1,
  kind: 'mainShip',
  pos: new Vector2(100, 200),
  vel: new Vector2(0, 0),
  x: 100,
  y: 200,
  angle: 0,
  radius: 10,
  alive: true,
  playerId: 'player-1',
  playerName: 'Pilot',
  thrust: 0,
  score: 0,
  hasShield: false,
}) as MainShipSnapshot;

describe('reconcilePredictedShip', () => {
  it('replays only unacknowledged inputs onto the snapshot', () => {
    const acknowledged = createInputMessage({
      seq: 1,
      tick: 1,
      thrust: 1,
      turn: 0,
      fire: false,
    });
    const pending = createInputMessage({
      seq: 2,
      tick: 2,
      thrust: 1,
      turn: 0,
      fire: false,
    });
    const expected = integrateShip(
      {
        pos: new Vector2(ship.pos.x, ship.pos.y),
        vel: new Vector2(ship.vel.x, ship.vel.y),
        angle: ship.angle,
        thrust: ship.thrust,
      },
      pending,
      step
    );
    wrap(expected, arenaWidth, arenaHeight);

    const result = reconcilePredictedShip(
      ship,
      new Map([
        [1, acknowledged],
        [2, pending],
      ]),
      1
    );

    expect([...result.pendingInputs.keys()]).toEqual([2]);
    expect(result.predictedShip.pos).toEqual(expected.pos);
    expect(result.predictedShip.vel).toEqual(expected.vel);
  });

  it('returns the snapshot ship when every input was acknowledged', () => {
    const result = reconcilePredictedShip(
      ship,
      new Map([
        [
          1,
          createInputMessage({
            seq: 1,
            tick: 1,
            thrust: 1,
            turn: 0,
            fire: false,
          }),
        ],
      ]),
      1
    );

    expect(result.pendingInputs.size).toBe(0);
    expect(result.predictedShip.pos).toEqual(new Vector2(100, 200));
    expect(result.predictedShip.vel).toEqual(new Vector2(0, 0));
  });
});
