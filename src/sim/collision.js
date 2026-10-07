import {Vector2} from "./vector.js"

function circleCheck(a, b) { // a nd b - entities
    const vectorBetween = a.pos.sub(b.pos);

    return vectorBetween.length() <= a.radius + b.radius;
}

function entitiesCollision(entities) {
    if (entities.length <= 1) return [];

    const collisions = [];

    for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) { // to avoid dubles
            const a = entities[i];
            const b = entities[j];

            if (circleCheck(a, b)) {
                collisions.push([a, b]);
            }
        }
    }

    return collisions;
}

export { circleCheck, entitiesCollision };
