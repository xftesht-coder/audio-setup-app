// Same metre coordinates as polish_listening_room.py, converted from Blender Z-up:
// web x = Blender x; web z = -Blender y. Conservative furniture footprints.
export const WALK_ROOM = {
  minX: -2.7, maxX: 2.7, minZ: -1.09, maxZ: 4.9,
  radius: .20, eyeHeight: 1.63, speed: 1.25,
  start: { x: 0, z: 2.5 },
  obstacles: [
    { name: 'Стойка и кабельная зона', minX: -.41, maxX: .60, minZ: -.66, maxZ: .25 },
    ...[-1.1, 1.1].map(x => ({ name: 'AE320', minX: x-.10, maxX: x+.10, minZ: -.18, maxZ: .18 })),
    ...[-1.6, 1.6].map(x => ({ name: 'REL Quake', minX: x-.127, maxX: x+.127, minZ: -.225, maxZ: .065 })),
    ...[-1.86, 1.86].map(x => ({ name: 'Торшер и фильтр', minX: x-.13, maxX: x+.13, minZ: -.43, maxZ: .18 })),
    { name: 'Диван', minX: -1.14, maxX: 1.14, minZ: 3.67, maxZ: 4.63 },
  ],
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export function isWalkPositionClear(x, z, room = WALK_ROOM) {
  const r = room.radius;
  if (!Number.isFinite(x) || !Number.isFinite(z) || x < room.minX+r || x > room.maxX-r || z < room.minZ+r || z > room.maxZ-r) return false;
  return room.obstacles.every(o => Math.hypot(x-clamp(x,o.minX,o.maxX), z-clamp(z,o.minZ,o.maxZ)) >= r);
}
export function moveInRoom(position, dx, dz, room = WALK_ROOM) {
  let { x, z } = position;
  if (![x,z,dx,dz].every(Number.isFinite)) return { ...room.start };
  // Substeps prevent crossing a narrow speaker or wall at a slow frame rate.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx,dz)/.04));
  for (let i=0; i<steps; i++) {
    if (isWalkPositionClear(x+dx/steps,z,room)) x += dx/steps;
    if (isWalkPositionClear(x,z+dz/steps,room)) z += dz/steps;
  }
  return { x, z };
}
export function walkingDelta(forward, right, yaw, seconds, speed = WALK_ROOM.speed) {
  const length = Math.hypot(forward,right);
  if (!length) return { dx:0, dz:0 };
  const distance = Math.min(.05, Math.max(0,seconds))*speed/Math.max(1,length);
  return { dx: (right*Math.cos(yaw)-forward*Math.sin(yaw))*distance, dz: (-forward*Math.cos(yaw)-right*Math.sin(yaw))*distance };
}
