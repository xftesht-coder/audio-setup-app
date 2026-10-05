import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProject, projectSchema, validateConstruction, shelfHoles, manufacturingBOM } from '../src/data/workshop.js';
import { roundedRoute, routeAllCables, routeCable, pathLength } from '../src/data/cableRouting.js';
import { bomCSV, drillingCSV, panelSVG, projectDXF, reviewHTML } from '../src/data/workshopExport.js';

test('default project has 12 feasible supported cable routes clear of the furniture and chassis', () => {
  const p = defaultProject();
  assert.deepEqual(validateConstruction(p).filter(i => i.severity === 'error'), []);
  assert.ok(validateConstruction(p).some(i => i.message.includes('глубина корпуса')));
  const routes = routeAllCables(p);
  assert.equal(routes.length, 12);
  for (const r of routes) {
    assert.deepEqual(r.issues, [], r.cable.id);
    assert.ok(r.points.flat().every(Number.isFinite));
    assert.ok(r.radius >= r.cable.bendRadius);
    assert.ok(r.supports.length >= 2);
    assert.ok(r.length + r.cable.reserve < r.cable.available);
    assert.ok(Math.abs(r.mass - ((r.length - 2 * r.cable.connectorLength) * r.cable.massPerM / 1000 + 2 * r.cable.connectorMass)) < 1e-8);
    for (let i = 1; i < r.supports.length; i++) assert.ok(Math.hypot(...r.supports[i].map((v, j) => v - r.supports[i - 1][j])) <= r.cable.supportSpan + 0.001);
  }
});

test('fillet is a true tangent circular arc of the requested radius', () => {
  const r = roundedRoute([[0, 0, 0], [200, 0, 0], [200, 200, 0]], 50);
  assert.equal(r.feasible, true);
  const arc = r.points.filter(p => p[0] > 150 && p[1] < 50);
  assert.ok(arc.length > 8);
  for (const p of arc) assert.ok(Math.abs(Math.hypot(p[0] - 150, p[1] - 50) - 50) < 1e-8);
  assert.ok(Math.abs(pathLength(r.points) - (300 + Math.PI * 25)) < 0.1);
  assert.equal(roundedRoute([[0, 0, 0], [20, 0, 0], [20, 20, 0]], 50).feasible, false);
});

test('short cables, impossible bends and intersecting manual routes are rejected visibly', () => {
  const p = defaultProject(), c = p.cables[0];
  assert.ok(routeCable(p, { ...c, available: 100 }).issues.some(i => i.includes('короток')));
  assert.ok(routeCable(p, { ...c, bendRadius: 300 }).issues.some(i => i.includes('радиуса')));
  const through = routeCable(p, { ...c, waypoints: [[0, 700, 0], [0, 300, 0]] });
  assert.ok(through.issues.some(i => i.includes('Пересечение')));
  assert.ok(through.issues.some(i => i.includes('излом')));
});

test('moving shelf or equipment updates endpoints and real intersections', () => {
  const p = defaultProject(), r0 = routeAllCables(p)[0];
  p.shelves.at(-1).y += 75;
  const r1 = routeAllCables(p)[0];
  assert.equal(r1.connectors[0][0][1] - r0.connectors[0][0][1], 75);
  p.equipment.find(e => e.id === 'a90').x = -135;
  assert.ok(validateConstruction(p).some(i => i.message.includes('пересечение')));
  p.shelves[0].holes.push({ id: 'bad', x: 330, z: 0, diameter: 40 });
  assert.ok(validateConstruction(p).some(i => i.message.includes('краю')));
  p.shelves[0].holes.push({ id: 'bad2', ...shelfHoles(p, p.shelves[0])[0], automatic: undefined });
  assert.ok(validateConstruction(p).some(i => i.message.includes('отверстия')));
});

test('DXF, SVG and drilling list use the same dimensions, origins and hole counts', () => {
  const p = defaultProject();
  p.shelves[0].width = 720;
  p.shelves[0].holes.push({ id: 'custom', x: 80, z: -150, diameter: 40 });
  const dxf = projectDXF(p);
  assert.ok(dxf.includes('$INSUNITS\n70\n4'));
  assert.equal(dxf.match(/\nCIRCLE\n/g).length, 17);
  assert.ok(dxf.includes('\n10\n440\n20\n375\n30\n0\n40\n20\n'));
  assert.ok(panelSVG(p, p.shelves[0]).includes('cx="440" cy="75" r="20"'));
  assert.ok(drillingCSV(p).includes('"custom";"440";"375";"40";"32"'));
  assert.ok(bomCSV(p).includes('"32";"S24;'));
  assert.equal(manufacturingBOM(p).find(r => r.part.startsWith('Гайка')).quantity, 32);
});

test('project importer rejects invalid numbers, dangling references and unknown rear ports', () => {
  for (const mutation of [p => { p.width = NaN; }, p => { p.shelves = []; }, p => { p.cables = []; }, p => { p.equipment[0].shelfId = 'missing'; }, p => { p.cables[0].fromPort = 'invented'; }, p => { p.shelves.push(p.shelves[0]); }]) {
    const p = defaultProject(); mutation(p); assert.equal(projectSchema.safeParse(p).success, false);
  }
  assert.deepEqual(projectSchema.parse(JSON.parse(JSON.stringify(defaultProject()))), defaultProject());
});

test('manufacturing album escapes text and retains review status and assumptions', () => {
  const p = defaultProject(); p.name = '<script>alert(1)</script>';
  const html = reviewHTML(p);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('НЕ ВЫПУСК В ПРОИЗВОДСТВО'));
  assert.ok(html.includes('Нет чертежа изготовления рамы'));
});

let storeInstance = 0;
async function freshStore(saved = null) {
  let value = saved;
  const storage = { getItem: () => value, setItem: (_k, v) => { value = v; } };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  const { useWorkshopStore } = await import(`../src/stores/useWorkshopStore.js?test=${++storeInstance}`);
  return { store: useWorkshopStore, storage };
}
test('undo, redo, persistence and rejected edits preserve the coherent project', async () => {
  const { store, storage } = await freshStore();
  store.getState().resize('width', 720);
  assert.equal(store.getState().project.shelves[0].width, 720);
  store.getState().undo(); assert.equal(store.getState().project.width, 680);
  store.getState().redo(); assert.equal(store.getState().project.width, 720);
  assert.equal(store.getState().update({ width: -1 }), false);
  assert.equal(store.getState().project.width, 720);
  store.getState().removeShelf('tier_arcam'); assert.equal(store.getState().project.shelves.length, 5);
  store.getState().addShelf(); assert.equal(store.getState().project.shelves.length, 6);
  store.getState().removeShelf(store.getState().selection.id); assert.equal(store.getState().project.shelves.length, 5);
  const loaded = await freshStore(storage.getItem()); assert.equal(loaded.store.getState().project.width, 720);
});
