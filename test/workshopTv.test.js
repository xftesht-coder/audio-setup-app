import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProject, projectSchema, validateConstruction, postCenters, shelfHoles, manufacturingBOM } from '../src/data/workshop.js';
import { completeListeningRack } from '../src/data/equipmentProfiles.js';
import { tvConsoleProject } from '../src/data/workshopTv.js';
import { televisionEnvelope, televisionBox } from '../src/data/television.js';
import { routeAllCables } from '../src/data/cableRouting.js';
import { drillingCSV, projectDXF, reviewHTML } from '../src/data/workshopExport.js';

const rack = () => completeListeningRack(defaultProject());
test('TV variant keeps every device and cable, makes exactly two levels and six supports', () => {
  const original = rack(), before = structuredClone(original), p = tvConsoleProject(original);
  assert.deepEqual(original, before);
  assert.equal(p.shelves.length, 2);
  assert.equal(postCenters(p).length, 6);
  assert.deepEqual(p.equipment.map(e => e.id), original.equipment.map(e => e.id));
  assert.deepEqual(p.cables, original.cables);
  assert.equal(p.equipment.find(e => e.id === 'turntable').shelfId, 'tv_upper');
  assert.equal(p.equipment.find(e => e.id === 'rusich_a2').shelfId, 'tv_lower');
  assert.deepEqual(validateConstruction(p).filter(i => i.severity === 'error'), []);
  assert.ok(validateConstruction(p).some(i => i.message.includes('Модель, масса')));
  assert.deepEqual(projectSchema.parse(JSON.parse(JSON.stringify(p))), p);
});

test('TV is a nominal 16:9 screen on editable feet; raising the shelf raises the TV', () => {
  const p = tvConsoleProject(rack()), d = televisionEnvelope(p.television), before = televisionBox(p);
  assert.ok(Math.abs(Math.hypot(d.screenWidth, d.screenHeight) - 65 * 25.4) < 1e-7);
  p.shelves[1].y += 100;
  assert.equal(televisionBox(p).center[1] - before.center[1], 100);
  p.television.x = 1000;
  assert.ok(validateConstruction(p).some(i => i.message.includes('ножки выходят')));
  p.television.x = -400;
  assert.ok(validateConstruction(p).some(i => i.message.includes('ТВ: пересечение')));
  for (const value of [NaN, -10, 10000]) assert.equal(projectSchema.safeParse({ ...p, television: { ...p.television, footDepth: value } }).success, false);
});

test('TV hardware quantities, drilling and exports agree; TV stays a declared assumption', () => {
  const p = tvConsoleProject(rack()), bom = manufacturingBOM(p);
  assert.equal(bom.find(r => r.part === 'Шпилька M16').quantity, 6);
  assert.equal(bom.find(r => r.part.startsWith('Гайка M16')).quantity, 24);
  assert.equal(bom.find(r => r.part.startsWith('Опора M16')).quantity, 6);
  assert.equal(shelfHoles(p, p.shelves[0]).length, 6);
  assert.equal(projectDXF(p).match(/\nCIRCLE\n/g).length, 12);
  assert.equal(drillingCSV(p).split('\r\n').length, 13);
  assert.ok(reviewHTML(p).includes('на ножках'));
  assert.ok(reviewHTML(p).includes('проектные допущения'));
  assert.equal(postCenters(defaultProject()).length, 4);
});

test('low shelf service loops retain bend radii and show short cables without silently extending them', () => {
  const p = tvConsoleProject(rack());
  const routes = routeAllCables(p);
  assert.ok(routes.some(r => r.issues.some(i => i.includes('Кабель короток'))));
  for (const r of routes) {
    assert.ok(r.points.flat().every(Number.isFinite));
    assert.deepEqual(r.issues.filter(i => !i.includes('Кабель короток')), [], r.cable.id);
    assert.ok(r.points.every(pt => pt[1] >= r.cable.diameter / 2));
  }
});

let instance = 0;
async function fresh(values) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value),
  } });
  return (await import('../src/stores/useWorkshopStore.js?tvtest=' + ++instance)).useWorkshopStore;
}
test('legacy furniture and both edited variants survive switching, undo and reload independently', async () => {
  const legacy = rack(); legacy.width = 710;
  const raw = JSON.stringify(legacy), values = new Map([['audio_workshop_v1', raw]]);
  let store = await fresh(values);
  assert.equal(store.getState().project.width, 710);
  store.getState().switchVariant('tv');
  assert.equal(store.getState().project.shelves.length, 2);
  store.getState().editTelevision({ footSpan: 1100 });
  store.getState().undo(); assert.equal(store.getState().project.television.footSpan, 1000);
  store.getState().redo(); assert.equal(store.getState().project.television.footSpan, 1100);
  store.getState().switchVariant('rack');
  assert.deepEqual(store.getState().project, projectSchema.parse(legacy));
  store.getState().update({ material: 'oak' });
  store = await fresh(values);
  assert.equal(store.getState().project.material, 'oak');
  store.getState().switchVariant('tv');
  assert.equal(store.getState().project.television.footSpan, 1100);
  assert.equal(store.getState().project.material, 'walnut');
  assert.equal(values.get('audio_workshop_v1'), raw);
});

test('an overfull two-level plan is rejected without modifying the current project or adding a partial variant', async () => {
  const p = rack();
  for (let i = 0; i < 8; i++) p.equipment.push({ id: 'extra' + i, modelId: 'schiit-freya_2', shelfId: p.shelves[0].id, x: 0, z: 0 });
  const values = new Map([['audio_workshop_v1', JSON.stringify(p)]]);
  const store = await fresh(values), before = structuredClone(store.getState().project);
  store.getState().switchVariant('tv');
  assert.equal(store.getState().activeVariant, 'rack');
  assert.deepEqual(store.getState().project, before);
  assert.equal(store.getState().variants.tv, undefined);
  assert.ok(store.getState().editError.includes('не помещается'));
});
