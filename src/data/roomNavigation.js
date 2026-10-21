// Same metre coordinates as polish_listening_room.py, converted from Blender Z-up:
// web x = Blender x; web z = -Blender y. Conservative furniture footprints.
export const WALK_ROOM = {
  minX: -2.7, maxX: 2.7, minZ: -1.09, maxZ: 4.9,
  radius: .20, eyeHeight: 1.63, speed: 1.25,
  start: { x: 0, z: 2.5 },
  behind: { x: 0, z: -.76 },
  obstacles: [
    { name: 'Стойка', minX: -.40, maxX: .40, minZ: -.25, maxZ: .25 },
    { name: 'Brennenstuhl', minX: .43, maxX: .53, minZ: -.568, maxZ: .068 },
    ...[-1.1, 1.1].map(x => ({ name: 'AE320', minX: x-.10, maxX: x+.10, minZ: -.18, maxZ: .18 })),
    ...[-1.6, 1.6].map(x => ({ name: 'REL Quake', minX: x-.127, maxX: x+.127, minZ: -.225, maxZ: .065 })),
    ...[-1.86, 1.86].map(x => ({ name: 'Торшер и фильтр', minX: x-.13, maxX: x+.13, minZ: -.43, maxZ: .18 })),
    { name: 'Gliver ДеФранс', minX: -.45, maxX: .45, minZ: 3.25, maxZ: 4.33 },
  ],
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export function isWalkPositionClear(x, z, room = WALK_ROOM) {
  const r = room.radius;
  if (!Number.isFinite(x) || !Number.isFinite(z) || x < room.minX+r || x > room.maxX-r || z < room.minZ+r || z > room.maxZ-r) return false;
  return room.obstacles.every(o => Math.hypot(x-clamp(x,o.minX,o.maxX), z-clamp(z,o.minZ,o.maxZ)) >= r);
}
export function nearestWalkPosition(preferred, room = WALK_ROOM) {
  if (isWalkPositionClear(preferred.x, preferred.z, room)) return { ...preferred };
  let best = null, distance = Infinity;
  // Find a safe fallback after an editable shelf, chassis or TV changes size.
  for(let x=room.minX+room.radius+.01;x<=room.maxX-room.radius;x+=.05)
    for(let z=room.minZ+room.radius+.01;z<=room.maxZ-room.radius;z+=.05) {
      const d=(x-preferred.x)**2+(z-preferred.z)**2;
      if(d<distance&&isWalkPositionClear(x,z,room)){best={x,z};distance=d;}
    }
  return best;
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
