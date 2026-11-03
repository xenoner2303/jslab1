import { Entity } from './entity.ts';
import type { BehaviorContext } from './entity.ts';
import { Vector2 } from './vector.ts';
import {
  explosionTtl,
  explosionParticleCount,
  explosionParticleMinSize,
  explosionParticleMaxSize,
  explosionParticleMaxSpeed,
} from '../config/settings.ts';

export type Particle = {
  pos: Vector2;
  vel: Vector2;
  radius: number;
};

export class Explosion extends Entity {
  #ttl: number = explosionTtl;
  public particles: Particle[];

  constructor(pos: Vector2, random: () => number) {
    super(pos, new Vector2(0, 0), 0, true, 0, 'explosion');

    this.particles = [];

    for (let i = 0; i < explosionParticleCount; i++) {
      const angle = random() * Math.PI * 2;
      const speed = random() * explosionParticleMaxSpeed;

      const radius =
        (random() * (explosionParticleMaxSize - explosionParticleMinSize) +
          explosionParticleMinSize) /
        2;

      const newParticle: Particle = {
        pos: new Vector2(0, 0),
        vel: Vector2.fromAngle(angle).scale(speed),
        radius,
      };
      this.particles.push(newParticle);
    }
  }

  update(dt: number, context: BehaviorContext = {}): void {
    super.update(dt, context);
    this.#ttl -= dt;

    for (const particle of this.particles) {
      particle.pos = particle.pos.add(particle.vel.scale(dt));
    }

    if (this.#ttl <= 0) {
      this.alive = false;
    }
  }
}
