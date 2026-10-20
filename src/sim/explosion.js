import { Entity } from "./entity.js";
import { Vector2 } from "./vector.js";
import {
    explosionTtl,
    explosionParticleCount,
    explosionParticleMinSize,
    explosionParticleMaxSize,
    explosionParticleMaxSpeed
} from '../../config/settings.js';

class Explosion extends Entity {
    #ttl = explosionTtl;

    constructor(pos) {
        super(pos, new Vector2(0, 0), 0, true, 0, "explosion");

        this.particles = [];

        for (let i = 0; i < explosionParticleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * explosionParticleMaxSpeed;
            
            const radius = (Math.random() * (explosionParticleMaxSize - explosionParticleMinSize) + explosionParticleMinSize) / 2;

            const newParticle = {pos: new Vector2(0, 0), vel: Vector2.fromAngle(angle).scale(speed), radius};
            this.particles.push(newParticle);
        }
    }

    update(dt) {
        this.#ttl -= dt;

        for (const particle of this.particles) {
            particle.pos = particle.pos.add(particle.vel.scale(dt));
        }

        if (this.#ttl <= 0) {
            this.alive = false;
        }
    }
}

export { Explosion };
