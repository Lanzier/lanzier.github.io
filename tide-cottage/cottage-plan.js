export const COTTAGE = {
  halfWidth: 3.78,
  back: -2.55,
  front: 2.55,
  ceiling: 2.53,
  floorY: 1.135,
  centerZ: -1.42,
  roofEave: 3.67,
  roofRidge: 5.17,
  roofHalfWidth: 4.43,
  roofSpan: 3.17,
  chimneyX: 2.35,
  chimneyZ: -3.685,
  chimneyBaseY: 3.92,
};

export const DOORWAY = {
  centerX: -1.93,
  hingeX: -2.55,
  hingeZ: 1.312,
  leafWidth: 1.176,
  exteriorWaitZ: 3.14,
  interiorWaitZ: .46,
  passAngle: Math.PI / 2 + .018,
  openAngle: Math.PI / 2 + .115,
};

export const CAT_REST = {
  room: { x: -3.23, z: .88 },
  island: { x: 2.36, z: 3.23 },
  radius: .50,
};

export function advanceDoor(angle, requested, seconds) {
  const target = requested ? -DOORWAY.openAngle : 0;
  const travel = Math.min(Math.abs(target - angle), 3.2 * seconds);
  return angle + Math.sign(target - angle) * travel;
}
