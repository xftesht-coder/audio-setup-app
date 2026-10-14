import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomWiringStore, ROOM_STORAGE_KEY, PREVIOUS_ROOM_STORAGE_KEY } from '../src/store/roomWiringStore.js';
import { DEFAULT_ROOM_CABLES, ROOM_DEVICE_MAP, ROOM_PORT_MAP } from '../src/data/roomEquipment.js';
import { defaultListening } from '../src/data/roomListening.js';
import { roomSnapshot, parseRoomSnapshot } from '../src/data/roomBackup.js';
import { inferComponents, roomInstance } from '../src/data/roomComponents.js';
import { previewReplacement } from '../src/data/roomReplacement.js';
import { auditRoom } from '../src/data/roomIntelligence.js';
import { cablePaths, roomPreset } from '../src/data/roomWiring.js';

function setup() {
  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) };
  return { store: createRoomWiringStore(() => storage), storage, data };
}
const json = value => JSON.parse(JSON.stringify(value));
const state = () => ({ cables: structuredClone(DEFAULT_ROOM_CABLES), components: { dac: 'bifrost', preamp: 'a90' }, listening: { ...defaultListening(), mode: 'selected', inputs: { ...defaultListening().inputs, bifrost: 'bifrost.opt', a90: 'a90.xlrIn', rusich: 'rusich.rca1', skoll: 'skoll.rcaIn' } } });

test('catalog model IDs select exact existing instances without replacing their geometry or ownership', () => {
  assert.equal(roomInstance('preamp','schiit-freya_2'), 'freya');
  assert.equal(roomInstance('dac','fiio-warmer-r2r'), 'warmer');
  assert.equal(roomInstance('dac','schiit-freya_2'), undefined);
  assert.equal(ROOM_DEVICE_MAP.freya.status, 'Планируется');
});

test('A90 to Freya transfers both inputs, pre output and declared input; preserves speakers, REL, old power and identity', () => {
  const current = state(), before = json(current), p = previewReplacement(current,{ preamp: 'freya' });
  assert.deepEqual(json(current),before);
  assert.deepEqual(p.problems,[]);
  assert.equal(p.next.cables.find(c=>c.id==='phono').to,'freya.rca3');
  assert.equal(p.next.cables.find(c=>c.id==='dac').to,'freya.xlr1');
  assert.equal(p.next.cables.find(c=>c.id==='pre').from,'freya.rcaOut1');
  assert.equal(p.next.listening.inputs.freya,'freya.xlr1');
  assert.equal(p.next.listening.inputs.a90,'a90.xlrIn');
  assert.equal(p.next.cables.find(c=>c.id==='power-freya').from,'pdu.7');
  for(const c of current.cables.filter(c=>c.id.startsWith('power')||c.id.startsWith('speaker')||c.id.startsWith('sub'))) assert.deepEqual(p.next.cables.find(k=>k.id===c.id),c);
  assert.equal(p.beforeReport.connected,4);
  assert.equal(p.afterReport.connected,4);
  assert.equal(p.changes.length,4);
});

test('simultaneous swaps work through optical/coax and RCA/XLR; unknown input is never guessed', () => {
  for(const digital of ['opt','coax'])for(const line of ['xlr','rca']) {
    const s=state();
    s.cables=s.cables.map(c=>c.id==='digital'?{...c,from:`wiim.${digital}`,to:`bifrost.${digital}`,fromType:ROOM_PORT_MAP[`wiim.${digital}`].connector,toType:ROOM_PORT_MAP[`bifrost.${digital}`].connector}:c.id==='dac'?{...c,from:`bifrost.${line}Out`,to:`a90.${line}In`,fromType:line.toUpperCase(),toType:line.toUpperCase()}:c).filter(c=>line!=='rca'||c.id!=='phono');
    s.listening.inputs.bifrost=`bifrost.${digital}`;s.listening.inputs.a90=`a90.${line}In`;
    const p=previewReplacement(s,{dac:'warmer',preamp:'freya'});
    assert.deepEqual(p.problems,[]);
    assert.equal(p.afterReport.connected,4);
    assert.equal(p.next.cables.find(c=>c.id==='digital').to,`warmer.${digital}`);
    assert.equal(p.next.cables.find(c=>c.id==='dac').to,line==='xlr'?'freya.xlr1':'freya.rca3');
    assert.equal(p.next.cables.length,s.cables.length+2);
    assert.deepEqual(json(parseRoomSnapshot(JSON.stringify({version:3,...p.next}))),json(p.next));
  }
  const s=state();s.listening.inputs.bifrost=null;
  assert.equal(previewReplacement(s,{dac:'warmer'}).next.listening.inputs.warmer,null);
});

