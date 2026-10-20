import { Entity } from "./entity.js";
import { Vector2 } from "./vector.js";

class Pickup extends Entity {
    constructor(pos, radius, effect) {
        super(pos, new Vector2(0, 0), radius, true, 0, "pickup");
        this.effect = effect; // effect of pickable entity
    }
}

export { Pickup };
