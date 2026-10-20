import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultProject } from '../src/data/workshop.js';
import { completeListeningRack } from '../src/data/equipmentProfiles.js';
import { tvConsoleProject } from '../src/data/workshopTv.js';
import { roomSceneLayout, sceneWalkRoom, ROOM_EQUIPMENT_IDS, BACKABRO_SOFA } from '../src/data/roomSceneLayout.js';
import { ROOM_PORTS } from '../src/data/roomEquipment.js';
import { cablePaths, roomPreset } from '../src/data/roomWiring.js';
import { isWalkPositionClear, moveInRoom } from '../src/data/roomNavigation.js';

const rack=completeListeningRack(defaultProject()), tv=tvConsoleProject(rack);
test('all eight detailed devices and their ports translate with both editable rack variants',()=>{
  for(const project of [rack,tv]) {
    const layout=roomSceneLayout(project);
    for(const [id,equipmentId] of Object.entries(ROOM_EQUIPMENT_IDS)){
      assert.equal(layout.devices[id].present,true);
      const e=project.equipment.find(e=>e.id===equipmentId),s=project.shelves.find(s=>s.id===e.shelfId);
      assert.ok(Math.abs(layout.devices[id].center[0]-(s.x+e.x)/1000)<1e-8);
      for(const p of ROOM_PORTS.filter(p=>p.device===id)) assert.deepEqual(layout.portMap[p.id].position,p.position.map((n,i)=>n+layout.shifts[id][i]));
    }
    const moved=structuredClone(project);moved.shelves[0].y+=50;
    const next=roomSceneLayout(moved);
    const id=Object.keys(ROOM_EQUIPMENT_IDS).find(id=>moved.equipment.some(e=>e.id===ROOM_EQUIPMENT_IDS[id]&&e.shelfId===moved.shelves[0].id));
    assert.ok(Math.abs(next.devices[id].center[2]-layout.devices[id].center[2]-.05)<1e-8);
  }
});
test('every current or loose cable stays above the floor and outside editable shelves in both rooms',()=>{
  for(const project of [rack,tv])for(const name of ['a90','bifrost','warmer'])for(const original of roomPreset(name)){
    const layout=roomSceneLayout(project);
    for(const c of [original,{...original,from:null},{...original,to:null}])for(const path of cablePaths(c,layout))for(const [x,y,z] of path.points){
      const r=path.radius, label=project.name+' '+name+' '+c.id+' '+[x,y,z];
      assert.ok(Number.isFinite(x+y+z),label);
      assert.ok(z-r>=.004-1e-8,'floor '+label);
      assert.ok(!project.shelves.some(s=>Math.abs(x-s.x/1000)<s.width/2000+r&&Math.abs(y+s.z/1000)<s.depth/2000+r&&z>s.y/1000-r&&z<(s.y+s.thickness)/1000+r),'shelf '+label);
    }
  }
});
test('the 6 by 3.3 room leaves a continuous walking route around the system and the owner-size sofa',()=>{
  assert.equal(BACKABRO_SOFA.widthMm,2100);assert.equal(BACKABRO_SOFA.depthMm,1080);
  for(const project of [rack,tv]){
    const room=sceneWalkRoom(roomSceneLayout(project));
    assert.equal(room.maxX-room.minX,6);assert.ok(Math.abs(room.maxZ-room.minZ-3.3)<1e-9);
    for(const p of [room.start,room.behind])assert.ok(isWalkPositionClear(p.x,p.z,room));
    let p={...room.start};
    // Walk around the left speaker / REL / lamp bank via its outer edge.
    for(const target of [{x:-2.65,z:.72},{x:-2.65,z:-.84},room.behind])p=moveInRoom(p,target.x-p.x,target.z-p.z,room);
    assert.ok(Math.hypot(p.x-room.behind.x,p.z-room.behind.z)<.01,project.name);
    const blocked=moveInRoom(room.start,0,2,room);
    assert.ok(blocked.z<1.08,'sofa blocks forward collision');
  }
});
test('the production model contains independently movable device meshes and the new sofa',()=>{
  const bytes=readFileSync(new URL('../public/models/listening-room-modular.glb',import.meta.url));
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  const names=json.nodes.map(n=>n.name||'');
  for(const id of [...Object.keys(ROOM_EQUIPMENT_IDS),'ae0','ae1','rel0','rel1','pdu','side0','side1'])assert.ok(names.some(n=>n.startsWith('Device_'+id+'__')),id);
  assert.ok(names.some(n=>n.startsWith('Sofa_')));
  assert.ok(!names.some(n=>n.startsWith('Shelf ')||n.startsWith('Graphite rack')));
});
