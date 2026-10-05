import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SYSTEM_PLAN } from '../src/data/audioModels.js';
import { assessSystem, parseSystemPlan, systemPlanFromSearch, systemShareUrl } from '../src/data/systemMatching.js';
import { comparisonValues, exportVariants, importVariants, MAX_VARIANTS } from '../src/data/systemVariants.js';
import { createSystemPlanStore, SYSTEM_STORAGE_KEY } from '../src/stores/useSystemPlanStore.js';

const warmer = { ...DEFAULT_SYSTEM_PLAN, dac: 'fiio-warmer-r2r', transport: 'COAXIAL' };
const variant = (id = 'one', name = 'WARMER + Freya') => ({ id, name, plan: { ...warmer } });
function fixture(initial = {}) {
  const data = new Map(Object.entries(initial)); let nextId = 0;
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const store = createSystemPlanStore(() => storage, () => `test-${++nextId}`);
  return { store, data, storage };
}
test('existing listening plan migrates without changing it, variants survive reload independently of live edits', () => {
  const { store, storage, data } = fixture({ 'audio-system-plan-v1': JSON.stringify(warmer) });
  assert.deepEqual(store.getState().plan, warmer);
  const id = store.getState().saveVariant('  Мой WARMER  ');
  store.getState().update({ dac: 'schiit-bifrost-3' });
  const restored = createSystemPlanStore(() => storage).getState();
  assert.equal(restored.plan.dac, 'schiit-bifrost-3');
  assert.equal(restored.variants[0].name, 'Мой WARMER');
  assert.deepEqual(restored.variants[0].plan, warmer);
  restored.loadVariant(id);
  assert.deepEqual(JSON.parse(data.get(SYSTEM_STORAGE_KEY)).plan, warmer);
  assert.ok(data.has('audio-system-plan-v1'));
});
test('undo/redo and loading snapshots keep the library intact, new edits clear redo history', () => {
  const { store } = fixture(); const api = store.getState();
  const id = api.saveVariant('Bifrost'); api.update(warmer); api.undo();
  assert.deepEqual(store.getState().plan, DEFAULT_SYSTEM_PLAN);
  api.redo(); assert.deepEqual(store.getState().plan, warmer);
  api.loadVariant(id); api.undo(); assert.deepEqual(store.getState().plan, warmer);
  api.update({ preamp: 'owner-a90' }); assert.equal(store.getState().future.length, 0);
  assert.deepEqual(store.getState().variants[0].plan, DEFAULT_SYSTEM_PLAN);
  assert.throws(() => api.saveVariant(' BIFROST '), /название/);
  api.deleteVariant(id); assert.equal(store.getState().variants.length, 0);
  api.restoreDeleted(); assert.equal(store.getState().variants[0].id, id);
});
test('backup import merges without replacing existing plans, deduplicates and validates the whole file first', () => {
  const { store } = fixture(); const api = store.getState(); api.saveVariant('Bifrost');
  const original = store.getState().plan;
  const text = exportVariants([variant()]);
  assert.equal(api.importFile(text), 1); assert.equal(api.importFile(text), 0);
  assert.deepEqual(store.getState().plan, original);
  const before = store.getState().variants;
  const bad = JSON.parse(text); bad.variants.push({ ...variant('bad'), plan: { ...warmer, dac: 'not-a-model' } });
  assert.throws(() => api.importFile(JSON.stringify(bad)), /неизвестный/);
  assert.deepEqual(store.getState().variants, before);
  assert.equal(importVariants(exportVariants(before), []).length, 2);
  assert.throws(() => api.importFile(JSON.stringify({ ...bad, version: 300 })), /поддерживаемый/);
  assert.throws(() => api.importFile('x'.repeat(129 * 1024)), /большой/);
});
test('variant count limit rejects import transaction without losing current variants', () => {
  const { store } = fixture(); const api = store.getState();
  for (let i = 0; i < MAX_VARIANTS; i++) api.saveVariant(`Вариант ${i}`);
  assert.throws(() => api.importFile(exportVariants([variant()])), /24/);
  assert.equal(store.getState().variants.length, MAX_VARIANTS);
  assert.throws(() => api.saveVariant('Ещё'), /24/);
});
test('blocked storage keeps usable in-memory edits and surfaces the persistence failure', () => {
  const store = createSystemPlanStore(() => { throw new Error('denied'); }, () => 'new');
  assert.ok(store.getState().storageError);
  store.getState().update(warmer); store.getState().saveVariant('Offline');
  assert.deepEqual(store.getState().plan, warmer);
  assert.equal(store.getState().variants.length, 1);
  assert.match(store.getState().storageError, /не сохранил/);
  assert.ok(exportVariants(store.getState().variants));
  const raw = JSON.stringify({ version: 999, plan: warmer, variants: [] });
  const { store: corrupt, data } = fixture({ [SYSTEM_STORAGE_KEY]: raw });
  assert.ok(corrupt.getState().storageError); assert.equal(data.get(SYSTEM_STORAGE_KEY), raw);
});
test('named share links round-trip but malformed, partial and unknown plans never silently turn into another system', () => {
  const url = new URL(systemShareUrl(warmer, 'https://audio-setup-app.vercel.app', 'WARMER & Freya'));
  assert.equal(url.searchParams.get('name'), 'WARMER & Freya');
  assert.deepEqual(systemPlanFromSearch(url.search), warmer);
  for (const bad of [null, [], {}, { ...warmer, dac: '__proto__' }, { ...warmer, futureMode: true }, { ...warmer, powerAmpQuantity: '2' }]) {
    assert.throws(() => parseSystemPlan(bad));
    assert.equal(systemPlanFromSearch(`?system=${encodeURIComponent(JSON.stringify(bad))}`), null);
  }
  assert.equal(systemPlanFromSearch(''), null);
});
test('signal graph keeps the headphone branch separate through source, EQ and preamp changes', () => {
  for (const sourceMode of ['digital', 'vinyl', 'wiimAnalog']) {
    const result = assessSystem({ ...warmer, sourceMode, eq: 'schiit-lokius' });
    const main = result.links.filter(l => l.branch === 'speakers'), headphones = result.links.filter(l => l.branch === 'headphones');
    assert.equal(main.at(-1).to.id, 'ae320');
    for (let i = 1; i < main.length; i++) assert.equal(main[i - 1].to.id, main[i].from.id);
    assert.equal(headphones.length, 1); assert.equal(headphones[0].from.id, warmer.preamp); assert.equal(headphones[0].to.id, 'owner-a90');
  }
  assert.equal(assessSystem({ ...warmer, preamp: 'owner-a90' }).links.filter(l => l.branch === 'headphones').length, 0);
  assert.equal(assessSystem({ ...warmer, headphoneAmp: null }).links.filter(l => l.branch === 'headphones').length, 0);
  const rows = Object.fromEntries(comparisonValues({ ...warmer, sourceMode: 'vinyl' }));
  assert.match(rows['ЦАП'], /вне тракта/);
  assert.equal(rows['WiiM → ЦАП'], 'Не используется');
});
