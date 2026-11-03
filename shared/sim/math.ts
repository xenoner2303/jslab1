export function getAngleDelta(previous: number, current: number): number {
  let delta = current - previous;

  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;

  return delta;
}
