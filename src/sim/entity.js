import { Vector2 } from "./vector.js";

class Entity{
    static #id = 0; // last available id
    
    constructor (pos, vel, radius, alive, angle, kind){
        if (!(pos instanceof Vector2) || !(vel instanceof Vector2)){
            throw new Error("pos or vel is not Vector2");
        }

        if (!Number.isFinite(radius)){
            throw new Error("Trying ti crate entity with no num radius");
        }

        if (!Number.isFinite(angle)){
            throw new Error("Trying ti crate entity with no num angle");
        }

        if (typeof alive != "boolean"){
            throw new Error("alive is not bool");
        }

        this.id = Entity.#id; // create a local id inner object
        Entity.#id += 1;

        this.pos = pos;
        this.vel = vel;
        this.radius = radius;
        this.alive = alive;
        this.kind = kind;
        this.angle = angle;
    }

    update(dt){}
}

export { Entity };
