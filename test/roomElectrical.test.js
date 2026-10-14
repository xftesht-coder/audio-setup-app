import test from 'node:test';
import assert from 'node:assert/strict';
import { assessRoomElectrical, loadingEstimate } from '../src/data/roomElectrical.js';
import { portElectricalFacts, FREYA_MODES } from '../src/data/roomPassports.js';
import { ROOM_PORT_MAP } from '../src/data/roomEquipment.js';
import { roomPreset } from '../src/data/roomWiring.js';
import { defaultListening } from '../src/data/roomListening.js';
import { roomSnapshot, parseRoomSnapshot } from '../src/data/roomBackup.js';
import { createRoomWiringStore, ROOM_STORAGE_KEY, PREVIOUS_ROOM_STORAGE_KEY, V2_ROOM_STORAGE_KEY } from '../src/store/roomWiringStore.js';

const listening = mode => ({ ...defaultListening(), freyaMode: mode });
const facts = (id, mode = 'solid-low') => portElectricalFacts(ROOM_PORT_MAP[id], mode);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9);
function memory() { const data=new Map(); return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}; }

test('Bifrost 3 to active Freya computes a reproducible loading estimate with per-value provenance', () => {
  const r=assessRoomElectrical(roomPreset('bifrost'),listening('solid-low'));
  const link=r.links.find(l=>l.id==='dac');
  close(link.loading.transfer,10000/10075);
  close(link.loading.lossDb,20*Math.log10(10000/10075));
  close(link.loading.ratio,10000/75);
  assert.equal(link.output.level.value,4);
  assert.equal(link.input.impedance.value,10000);
  for(const f of [link.output.impedance,link.input.impedance]) {
    assert.equal(f.status,'published');assert.ok(f.source.url.startsWith('https://'));assert.equal(f.checkedAt,'2026-10-15');assert.ok(f.revision);assert.equal(f.unit,'Ω');assert.ok(f.conditions);
  }
  assert.equal(link.headroom,null);
  assert.equal(r.links.find(l=>l.id==='pre').loading,null);
});

test('WARMER test load is not output impedance and its measured voltage is never recalculated as unloaded', () => {
  for(const [id,volts] of [['warmer.rcaOut',1.8],['warmer.xlrOut',3.3]]) {
    const f=facts(id);assert.equal(f.impedance.value,null);assert.equal(f.level.value,volts);assert.match(f.level.conditions,/10 кΩ/);assert.match(f.level.conditions,/OS/);
  }
  const link=assessRoomElectrical(roomPreset('warmer'),listening('tube-high')).links.find(l=>l.id==='dac');
  assert.equal(link.loading,null);assert.equal(link.headroom,null);
});

test('Freya modes never reuse active output impedance for passive, hybrids or unknown settings', () => {
  for(const mode of Object.keys(FREYA_MODES)) {
    const f=facts('freya.rcaOut1',mode);
    assert.equal(f.impedance.value,FREYA_MODES[mode].outputVerified?75:null);
  }
  assert.equal(facts('freya.xlrOut','tube-high').impedance.value,150);
  assert.equal(facts('freya.xlr1','passive').impedance.value,null);
  assert.equal(facts('freya.xlr1',null).impedance.value,null);
  assert.equal(assessRoomElectrical(roomPreset('bifrost'),listening('passive')).links.find(l=>l.id==='dac').loading,null);
  assert.equal(assessRoomElectrical(roomPreset('bifrost'),listening('tube-high')).gain.value,4);
});

test('unconfirmed A90 revision and custom Rusich values cannot yield numerical approval', () => {
  for(const id of ['a90.xlrIn','a90.rcaOut','rusich.rca1','rusich.xlr1']) {
    const f=facts(id);assert.equal(f.impedance.value,null);assert.equal(f.level.value,null);assert.equal(f.impedance.revision,null);
  }
  assert.ok(assessRoomElectrical(roomPreset('a90'),listening('solid-low')).links.every(l=>l.loading===null));
});

