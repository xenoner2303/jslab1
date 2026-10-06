function wrap(ship, width, height) {
  if (ship.pos.x < 0) ship.pos.x += width;
  if (ship.pos.x > width) ship.pos.x -= width;
  if (ship.pos.y < 0) ship.pos.y += height;
  if (ship.pos.y > height) ship.pos.y -= height;
}

export { wrap };
