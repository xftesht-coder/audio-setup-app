import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ROOM_CABLES } from '../src/data/roomEquipment.js';
import { defaultListening } from '../src/data/roomListening.js';
import { auditRoom } from '../src/data/roomIntelligence.js';
import { parseRoomSnapshot, roomSnapshot } from '../src/data/roomBackup.js';
import { createRoomWiringStore, ROOM_STORAGE_KEY, LEGACY_ROOM_STORAGE_KEY } from '../src/store/roomWiringStore.js';

const digital = () => ({ ...defaultListening(), mode: 'selected', inputs: { ...defaultListening().inputs, bifrost: 'bifrost.opt', a90: 'a90.xlrIn', rusich: 'rusich.rca1' } });
const memory = entries => {
  const data = new Map(entries);
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
const audit = settings => auditRoom(DEFAULT_ROOM_CABLES, settings.source, settings);

test('unknown inputs are not working paths or cable faults; known matching inputs complete four routes', () => {
  const report = audit({ ...defaultListening(), mode: 'selected' });
  assert.equal(report.connected, 0);
  assert.equal(report.wired, 4);
  assert.equal(report.unresolved, 4);
  assert.equal(report.findings.filter(f => f.id.startsWith('input-')).length, 3);
  assert.ok(report.findings.filter(f => f.id.startsWith('input-')).every(f => f.level === 'unknown'));
  assert.equal(report.findings.filter(f => f.level === 'issue').length, 0);
  assert.equal(audit(digital()).connected, 4);
});

test('wrong DAC input blocks all four targets and names both actual project selection and required port', () => {
  const settings = digital(); settings.inputs.bifrost = 'bifrost.coax';
  const report = audit(settings);
  assert.equal(report.connected, 0);
  assert.ok(report.routes.every(r => r.status === 'blocked' && r.wired));
  assert.match(report.findings.find(f => f.id === 'input-bifrost.opt').evidence, /OPTICAL IN.*COAX IN/);
  assert.equal(audit({ ...settings, mode: 'possible' }).connected, 4);
});

test('changing source never silently switches the preamp; the vinyl path needs RCA and phono input choices', () => {
  const settings = digital(); settings.source = 'e1';
  assert.equal(audit(settings).connected, 0);
  settings.inputs.a90 = 'a90.rcaIn';
  assert.equal(audit(settings).unresolved, 4);
  settings.inputs.skoll = 'skoll.rcaIn';
  assert.equal(audit(settings).connected, 4);
  assert.equal(audit({ ...settings, source: 'wiim' }).connected, 0);
});

test('parallel optical and coax cables select the valid route instead of the first traversed route', () => {
  const cables = [...DEFAULT_ROOM_CABLES, { id: 'coax-alternative', from: 'wiim.coax', to: 'bifrost.coax' }];
  const settings = digital(); settings.inputs.bifrost = 'bifrost.coax';
  const report = auditRoom(cables, settings.source, settings);
  assert.equal(report.connected, 4);
  assert.ok(report.routes.every(r => r.path[0].id === 'coax-alternative'));
  assert.ok(!report.findings.some(f => f.id.startsWith('input-')));
});

test('legacy storage migrates without guessing selectors or overwriting the original; v2 wins on reload', () => {
  const legacy = JSON.stringify({ version: 1, state: { cables: DEFAULT_ROOM_CABLES.filter(c => c.id !== 'digital') } });
  const storage = memory([[LEGACY_ROOM_STORAGE_KEY, legacy]]);
  const store = createRoomWiringStore(() => storage);
  assert.equal(store.getState().cables.length, 17);
  assert.deepEqual(store.getState().listening, defaultListening());
  store.getState().setListening(digital());
  const reloaded = createRoomWiringStore(() => storage);
  assert.deepEqual(reloaded.getState().listening, digital());
  assert.deepEqual(reloaded.getState().cables, store.getState().cables);
  assert.equal(storage.getItem(LEGACY_ROOM_STORAGE_KEY), legacy);
  assert.deepEqual(parseRoomSnapshot(storage.getItem(ROOM_STORAGE_KEY)), { cables: store.getState().cables, listening: digital(), components: store.getState().components });
});

test('intentionally empty legacy and v2 rooms stay empty on migration and reload', () => {
  for (const entries of [
    [[LEGACY_ROOM_STORAGE_KEY, JSON.stringify({ version: 1, state: { cables: [] } })]],
    [[ROOM_STORAGE_KEY, JSON.stringify({ version: 2, cables: [], listening: digital() })]],
  ]) assert.deepEqual(createRoomWiringStore(() => memory(entries)).getState().cables, []);
});

test('backups and undo/redo retain both cables and inputs; v1 import resets unknown selectors atomically', () => {
  const storage = memory(), store = createRoomWiringStore(() => storage);
  store.getState().setListening(digital());
  store.getState().unplug('digital', 'to');
  const saved = roomSnapshot(store.getState());
  const roundTrip = parseRoomSnapshot(JSON.stringify(saved));
  assert.deepEqual(JSON.parse(JSON.stringify(roundTrip)), JSON.parse(JSON.stringify({ cables: saved.cables, listening: saved.listening, components: saved.components })));
  store.getState().importFile(JSON.stringify({ version: 1, cables: [] }));
  assert.deepEqual(store.getState().listening, defaultListening());
  store.getState().undo();
  assert.deepEqual(roomSnapshot(store.getState()), saved);
  store.getState().undo();
  assert.equal(store.getState().cables.find(c => c.id === 'digital').to, 'bifrost.opt');
  store.getState().redo();
  assert.equal(store.getState().cables.find(c => c.id === 'digital').to, null);
  assert.deepEqual(createRoomWiringStore(() => storage).getState().listening, digital());
});

test('foreign inputs, missing settings and unsupported modes reject the entire import and leave history alone', () => {
  const store = createRoomWiringStore(() => memory());
  const before = roomSnapshot(store.getState());
  const invalid = [
    undefined, { ...digital(), mode: 'automatic' }, { ...digital(), source: 'unknown' },
    { ...digital(), inputs: { ...digital().inputs, a90: 'freya.xlr1' } },
    { ...digital(), inputs: {} }, { ...digital(), inputs: { ...digital().inputs, alien: null } },
  ];
  for (const listening of invalid) {
    assert.throws(() => store.getState().importFile(JSON.stringify({ version: 2, cables: [], listening })));
    assert.deepEqual(roomSnapshot(store.getState()), before);
    assert.equal(store.getState().past.length, 0);
  }
});

test('presets keep declared inputs; an input chosen for A90 does not invent a Freya selection', () => {
  const store = createRoomWiringStore(() => memory());
  store.getState().setListening(digital());
  store.getState().preset('bifrost');
  assert.deepEqual(store.getState().listening, digital());
  assert.equal(auditRoom(store.getState().cables, 'wiim', store.getState().listening).unresolved, 4);
  store.getState().setListening({ inputs: { freya: 'freya.xlr1' } });
  assert.equal(auditRoom(store.getState().cables, 'wiim', store.getState().listening).connected, 4);
});

test('unreadable v2 is archived before first write, never silently replaced by legacy; storage failures stay visible', () => {
  const storage = memory([[ROOM_STORAGE_KEY, '{broken'], [LEGACY_ROOM_STORAGE_KEY, JSON.stringify({ version: 1, state: { cables: [] } })]]);
  const store = createRoomWiringStore(() => storage, () => 'recovery-test');
  assert.ok(store.getState().storageError);
  assert.equal(storage.getItem(ROOM_STORAGE_KEY), '{broken');
  assert.equal(store.getState().cables.length, DEFAULT_ROOM_CABLES.length);
  store.getState().setListening(digital());
  assert.equal(storage.getItem(ROOM_STORAGE_KEY + '-recovery-recovery-test'), '{broken');
  assert.equal(store.getState().storageError, '');
  const full = createRoomWiringStore(() => ({ getItem: () => null, setItem: () => { throw new Error('quota'); } }));
  full.getState().setListening(digital());
  assert.deepEqual(full.getState().listening, digital());
  assert.match(full.getState().storageError, /не сохранены/);
  full.getState().undo();
  assert.deepEqual(full.getState().listening, defaultListening());
});

test('if recovery cannot be written, the unreadable original is preserved', () => {
  const storage = memory([[ROOM_STORAGE_KEY, '{broken']]);
  const store = createRoomWiringStore(() => ({ getItem: storage.getItem, setItem: () => { throw new Error('quota'); } }));
  store.getState().setListening(digital());
  assert.equal(storage.getItem(ROOM_STORAGE_KEY), '{broken');
  assert.ok(store.getState().storageError);
});