test('vinyl source survives preamp replacement without changing the chosen source', () => {
  const s=state();s.listening.source='e1';s.listening.inputs.a90='a90.rcaIn';
  const p=previewReplacement(s,{preamp:'freya',dac:'warmer'});
  assert.equal(p.next.listening.source,'e1');
  assert.equal(p.next.listening.inputs.freya,'freya.rca3');
  assert.equal(p.afterReport.connected,4);
  assert.ok(p.afterReport.routes.every(r=>r.path[0].from==='e1.out'));
});

test('reverse replacement reuses existing power and restores signal endpoints with no duplicate cables', () => {
  const s=state(), forward=previewReplacement(s,{dac:'warmer',preamp:'freya'}), back=previewReplacement(forward.next,{dac:'bifrost',preamp:'a90'});
  assert.deepEqual(back.problems,[]);
  assert.equal(back.afterReport.connected,4);
  assert.equal(back.changes.filter(c=>c.kind==='power').length,0);
  for(const c of s.cables)assert.deepEqual(back.next.cables.find(k=>k.id===c.id),c);
});

test('preview cancel is inert; apply, undo, redo, reload and backup move the entire selection and graph', () => {
  const {store,storage}=setup();store.setState(state());
  const before=json(roomSnapshot(store.getState()));
  store.getState().previewReplacement({preamp:'freya'});
  store.getState().previewReplacement({dac:'warmer'});
  assert.deepEqual(json(roomSnapshot(store.getState())),before);
  assert.equal(storage.getItem(ROOM_STORAGE_KEY),null);
  store.getState().cancelReplacement();
  assert.deepEqual(json(roomSnapshot(store.getState())),before);
  store.getState().previewReplacement({preamp:'freya',dac:'warmer'});
  assert.equal(store.getState().applyReplacement(),true);
  assert.equal(store.getState().past.length,1);
  const after=json(roomSnapshot(store.getState()));
  assert.deepEqual(after.components,{dac:'warmer',preamp:'freya'});
  assert.deepEqual(json(roomSnapshot(createRoomWiringStore(()=>storage).getState())),after);
  store.getState().undo();assert.deepEqual(json(roomSnapshot(store.getState())),before);
  store.getState().redo();assert.deepEqual(json(roomSnapshot(store.getState())),after);
  const other=setup().store;other.getState().importFile(JSON.stringify(after));
  assert.deepEqual(json(roomSnapshot(other.getState())),after);
});

test('occupied target, converging Freya ports and self-connections block apply without deleting custom cables', () => {
  const cases=[
    {...state(),cables:[...state().cables,{id:'custom',from:'warmer.xlrOut',to:'freya.xlr1',fromType:'XLR',toType:'XLR'}]},
    {...state(),components:{dac:'bifrost',preamp:'freya'},cables:[...roomPreset('bifrost'),{id:'extra-out',from:'freya.rcaOut2',to:'rusich.rca2',fromType:'RCA',toType:'RCA'}]},
    {...state(),cables:[...state().cables,{id:'loop-on-swap',from:'a90.xlrOut',to:'freya.xlr2',fromType:'XLR',toType:'XLR'}]},
  ];
  for(const current of cases){
    const {store}=setup();store.setState(current);const before=json(roomSnapshot(store.getState()));
    store.getState().previewReplacement({preamp:current.components.preamp==='a90'?'freya':'a90'});
    assert.ok(store.getState().replacement.problems.length>0);
    assert.equal(store.getState().applyReplacement(),false);
    assert.deepEqual(json(roomSnapshot(store.getState())),before);
    assert.equal(store.getState().past.length,0);
  }
});

