import { Vector2 } from "./vector.js";

export {Vector2} from "./vector.js"

function applyHoming(entity, target, worldEntities, edges, dt){
    let linecount = 3; // left center right
    let rayMaxCheck = 150;

    let direction = target.pos.sub(entity.pos);
    direction = direction.normalize();

    for(let i = 0; i < linecount; i++){
        const side = new Vector2(-direction.y, direction.x); // perpendicular to direction
        const offset = (i - 1) * entity.radius;
        let startPos = entity.pos.add(side.scale(offset));
            
        for(const current of worldEntities){
            if(current.id == entity.id || current.id == target.id){
                continue;
            }

            let rayCurrentCheck = 0;

            while (rayCurrentCheck < rayMaxCheck) { // check for obstacle
                if(circleDotCheck(current, startPos, entity.radius)){
                    if (i === 0) {
                        direction = direction.add(side.scale(0.2)); // change direction
                    }

                    if (i === 2) {
                        direction = direction.sub(side.scale(0.2)); // change direction
                    }

                    break;
                }
                else{
                    startPos = startPos.add(direction);
                }

                rayCurrentCheck += 1;
            }
        }
    }
    
    function circleDotCheck(a, dot, radius) {
        const vectorBetween = a.pos.sub(dot);

        return vectorBetween.length() <= a.radius + radius;
    }
}

export { applyHoming };
