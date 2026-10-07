import { BliBlie } from "./bliblie.js";
import {Entity} from "./entity.js"
import { Vector2 } from "./vector.js";
import {blibliesCount, maxBliblieSpeed, bliblieHeight, bliblieWidth, miniRocketSpeed, damageFromObjects, damageFromMiniRocket, miniRocketHeight, miniRocketWidth} from "../../config/settings.js"
import { bounce } from "./arena.js";
import { MiniRocket } from "./miniRocket.js";
import {entitiesCollision, checkSpot} from "./collision.js";
import { Explosion } from "./explosion.js";

class World {
    #entities = new Map(); // entities storage/ key - id

    constructor(width, height) {
        if(!Number.isFinite(width) || !Number.isFinite(height)){
            throw new Error("Trying to create world entity with no num edges");
        }

        this.width = width;
        this.height = height;
    }

    spawn(e) {
        if (!(e instanceof Entity)) {
            throw new Error("Trying add noEntity to entities");
        }

        this.#entities.set(e.id, e);
    }

    despawn(id){
        let entity = this.#entities.get(id);

        if(entity != null){
            entity.alive = false;
        }
    }

    get(id) {
        return this.#entities.get(id);
    }

    [Symbol.iterator]() { // availble us use for entity of world
        return this.#entities.values();
    }

    *ofKind(kind) {
        for (const entity of this.#entities.values()) { // values() to dont get pairs [id, value], but only values
            if (entity.kind === kind) {
                yield entity; // return current entity
            }
        }
    }

    step(dt, inputs) {
        let count = 0;

        for (const entity of this.ofKind("bliblie")) {
            count++;
        }

        if (count < blibliesCount) { // if bliblie < 5 we spawn new
            const difference = blibliesCount - count;

            for(let i = 0; i < difference; i++){
                const newPosition = new Vector2(Math.random() * this.width, Math.random() * this.height);
                
                const speedXDirection = Math.random() < 0.5 ? 1 : -1;
                const speedYDirection = Math.random() < 0.5 ? 1 : -1;

                const newVelocity = new Vector2(
                    Math.random() * maxBliblieSpeed * speedXDirection,
                    Math.random() * maxBliblieSpeed * speedYDirection);
                
                const bliblieRadius = Math.sqrt(bliblieWidth ** 2 + bliblieHeight ** 2) / 2; // rectangle diag formula

                const newBliBlie = new BliBlie(newPosition, newVelocity, bliblieRadius, 0, "bliblie");
                this.spawn(newBliBlie);
            }
        }
        
        for (const entity of this.ofKind("mainShip")) {
            if (entity.fireRequested) 
            {
                entity.fireRequested = false;
                
                const direction = Vector2.fromAngle(entity.angle); // for direction
                const rocketRadius = Math.sqrt(miniRocketWidth ** 2 + miniRocketHeight ** 2) / 2; // rectangle diag formula
                const spawnDistance = entity.radius + rocketRadius + 2; // ro avoid collisison riocket iisue
                const shipNose = entity.pos.add(direction.scale(spawnDistance)); // receive new Vector2
                const rocketVelocity = direction.scale(miniRocketSpeed);

                const miniRocket = new MiniRocket(shipNose, rocketVelocity, rocketRadius, entity.angle, "miniRocket", entity);
                this.spawn(miniRocket);
            }
        }

        for (const entity of this) {
            entity.update(dt);

            if(entity.kind == "bliblie"){
                bounce(entity, this.width, this.height);
            }
        }

        const collisions = entitiesCollision([...this]);

        for (const [a, b] of collisions) {
            if (!a.alive || !b.alive) continue;

            if ((a.kind == "bliblie" && b.kind == "bliblie") ||
                (a.kind == "mainShip" && b.kind == "mainShip"))
            {
                a.vel = new Vector2(-a.vel.x, -a.vel.y);
                b.vel = new Vector2(-b.vel.x, -b.vel.y);
            }

            if ((a.kind == "miniRocket" && b.kind == "bliblie") ||
                (a.kind == "bliblie" && b.kind == "miniRocket"))
            {
                const rocket = a.kind == "miniRocket" ? a : b;
                const bliblie = a.kind == "bliblie" ? a : b;

                rocket.alive = false;
                bliblie.alive = false;
                bliblie.owner.score += 1;
            }

            if ((a.kind == "mainShip" && b.kind == "bliblie") ||
                (a.kind == "bliblie" && b.kind == "mainShip")) 
            {
                const ship = a.kind == "mainShip" ? a : b;
                const bliblie = a.kind == "bliblie" ? a : b;

                if (ship.hit(damageFromObjects)) {
                    this.spawn(new Explosion(ship.pos));
                }

                bliblie.vel = new Vector2(-bliblie.vel.x, -bliblie.vel.y);
                ship.vel = new Vector2(-ship.vel.x, -ship.vel.y);
            }

            if ((a.kind == "mainShip" && b.kind == "miniRocket") ||
                (a.kind == "miniRocket" && b.kind == "mainShip")) 
            {
                const ship = a.kind =="mainShip" ? a : b;
                const rocket = a.kind == "miniRocket" ? a : b;

                if (ship.hit(damageFromMiniRocket)) {
                    this.spawn(new Explosion(ship.pos));
                }

                rocket.alive = false;
            }
        }

        for (const entity of this) {
            if (!entity.alive) {
                if (entity.kind == "mainShip") { // ship respawns
                    if (entity.updateRespawn(dt)) {
                        let potentialSpot = new Vector2(Math.random() * this.width, Math.random() * this.height);

                        const aliveEntities = [...this].filter(e => e.alive); // onlie alive entities

                        while (!checkSpot(potentialSpot, entity.radius, aliveEntities)) {
                            potentialSpot = new Vector2(Math.random() * this.width, Math.random() * this.height);
                        }

                        entity.pos = potentialSpot;
                    }
                } 
                else {
                    this.#entities.delete(entity.id);
                }
            }
        }
    }
}

export { World };
