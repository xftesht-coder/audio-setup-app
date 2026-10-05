import test from 'node:test';
import assert from 'node:assert/strict';
import { isWalkPositionClear, moveInRoom, walkingDelta, WALK_ROOM } from '../src/data/roomNavigation.js';

test('walk starts on the rug, inside the room and outside all furniture', () => {
  assert.ok(isWalkPositionClear(WALK_ROOM.start.x,WALK_ROOM.start.z));
  for(const o of WALK_ROOM.obstacles) assert.equal(isWalkPositionClear((o.minX+o.maxX)/2,(o.minZ+o.maxZ)/2),false,o.name);
  assert.equal(isWalkPositionClear(2.6,2),false);
  assert.equal(isWalkPositionClear(0,5),false);
});
test('long movement cannot tunnel through the rack, sofa, thin speaker or perimeter', () => {
  for(const [start,dx,dz] of [
    [{x:0,z:2.5},0,-10], [{x:0,z:2.5},0,10], [{x:1.1,z:2.5},0,-10], [{x:2,z:2.5},10,0], [{x:-2,z:2.5},-10,0],
  ]) {
    const next=moveInRoom(start,dx,dz);
    assert.ok(isWalkPositionClear(next.x,next.z));
    assert.ok(Math.hypot(next.x-start.x,next.z-start.z)<3);
  }
  assert.ok(moveInRoom({x:0,z:2.5},0,-10).z>=.45-1e-9);
  assert.ok(moveInRoom({x:1.1,z:2.5},0,-10).z>=.38-1e-9);
});
test('diagonal speed matches straight movement and frame spikes are bounded', () => {
  const a=walkingDelta(1,0,0,.016), b=walkingDelta(1,1,0,.016);
  assert.ok(Math.abs(Math.hypot(a.dx,a.dz)-Math.hypot(b.dx,b.dz))<1e-10);
  assert.deepEqual(walkingDelta(0,0,0,1),{dx:0,dz:0});
  assert.ok(Math.hypot(...Object.values(walkingDelta(1,0,0,5)))<=WALK_ROOM.speed*.05);
  const rotated=walkingDelta(1,0,Math.PI/2,.016);assert.ok(rotated.dx<0);assert.ok(Math.abs(rotated.dz)<1e-10);
});
test('camera slides along obstacles and remains navigable through a long mixed route', () => {
  let pos={x:.2,z:.46};const next=moveInRoom(pos,.5,-.2);assert.ok(next.x>.5);assert.ok(isWalkPositionClear(next.x,next.z));
  pos={...WALK_ROOM.start};
  for(let i=0;i<5000;i++){
    const {dx,dz}=walkingDelta(1,i%3-1,i*.013,.05);pos=moveInRoom(pos,dx,dz);assert.ok(isWalkPositionClear(pos.x,pos.z));
  }
});
