import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ROOM_CABLES, ROOM_PORT_MAP } from '../src/data/roomEquipment.js';
import { cablePaths, connectionCheck, restoreRoomCables, roomPreset } from '../src/data/roomWiring.js';
import { useRoomWiring } from '../src/store/roomWiringStore.js';
import { WALK_ROOM, isWalkPositionClear, moveInRoom } from '../src/data/roomNavigation.js';

useRoomWiring.persist.setOptions({storage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
test('room presets have compatible unoccupied endpoints and preserve owner speaker/high-level branches',()=>{
  for(const name of ['a90','bifrost','warmer']){
    const cables=roomPreset(name);
    for(const c of cables)assert.equal(connectionCheck(c.from,c.to,cables,c.id).ok,true,`${name} ${c.id}`);
    assert.deepEqual(cables.filter(c=>c.id.startsWith('sub')||c.id.startsWith('speaker')),DEFAULT_ROOM_CABLES.filter(c=>c.id.startsWith('sub')||c.id.startsWith('speaker')));
  }
  assert.equal(connectionCheck('freya.xlrOut','rel0.hi').ok,false);
  assert.equal(connectionCheck('wiim.opt','bifrost.coax').ok,false);
  assert.equal(connectionCheck('rusich.speaker0','ae1.in').ok,false);
  assert.equal(connectionCheck('e1.out','freya.rca3').ok,false);
  assert.equal(connectionCheck('warmer.xlrOut','a90.xlrIn',DEFAULT_ROOM_CABLES).ok,false);
  assert.equal(connectionCheck('freya.rcaOut2','rel0.low').ok,false);
  assert.equal(connectionCheck('side0.2','rel0.power').ok,false);
  assert.equal(connectionCheck('wiim.rcaOut','wiim.power').ok,false);
  assert.equal(connectionCheck('pdu.7','skoll.power').ok,true);
  assert.equal(connectionCheck('a90.rcaOut','wiim.rcaIn',[{id:'back',from:'wiim.rcaOut',to:'a90.rcaIn'}]).ok,false);
});
test('a free plug retains its type: high-level XLR and external PSU leads cannot become another cable',()=>{
  for(const [id,target] of [['sub0','ae0.in'],['power-wiim','freya.power']]){
    useRoomWiring.setState({cables:structuredClone(DEFAULT_ROOM_CABLES),past:[],future:[],selectedPort:null,selectedCable:null});
    useRoomWiring.getState().unplug(id,'to');
    useRoomWiring.getState().pickPort(target);
    assert.equal(useRoomWiring.getState().cables.find(c=>c.id===id).to,null);
    assert.match(useRoomWiring.getState().message,/другой штекер/);
  }
});
test('unplug, reselect, reconnect, undo and redo retain the cable identity',()=>{
  useRoomWiring.setState({cables:structuredClone(DEFAULT_ROOM_CABLES),past:[],future:[],selectedPort:null,selectedCable:null});
  useRoomWiring.getState().unplug('digital','to');
  let c=useRoomWiring.getState().cables.find(c=>c.id==='digital');assert.equal(c.to,null);assert.ok(c.loose);
  useRoomWiring.getState().cancel();useRoomWiring.getState().selectCable('digital');
  assert.equal(useRoomWiring.getState().selectedPort,'wiim.opt');
  useRoomWiring.getState().pickPort('warmer.coax');assert.equal(useRoomWiring.getState().cables.find(c=>c.id==='digital').to,null);
  useRoomWiring.getState().pickPort('warmer.opt');assert.equal(useRoomWiring.getState().cables.find(c=>c.id==='digital').to,'warmer.opt');
  useRoomWiring.getState().undo();assert.equal(useRoomWiring.getState().cables.find(c=>c.id==='digital').to,null);
  useRoomWiring.getState().undo();assert.equal(useRoomWiring.getState().cables.find(c=>c.id==='digital').to,'bifrost.opt');
  useRoomWiring.getState().redo();assert.equal(useRoomWiring.getState().cables.find(c=>c.id==='digital').to,null);
  useRoomWiring.getState().remove('digital');assert.equal(useRoomWiring.getState().future.length,0);
});
test('saved patches reject unknown ports, reversed directions, duplicates, occupancy and nonfinite loose points',()=>{
  assert.deepEqual(restoreRoomCables([]),[]);
  assert.deepEqual(restoreRoomCables(null),DEFAULT_ROOM_CABLES);
  const bad=[...DEFAULT_ROOM_CABLES,{id:'foreign',from:'alien',to:'a90.rcaIn'},{id:'same',from:'warmer.xlrOut',to:'a90.xlrIn'},{id:'digital',from:'wiim.coax',to:'warmer.coax'},{id:'reversed',from:'a90.rcaIn',to:'warmer.xlrOut'}];
  assert.deepEqual(restoreRoomCables(bad).map(c=>c.id),DEFAULT_ROOM_CABLES.map(c=>c.id));
});
test('audio routes remain above boards and outside all five shelves, for every preset and disconnected end',()=>{
  const shelves=[{top:.172,w:.34},{top:.534,w:.34},{top:.7668,w:.34},{top:.9408,w:.39},{top:1.2508,w:.34}];
  for(const name of ['a90','bifrost','warmer'])for(const cable of roomPreset(name)){
    const variants=[cable,...['from','to'].map(end=>({...cable,[end]:null}))];
    for(const c of variants)for(const path of cablePaths(c))for(const [x,y,z] of path.points){
      assert.ok(z-path.radius>=.004-1e-8,`${name} ${c.id} below floor`);
      assert.ok(!shelves.some(s=>Math.abs(x)<s.w+path.radius&&Math.abs(y)<.225+path.radius&&z>s.top-.032-path.radius&&z<s.top+path.radius),`${name} ${c.id} intersects shelf at ${x},${y},${z}`);
    }
  }
  assert.ok(Object.values(ROOM_PORT_MAP).every(p=>p.position.every(Number.isFinite)));
});
test('walking can reach the rear service position without crossing rack or furniture',()=>{
  assert.ok(isWalkPositionClear(WALK_ROOM.behind.x,WALK_ROOM.behind.z));
  let p={...WALK_ROOM.start};
  for(const target of [{x:-.72,z:2.5},{x:-.72,z:-.76},WALK_ROOM.behind])p=moveInRoom(p,target.x-p.x,target.z-p.z);
  assert.ok(Math.hypot(p.x-WALK_ROOM.behind.x,p.z-WALK_ROOM.behind.z)<.01);
});
