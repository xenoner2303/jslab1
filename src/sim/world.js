import { BliBlie } from "./bliblie.js";
import {Entity} from "./entity.js"
import { Vector2 } from "./vector.js";
import {blibliesCount, maxBliblieSpeed, bliblieHeight, bliblieWidth} from "../../config/settings.js"
import { bounce } from "./arena.js";

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
                const newPosition = new Vector2(
                    Math.random() * this.width,
                    Math.random() * this.height);
                
                const speedXDirection = Math.random() < 0.5 ? 1 : -1;
                const speedYDirection = Math.random() < 0.5 ? 1 : -1;

                const newVelocity = new Vector2(
                    Math.random() * maxBliblieSpeed * speedXDirection,
                    Math.random() * maxBliblieSpeed * speedYDirection);
                
                const bliblieRadius = Math.sqrt(bliblieWidth ** 2 + bliblieHeight ** 2); // rectangle diag formula

                const newBliBlie = new BliBlie(newPosition, newVelocity, bliblieRadius, 0, "bliblie");
                this.spawn(newBliBlie);
            }
        }
        
        for (const entity of this) {
            entity.update(dt);

            if(entity instanceof BliBlie){
                bounce(entity, this.width, this.height);
            }
        }

        for (const entity of this) {
            if(!entity.alive){
                this.#entities.delete(entity.id);
            }
        }
    }
}

export { World };