test('invalid, absent or differently unit-labelled data never becomes a zero or a calculation', () => {
  const out=facts('bifrost.xlrOut').impedance,input=facts('freya.xlr1').impedance;
  for(const value of [null,undefined,NaN,Infinity,-1,'75']) assert.equal(loadingEstimate({...out,value},input),null);
  for(const value of [null,0,-1,NaN,'10000']) assert.equal(loadingEstimate(out,{...input,value}),null);
  for(const patch of [{unit:'kΩ'},{status:'unknown'},{source:null},{revision:null}]) assert.equal(loadingEstimate({...out,...patch},input),null);
  assert.equal(loadingEstimate({...out,value:0},input).transfer,1);
  assert.equal(loadingEstimate({...out,value:1e308},{...input,value:1e308}),null);
});

test('digital limits follow actual optical/coax wiring, not selected catalog model; no sample-rate success is invented', () => {
  let cables=roomPreset('warmer');
  assert.equal(assessRoomElectrical(cables,listening(null)).digital[0].limit.value,96);
  cables=cables.map(c=>c.id==='digital'?{...c,from:'wiim.coax',to:'warmer.coax',fromType:'COAX',toType:'COAX'}:c);
  assert.equal(assessRoomElectrical(cables,listening(null)).digital[0].limit.value,192);
  assert.equal(assessRoomElectrical(cables.filter(c=>c.id!=='digital'),listening(null)).digital.length,0);
  const broken=roomPreset('bifrost').map(c=>c.id==='dac'?{...c,to:null}:c);
  assert.ok(!assessRoomElectrical(broken,listening('solid-low')).links.some(l=>l.id==='dac'));
});

test('v3 migration keeps original bytes and unknown mode; v4 export, undo, swaps and reload preserve the declared Freya mode', () => {
  const storage=memory(),old={version:3,cables:roomPreset('bifrost'),listening:defaultListening(),components:{dac:'bifrost',preamp:'freya'}};
  delete old.listening.freyaMode;
  const raw=JSON.stringify(old);storage.setItem(PREVIOUS_ROOM_STORAGE_KEY,raw);
  const store=createRoomWiringStore(()=>storage);
  assert.equal(store.getState().listening.freyaMode,null);
  store.getState().setListening({freyaMode:'tube-high'});
  assert.equal(storage.getItem(PREVIOUS_ROOM_STORAGE_KEY),raw);
  assert.equal(roomSnapshot(store.getState()).version,4);
  assert.equal(parseRoomSnapshot(storage.getItem(ROOM_STORAGE_KEY)).listening.freyaMode,'tube-high');
  assert.equal(createRoomWiringStore(()=>storage).getState().listening.freyaMode,'tube-high');
  store.getState().previewReplacement({preamp:'a90'});store.getState().applyReplacement();
  assert.equal(store.getState().listening.freyaMode,'tube-high');
  store.getState().undo();store.getState().undo();assert.equal(store.getState().listening.freyaMode,null);
  store.getState().redo();assert.equal(store.getState().listening.freyaMode,'tube-high');
});

test('old v2 key is still read, while invalid v4 and foreign modes cannot replace current settings', () => {
  const storage=memory(),old={version:2,cables:[],listening:defaultListening()};delete old.listening.freyaMode;
  storage.setItem(V2_ROOM_STORAGE_KEY,JSON.stringify(old));const store=createRoomWiringStore(()=>storage);
  assert.equal(store.getState().cables.length,0);assert.equal(store.getState().listening.freyaMode,null);
  const snapshot=roomSnapshot(store.getState());
  for(const freyaMode of ['active',0,{},'toString']) assert.throws(()=>store.getState().importFile(JSON.stringify({...snapshot,listening:{...snapshot.listening,freyaMode}})));
  const missing=structuredClone(snapshot);delete missing.listening.freyaMode;assert.throws(()=>store.getState().importFile(JSON.stringify(missing)));
  assert.deepEqual(roomSnapshot(store.getState()),snapshot);
});
