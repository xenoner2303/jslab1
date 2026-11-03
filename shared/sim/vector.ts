export class Vector2 {
  public readonly x: number;
  public readonly y: number;

  constructor(x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error('Trying to create an object with no num coords');
    }

    this.x = x;
    this.y = y;
  }

  add(vector: Vector2): Vector2 {
    return new Vector2(this.x + vector.x, this.y + vector.y);
  }

  sub(vector: Vector2): Vector2 {
    return new Vector2(this.x - vector.x, this.y - vector.y);
  }

  scale(number: number): Vector2 {
    if (!Number.isFinite(number)) {
      throw new Error('Trying to multiply with no int');
    }

    return new Vector2(this.x * number, this.y * number);
  }

  length(): number {
    return Math.sqrt(this.x ** 2 + this.y ** 2);
  }

  normalize(): Vector2 {
    const length = this.length();

    if (length === 0) {
      return new Vector2(0, 0);
    }

    const difference = 1 / length;

    return new Vector2(this.x * difference, this.y * difference);
  }

  rotate(angle: number): Vector2 {
    if (!Number.isFinite(angle)) {
      throw new Error('Trying to rotate with no num');
    }

    const localX = this.x * Math.cos(angle) - this.y * Math.sin(angle);
    const localY = this.x * Math.sin(angle) + this.y * Math.cos(angle);

    return new Vector2(localX, localY);
  }

  dot(vector: Vector2): number {
    return this.x * vector.x + this.y * vector.y;
  }

  static fromAngle(angle: number): Vector2 {
    if (!Number.isFinite(angle)) {
      throw new Error('Trying to get unit vector from no num angle');
    }

    return new Vector2(Math.cos(angle), Math.sin(angle));
  }
}
