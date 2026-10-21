import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomWiringStore, ROOM_STORAGE_KEY } from '../src/store/roomWiringStore.js';
import { createWorkshopStore, WORKSHOP_STORAGE_KEY } from '../src/stores/useWorkshopStore.js';
import { createLiveSystemStore, LIVE_SYSTEM_STORAGE_KEY } from '../src/stores/useLiveSystemStore.js';
import { captureLiveSystem, exportLiveVariants, MAX_LIVE_BYTES, MAX_VARIANTS, parseLiveSnapshot } from '../src/data/liveSystem.js';

function disk(entries = []) {
  const values = new Map(entries);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
function fixture(storage = disk(), idPrefix = '') {
  let next = 0;
  const room = createRoomWiringStore(() => storage), workshop = createWorkshopStore(() => storage);
  const live = createLiveSystemStore(room, workshop, () => storage, () => `${idPrefix}v${++next}`);
  return { storage, room, workshop, live, api: live.getState(), current: () => captureLiveSystem(room.getState(), workshop.getState()) };
}

test('existing wiring and cabinet migrate without overwriting any previous records', () => {
  const storage = disk(), a = fixture(storage);
  a.room.getState().setListening({ source: 'e1' });
  a.workshop.getState().resize('width', 725);
  const legacy = [ROOM_STORAGE_KEY, WORKSHOP_STORAGE_KEY].map(k => [k, storage.getItem(k)]);
  storage.values.delete(LIVE_SYSTEM_STORAGE_KEY); a.live.dispose();
  const f = fixture(storage), before = f.current();
  assert.equal(before.room.listening.source, 'e1');
  assert.equal(before.workshop.variants.rack.width, 725);
  assert.equal(storage.getItem(LIVE_SYSTEM_STORAGE_KEY), null);
  f.api.saveVariant(' Сейчас ');
  for (const [key, bytes] of legacy) assert.equal(storage.getItem(key), bytes);
  assert.deepEqual(f.live.getState().variants[0].snapshot, before);
  assert.equal(f.live.getState().variants[0].name, 'Сейчас');
});

test('a complete variant restores wiring, loose ends, selected inputs, both racks and TV settings together after reload', () => {
  const f = fixture(), originalId = f.api.saveVariant('A90'), original = f.current();
  f.workshop.getState().update({ material: 'oak' });
  f.workshop.getState().switchVariant('tv');
  f.workshop.getState().editTelevision({ footSpan: 1150 });
  f.room.getState().preset('warmer');
  f.room.getState().setListening({ mode: 'selected', inputs: { warmer: 'warmer.opt', freya: 'freya.xlr1' } });
  f.room.getState().unplug('digital', 'to');
  const alternate = f.current(), alternateId = f.api.saveVariant('WARMER + TV');
  assert.equal(f.api.loadVariant(originalId), true);
  assert.deepEqual(f.current(), original);
  assert.equal(f.live.getState().variants.length, 2);
  const reloaded = fixture(f.storage, 'reload-');
  assert.deepEqual(reloaded.current(), original);
  assert.equal(reloaded.api.loadVariant(alternateId), true);
  assert.deepEqual(reloaded.current(), alternate);
  assert.equal(reloaded.room.getState().cables.find(c => c.id === 'digital').to, null);
  assert.equal(reloaded.current().workshop.variants.rack.material, 'oak');
  assert.equal(reloaded.current().workshop.variants.tv.television.footSpan, 1150);
});

test('one undo reverses a complete restore; later rack/input edits are undone first and redo is invalidated by a new edit', () => {
  const f = fixture(), a = f.current(), id = f.api.saveVariant('A');
  f.workshop.getState().switchVariant('tv'); f.room.getState().preset('warmer');
  const b = f.current(), beforeLoad = f.live.getState().past.length;
  f.api.loadVariant(id);
  assert.equal(f.live.getState().past.length, beforeLoad + 1);
  f.workshop.getState().resize('width', 720);
  f.room.getState().setListening({ source: 'e1' });
  f.api.undo(); assert.equal(f.current().room.listening.source, 'wiim');
  f.api.undo(); assert.deepEqual(f.current(), a);
  f.api.undo(); assert.deepEqual(f.current(), b);
  f.api.redo(); assert.deepEqual(f.current(), a);
  f.room.getState().remove('digital');
  assert.equal(f.live.getState().future.length, 0);
  assert.deepEqual(f.live.getState().variants[0].snapshot, a);
});

test('UI selections are not history; cabinet variant switching records exactly one frame and can undo/redo', () => {
  const f = fixture(), original = f.current();
  f.room.getState().selectCable('digital'); f.room.getState().cancel();
  f.workshop.getState().view('top'); f.workshop.getState().setMode('equipment');
  assert.equal(f.live.getState().past.length, 0);
  f.workshop.getState().switchVariant('tv');
  assert.equal(f.live.getState().past.length, 1);
  f.api.undo(); assert.deepEqual(f.current(), original);
  f.api.redo(); assert.equal(f.current().workshop.activeVariant, 'tv');
  assert.equal(f.workshop.getState().selection, null);
});

test('imports validate the entire file, merge names without overwriting, deduplicate and leave the live system unchanged', () => {
  const f = fixture(), id = f.api.saveVariant('Система'), original = f.current();
  const one = f.live.getState().variants[0];
  const changed = structuredClone(one); changed.snapshot.room.listening.source = 'e1';
  assert.equal(f.api.importFile(JSON.stringify(exportLiveVariants([changed]))), 1);
  assert.deepEqual(f.current(), original);
  assert.equal(f.live.getState().variants[1].name, 'Система (2)');
  assert.equal(f.api.importFile(JSON.stringify(exportLiveVariants(f.live.getState().variants))), 0);
  const bad = exportLiveVariants([one]); bad.variants.push({ ...one, id: 'bad', name: 'Bad', snapshot: { version: 999 } });
  const before = f.storage.getItem(LIVE_SYSTEM_STORAGE_KEY);
  assert.throws(() => f.api.importFile(JSON.stringify(bad)), /формат/);
  assert.equal(f.storage.getItem(LIVE_SYSTEM_STORAGE_KEY), before);
  assert.deepEqual(f.current(), original);
  f.api.renameVariant(id, 'Музыка'); assert.equal(f.live.getState().variants[0].name, 'Музыка');
  f.api.deleteVariant(id); assert.equal(f.live.getState().variants.length, 1);
  f.api.restoreDeleted(); assert.equal(f.live.getState().variants.length, 2);
  assert.throws(() => f.api.saveVariant(' музыка '), /название/);
});

test('invalid versions, inputs, port IDs and shelf references cannot replace the project', () => {
  const f = fixture();
  const mutations = [
    s => { s.version = 999; },
    s => { s.workshop.activeVariant = '__proto__'; },
    s => { s.workshop.activeVariant = 'tv'; },
    s => { s.room.cables[0].to = 'unknown.port'; },
    s => { s.room.listening.inputs.warmer = 'bifrost.opt'; },
    s => { s.workshop.variants.rack.equipment[0].shelfId = 'absent'; },
  ];
  for (const mutate of mutations) { const bad = structuredClone(f.current()); mutate(bad); assert.throws(() => parseLiveSnapshot(bad)); }
  for (const text of ['{broken', JSON.stringify({ type: 'audio-setup-variants', version: 1, variants: [] }), 'я'.repeat(MAX_LIVE_BYTES / 2 + 1)]) assert.throws(() => f.api.importFile(text));
  assert.equal(f.live.getState().variants.length, 0);
});

test('corrupt saved data is preserved verbatim before saving a replacement library', () => {
  for (const raw of ['', '{broken', '{"version":999}']) {
    const f = fixture(disk([[LIVE_SYSTEM_STORAGE_KEY, raw]]));
    assert.ok(f.live.getState().storageError);
    assert.equal(f.storage.getItem(LIVE_SYSTEM_STORAGE_KEY), raw);
    f.api.saveVariant('Recovered');
    assert.equal(f.live.getState().storageError, '');
    assert.equal([...f.storage.values].find(([key]) => key.startsWith(`${LIVE_SYSTEM_STORAGE_KEY}-recovery-`))[1], raw);
    assert.equal(fixture(f.storage).live.getState().variants[0].name, 'Recovered');
  }
});

test('a failed write cannot partially restore a variant or move the undo cursor', () => {
  const f = fixture(), id = f.api.saveVariant('Original');
  f.room.getState().preset('warmer'); f.workshop.getState().switchVariant('tv');
  const before = f.current(), past = f.live.getState().past;
  const originalSet = f.storage.setItem;
  f.storage.setItem = (key, value) => { if (key === LIVE_SYSTEM_STORAGE_KEY) throw new Error('quota'); originalSet(key, value); };
  assert.equal(f.api.loadVariant(id), false); assert.deepEqual(f.current(), before);
  assert.equal(f.api.undo(), false); assert.deepEqual(f.live.getState().past, past);
  assert.equal(f.api.saveVariant('Cannot save'), null);
  assert.ok(f.live.getState().storageError);
  assert.equal(f.live.getState().variants.length, 1);
  f.storage.setItem = originalSet;
  assert.equal(f.api.retrySave(), true);
  assert.equal(f.api.loadVariant(id), true);
  assert.equal(fixture(f.storage).current().workshop.activeVariant, 'rack');
});

test('failed persistence of an ordinary edit stays exportable and retries as one coherent snapshot', () => {
  const f = fixture(); f.api.saveVariant('Original');
  const originalSet = f.storage.setItem;
  f.storage.setItem = () => { throw new Error('quota'); };
  f.room.getState().setListening({ source: 'e1' });
  f.workshop.getState().switchVariant('tv');
  const edited = f.current();
  assert.deepEqual(f.live.getState().current, edited);
  assert.ok(f.live.getState().storageError);
  assert.doesNotThrow(() => exportLiveVariants([{ id: 'now', name: 'Now', snapshot: edited }]));
  f.storage.setItem = originalSet; f.api.retrySave();
  assert.deepEqual(fixture(f.storage).current(), edited);
});

test('unread storage and recovery collision never destroy the original record', () => {
  const storage = disk([[LIVE_SYSTEM_STORAGE_KEY, '{broken'], [`${LIVE_SYSTEM_STORAGE_KEY}-recovery-v2`, 'previous']]);
  const f = fixture(storage); assert.equal(f.api.saveVariant('Test'), null);
  assert.equal(storage.getItem(LIVE_SYSTEM_STORAGE_KEY), '{broken');
  let blocked = true;
  const g = createLiveSystemStore(f.room, f.workshop, () => { if (blocked) throw new Error('denied'); return storage; });
  blocked = false;
  assert.equal(g.getState().saveVariant('Test'), null);
  assert.equal(storage.getItem(LIVE_SYSTEM_STORAGE_KEY), '{broken');
});

test('variant limit is enforced before import/save and saved library is independent of later edits', () => {
  const f = fixture();
  for (let i = 0; i < MAX_VARIANTS; i++) f.api.saveVariant(`V${i}`);
  const before = f.storage.getItem(LIVE_SYSTEM_STORAGE_KEY);
  assert.throws(() => f.api.saveVariant('Extra'), /24/);
  const imported = { ...f.live.getState().variants[0], name: 'Extra' };
  assert.throws(() => f.api.importFile(JSON.stringify(exportLiveVariants([imported]))), /24/);
  assert.equal(f.storage.getItem(LIVE_SYSTEM_STORAGE_KEY), before);
  f.room.getState().setListening({ source: 'e1' });
  assert.equal(f.live.getState().variants[0].snapshot.room.listening.source, 'wiim');
});
