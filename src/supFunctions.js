function getAngleDelta(previous, current) {
  let delta = current - previous;

  if (delta > Math.PI) {
    delta -= 2 * Math.PI;
  }

  if (delta < -Math.PI) {
    delta += 2 * Math.PI;
  }

  return delta;
}

export { getAngleDelta };