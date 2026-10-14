import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ROOM_CABLES } from '../src/data/roomEquipment.js';
import { roomPatchRows } from '../src/data/roomPatchView.js';
import { createRoomWiringStore } from '../src/store/roomWiringStore.js';
import { auditRoom } from '../src/data/roomIntelligence.js';
import { roomSnapshot } from '../src/data/roomBackup.js';

function setup() {
  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) };
  let id = 0;
  return { store: createRoomWiringStore(() => storage, () => String(++id)), storage };
}

test('patch filters separate audio, mains and ground without treating HIGH LEVEL as line XLR', () => {
  const cables = structuredClone(DEFAULT_ROOM_CABLES), original = JSON.stringify(cables);
  assert.equal(roomPatchRows(cables).length,18);
  assert.equal(roomPatchRows(cables,{kind:'audio'}).length,9);
  assert.equal(roomPatchRows(cables,{kind:'power'}).length,8);
  assert.equal(roomPatchRows(cables,{kind:'ground'}).length,1);
  assert.equal(roomPatchRows(cables,{query:'  HIGH LEVEL  '}).length,2);
  assert.equal(roomPatchRows(cables,{kind:'power',query:'rel'}).length,2);
  assert.equal(JSON.stringify(cables),original);
});

test('each endpoint remains searchable when the other end is unplugged, including mains', () => {
  const {store}=setup();
  store.getState().unplug('digital','from');
  store.getState().unplug('power-wiim','to');
  const rows=roomPatchRows(store.getState().cables,{kind:'loose'});
  assert.deepEqual(rows.map(c=>c.id),['digital','power-wiim']);
  assert.equal(rows[0].kind,'audio');
  assert.equal(rows[1].kind,'power');
  assert.match(rows[0].fromLabel,/Свободный конец/);
  assert.equal(roomPatchRows(store.getState().cables,{kind:'loose',query:'bifrost'}).length,1);
});

test('catalog replacement, patch disconnection, audit, undo and reload share the exact graph', () => {
  const {store,storage}=setup();
  store.getState().previewReplacement({dac:'warmer',preamp:'freya'});
  store.getState().applyReplacement();
  const saved=JSON.stringify(roomSnapshot(store.getState()));
  let rows=roomPatchRows(store.getState().cables,{kind:'audio'});
  assert.ok(rows.every(c=>!c.fromLabel.includes('Bifrost')&&!c.toLabel.includes('A90')));
  const report=()=>auditRoom(store.getState().cables,store.getState().listening.source,store.getState().listening);
  assert.equal(report().connected,4);
  store.getState().unplug('dac','to');
  assert.equal(report().connected,0);
  assert.equal(roomPatchRows(store.getState().cables,{kind:'loose'})[0].from,'warmer.xlrOut');
  assert.deepEqual(createRoomWiringStore(()=>storage).getState().cables,store.getState().cables);
  store.getState().undo();
  assert.equal(JSON.stringify(roomSnapshot(store.getState())),saved);
  assert.equal(report().connected,4);
});

test('route view includes only audio hops of that target and reports no path after a break', () => {
  const {store}=setup();
  const routes=()=>auditRoom(store.getState().cables).routes;
  const left=routes().find(r=>r.id==='ae0'), sub=routes().find(r=>r.id==='rel1');
  assert.deepEqual(roomPatchRows(store.getState().cables,{path:left.path}).map(c=>c.id),['digital','dac','pre','speaker0']);
  assert.deepEqual(roomPatchRows([...store.getState().cables].reverse(),{path:left.path}).map(c=>c.id),['digital','dac','pre','speaker0']);
  assert.deepEqual(roomPatchRows(store.getState().cables,{path:sub.path}).map(c=>c.id),['digital','dac','pre','sub1']);
  store.getState().unplug('speaker0','to');
  assert.equal(roomPatchRows(store.getState().cables,{path:routes()[0].path}).length,0);
  assert.equal(routes()[1].connected,true);
});

test('repatching through ports preserves cable identity and rejects an incompatible target', () => {
  const {store}=setup();
  store.getState().unplug('digital','to');
  store.getState().pickPort('warmer.coax');
  assert.equal(store.getState().cables.find(c=>c.id==='digital').to,null);
  store.getState().pickPort('warmer.opt');
  const row=roomPatchRows(store.getState().cables,{query:'warmer'})[0];
  assert.equal(row.id,'digital');assert.equal(row.loose,false);assert.equal(row.to,'warmer.opt');
  assert.equal(store.getState().cables.length,18);
});

test('conflicts are not hidden by the directory projection', () => {
  const cables=[...DEFAULT_ROOM_CABLES,{id:'conflict',from:'warmer.xlrOut',to:'a90.xlrIn'}];
  assert.match(roomPatchRows(cables).find(c=>c.id==='conflict').issue,/занят/);
});
