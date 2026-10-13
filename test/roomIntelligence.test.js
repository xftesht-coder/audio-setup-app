import test from 'node:test';
import assert from 'node:assert/strict';
import { auditRoom } from '../src/data/roomIntelligence.js';
import { DEFAULT_ROOM_CABLES } from '../src/data/roomEquipment.js';
import { roomPreset } from '../src/data/roomWiring.js';
import { parseRoomBackup } from '../src/data/roomBackup.js';
import { useRoomWiring } from '../src/store/roomWiringStore.js';

const backup = cables => JSON.stringify({ version: 1, cables });
test('all presets reach four targets through the selected source without treating power as signal', () => {
  for (const preset of ['a90', 'bifrost', 'warmer']) for (const source of ['wiim', 'e1']) {
    const report = auditRoom(roomPreset(preset), source);
    assert.equal(report.connected, 4);
    assert.equal(report.findings.filter(f => f.level === 'issue').length, 0);
    assert.ok(report.routes.every(r => r.path[0].from.startsWith(source + '.')));
    assert.ok(report.findings.some(f => f.id === 'gain' && f.level === 'unknown'));
  }
  assert.throws(() => auditRoom([], 'unknown'));
});
test('a disconnected DAC breaks only the digital route, not the independent vinyl source', () => {
  const cables = DEFAULT_ROOM_CABLES.filter(c => c.id !== 'digital');
  assert.equal(auditRoom(cables).connected, 0);
  assert.equal(auditRoom(cables, 'e1').connected, 4);
  assert.equal(auditRoom([]).connected, 0);
  const powerOnly = DEFAULT_ROOM_CABLES.filter(c => c.id.startsWith('power'));
  assert.equal(auditRoom(powerOnly).connected, 0);
});
test('subwoofer branch, missing power and a loose end have specific evidence', () => {
  const cables = DEFAULT_ROOM_CABLES.filter(c => c.id !== 'power-bifrost').map(c => c.id === 'sub0' ? { ...c, to: null } : c);
  const report = auditRoom(cables);
  assert.equal(report.connected, 3);
  assert.equal(report.routes.find(r => r.id === 'rel0').connected, false);
  for (const id of ['power-bifrost', 'loose-sub0', 'rel-pinout', 'planned']) assert.ok(report.findings.some(f => f.id === id));
});
test('invalid port types and a power feed never manufacture an audio route', () => {
  const cables = DEFAULT_ROOM_CABLES.map(c => c.id === 'digital' ? { ...c, to: 'bifrost.coax' } : c);
  assert.equal(auditRoom(cables).connected, 0);
  assert.ok(auditRoom(cables).findings.some(f => f.id === 'invalid-digital'));
});
test('backup round trips all presets, old exports with labels, free ends and intentionally empty rooms', () => {
  for (const preset of ['a90', 'bifrost', 'warmer']) assert.deepEqual(parseRoomBackup(backup(roomPreset(preset))).map(c => c.id), roomPreset(preset).map(c => c.id));
  const loose = DEFAULT_ROOM_CABLES.map(c => c.id === 'digital' ? { ...c, to: null, loose: [0, .46, .4], fromLabel: 'ignored display label' } : c);
  assert.equal(parseRoomBackup(backup(loose)).find(c => c.id === 'digital').toType, 'OPTICAL');
  assert.deepEqual(parseRoomBackup(backup([])), []);
});
test('malformed, foreign, duplicate, incompatible and oversized imports fail as a whole', () => {
  for (const raw of ['bad', 'null', '{}', '{"version":2,"cables":[]}', ' '.repeat(128 * 1024 + 1)]) assert.throws(() => parseRoomBackup(raw));
  for (const cable of [
    { ...DEFAULT_ROOM_CABLES[0] },
    { id: 'unknown', from: 'not-a-port', to: 'freya.xlr1' },
    { id: 'busy', from: 'warmer.xlrOut', to: 'a90.xlrIn' },
    { id: 'bad-type', from: 'warmer.xlrOut', to: 'freya.xlr1', fromType: 'RCA' },
    { id: 'wrong-signal', from: 'wiim.coax', to: 'freya.rca3' },
    { id: 'reserved', from: 'side0.2', to: null, toType: 'IEC' },
    { id: 'bad-position', from: 'freya.xlrOut', to: null, toType: 'XLR', loose: [0, 0, -1] },
    { id: 'impossible-plug', from: 'wiim.coax', to: null, toType: 'XLR' },
  ]) assert.throws(() => parseRoomBackup(backup([...DEFAULT_ROOM_CABLES, cable])));
});
test('failed imports preserve the current graph and valid imports are undoable', () => {
  useRoomWiring.persist.setOptions({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
  useRoomWiring.setState({ cables: structuredClone(DEFAULT_ROOM_CABLES), past: [], future: [] });
  assert.throws(() => useRoomWiring.getState().importFile('bad'));
  assert.deepEqual(useRoomWiring.getState().cables, DEFAULT_ROOM_CABLES);
  assert.equal(useRoomWiring.getState().past.length, 0);
  useRoomWiring.getState().importFile(backup([]));
  assert.deepEqual(useRoomWiring.getState().cables, []);
  useRoomWiring.getState().undo();
  assert.deepEqual(useRoomWiring.getState().cables, DEFAULT_ROOM_CABLES);
});