test('lack of main sockets does not steal REL or lamp outlets, and existing target power is reused', () => {
  const s=state();s.cables=s.cables.map(c=>c.id==='power-rel0'?{...c,from:'pdu.7'}:c.id==='power-rel1'?{...c,from:'pdu.8'}:c);
  const p=previewReplacement(s,{preamp:'freya'});
  assert.match(p.problems.join(' '),/нет свободной розетки/);
  assert.equal(p.changes.filter(c=>c.kind==='power').length,0);
  const already=state();already.cables.push({id:'existing-feed',from:'pdu.8',to:'freya.power',fromType:'SCHUKO',toType:'IEC'});
  assert.equal(previewReplacement(already,{preamp:'freya'}).changes.filter(c=>c.kind==='power').length,0);
});

test('loose ends stay loose and missing links are reported, never silently repaired', () => {
  const s=state();s.cables=s.cables.map(c=>c.id==='digital'?{...c,from:null,loose:[0,.46,.4]}:c);
  const p=previewReplacement(s,{dac:'warmer'}), cable=p.next.cables.find(c=>c.id==='digital');
  assert.equal(cable.from,null);assert.equal(cable.to,'warmer.opt');
  assert.deepEqual(cable.loose,[0,.46,.4]);assert.equal(p.afterReport.connected,0);
  assert.ok(p.afterReport.findings.some(f=>f.id==='loose-digital'));
});

test('preview cannot overwrite a changed graph; undo cancels a pending replacement', () => {
  const {store}=setup();store.getState().previewReplacement({preamp:'freya'});
  store.setState({cables:store.getState().cables.filter(c=>c.id!=='digital')});
  assert.equal(store.getState().applyReplacement(),false);
  assert.equal(store.getState().components.preamp,'a90');
  assert.equal(store.getState().replacement.afterReport.connected,0);
  assert.equal(store.getState().applyReplacement(),true);
  store.getState().previewReplacement({dac:'warmer'});store.getState().undo();
  assert.equal(store.getState().replacement,null);
});

test('v2 migration preserves custom cables and original storage; ambiguous selection stays unknown', () => {
  const {storage,data}=setup();const old={version:2,cables:roomPreset('warmer'),listening:defaultListening()};
  data.set(PREVIOUS_ROOM_STORAGE_KEY,JSON.stringify(old));
  const store=createRoomWiringStore(()=>storage);
  assert.deepEqual(store.getState().components,{dac:'warmer',preamp:'freya'});
  store.getState().setListening({source:'e1'});
  assert.equal(data.get(PREVIOUS_ROOM_STORAGE_KEY),JSON.stringify(old));
  assert.deepEqual(inferComponents([]),{dac:null,preamp:null});
  const ambiguous=[...roomPreset('bifrost'),{id:'a90-also',from:'a90.xlrOut',to:'rusich.xlr1'}];
  assert.equal(inferComponents(ambiguous).preamp,null);
  assert.throws(()=>parseRoomSnapshot(JSON.stringify({version:3,...state(),components:{dac:'freya',preamp:'a90'}})));
});

test('unplug retains selected device while manual reconnection to another preamp updates the shared role', () => {
  const {store}=setup();store.getState().unplug('pre','from');
  assert.equal(store.getState().components.preamp,'a90');
  store.getState().pickPort('freya.rcaOut1');
  assert.equal(store.getState().components.preamp,'freya');
  assert.equal(auditRoom(store.getState().cables).connected,0);
});

test('new replacement cable routes remain above the floor and outside shelves in all four combinations', () => {
  const shelves=[{top:.172,w:.34},{top:.534,w:.34},{top:.7668,w:.34},{top:.9408,w:.39},{top:1.2508,w:.34}];
  for(const dac of ['bifrost','warmer'])for(const preamp of ['a90','freya'])for(const c of previewReplacement(state(),{dac,preamp}).next.cables)for(const path of cablePaths(c))for(const [x,y,z] of path.points){
    assert.ok(z-path.radius>=.004-1e-8,`${dac}/${preamp} ${c.id} below floor`);
    assert.ok(!shelves.some(s=>Math.abs(x)<s.w+path.radius&&Math.abs(y)<.225+path.radius&&z>s.top-.032-path.radius&&z<s.top+path.radius),`${dac}/${preamp} ${c.id} intersects shelf`);
  }
});
