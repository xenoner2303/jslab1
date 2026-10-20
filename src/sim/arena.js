function wrap(ship, width, height) {
  if (ship.pos.x < 0) ship.pos.x += width;
  if (ship.pos.x > width) ship.pos.x -= width;
  if (ship.pos.y < 0) ship.pos.y += height;
  if (ship.pos.y > height) ship.pos.y -= height;
}

function bounce(something, width, height) {
  if (something.pos.x - something.radius < 0) {
    something.vel.x = Math.abs(something.vel.x);
    something.pos.x = something.radius;
  }

  if (something.pos.x + something.radius > width) {
    something.vel.x = -Math.abs(something.vel.x);
    something.pos.x = width - something.radius;
  }

  if (something.pos.y - something.radius < 0) {
    something.vel.y = Math.abs(something.vel.y);
    something.pos.y = something.radius;
  }

  if (something.pos.y + something.radius > height) {
    something.vel.y = -Math.abs(something.vel.y);
    something.pos.y = height - something.radius;
  }
}

export { wrap, bounce };
