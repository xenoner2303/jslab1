class Vector2{
    constructor(x, y){
        if (!Number.isFinite(x) || !Number.isFinite(y)){
            throw new Error("Trying to create an object with no num coords");
        }

        this.x = x; // записую у автоматичні поля початкові дані вектора
        this.y = y;
    }

    // pure methods - they return new Vector2, but not this
    add(vector) { 
        const local = new Vector2(this.x + vector.x, this.y + vector.y);

        return local;
    }

    sub(vector) {
        const local = new Vector2(this.x - vector.x, this.y - vector.y);

        return local; // new vector - pure method
    }

    scale(number) {
        if (!Number.isFinite(number)){
            throw new Error("Trying to multiply with no int");
        }

        const local = new Vector2(this.x * number, this.y * number);

        return local; // new vector - pure method
    }

    length() {
        return Math.sqrt(this.x ** 2 + this.y ** 2);
    }

    normalize() {
        const length = this.length();

        if (length === 0) {
            return new Vector2(0, 0);
        }

        const difference = 1 / length;

        return new Vector2(this.x * difference, this.y * difference);
    }

    rotate(angle) { // rotate vector2 on angle to get new coods by formula
        if (!Number.isFinite(angle)){
            throw new Error("Trying to rotate with no num");
        }

        const localX = this.x * Math.cos(angle) - this.y * Math.sin(angle);
        const localY = this.x * Math.sin(angle) + this.y * Math.cos(angle);

        return new Vector2(localX, localY);
    }

    dot(vector) {
        const scalarMult = this.x * vector.x + this.y * vector.y;

        return scalarMult;
    }

    static fromAngle(angle) { // unit vector with length = 1 from angle
        if (!Number.isFinite(angle)){
            throw new Error("Trying to get unit vecto from no num angle");
        }

        return new Vector2(Math.cos(angle), Math.sin(angle));
    }
}

export {Vector2};
