function wrap(ship, width, height) {
  if (ship.pos.x < 0) ship.pos.x += width;
  if (ship.pos.x > width) ship.pos.x -= width;
  if (ship.pos.y < 0) ship.pos.y += height;
  if (ship.pos.y > height) ship.pos.y -= height;
}

function bounce(something, width, height) {
  if (something.pos.x < 0 || something.pos.x > width) something.vel.x = -something.vel.x;
  if (something.pos.y < 0 || something.pos.y > height) something.vel.y = -something.vel.y;

  if (something.pos.x < 0) something.pos.x = 0;
  if (something.pos.x > width) something.pos.x = width;
  if (something.pos.y < 0) something.pos.y = 0;
  if (something.pos.y > height) something.pos.y = height;
}

export { wrap, bounce };
