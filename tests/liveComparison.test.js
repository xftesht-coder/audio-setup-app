import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomWiringStore } from '../src/store/roomWiringStore.js';
import { createWorkshopStore } from '../src/stores/useWorkshopStore.js';
import { captureLiveSystem } from '../src/data/liveSystem.js';
import { compareLiveSystems } from '../src/data/liveComparison.js';
import { ROOM_PORT_MAP } from '../src/data/roomEquipment.js';

function fixture() {
  const storage = () => ({ getItem: () => null, setItem: () => {} });
  const room = createRoomWiringStore(storage), workshop = createWorkshopStore(storage);
  return { room, workshop, snapshot: () => captureLiveSystem(room.getState(), workshop.getState()) };
}
function selected(snapshot) {
  snapshot.room.listening.mode = 'selected';
  for (const c of snapshot.room.cables) {
    const p = ROOM_PORT_MAP[c.to];
    if (Object.hasOwn(snapshot.room.listening.inputs, p?.device) && ['line', 'phono', 'digital', 'usb'].includes(p.signal)) snapshot.room.listening.inputs[p.device] = p.id;
  }
  return snapshot;
}
const rackRows = report => report.racks.flatMap(g => g.rows);

test('self-comparison has no changes and keeps unknown conditions explicit', () => {
  const a = fixture().snapshot(), report = compareLiveSystems(a, a);
  assert.equal(report.changed, 0);
  for (const key of ['added', 'removed', 'changed']) assert.deepEqual(report.findings[key], []);
  assert.ok(report.findings.unchanged.filter(f => f.after.level === 'unknown').length >= 4);
  assert.ok(report.routes.every(r => r.before === 'possible' && r.after === 'possible'));
});

test('array/object ordering and recreated connected cable IDs do not invent changes', () => {
  const a = fixture().snapshot(), b = structuredClone(a);
  b.room.cables.reverse(); b.room.cables.find(c => c.id === 'digital').id = 'recreated';
  const p = b.workshop.variants.rack;
  p.shelves.reverse(); p.equipment.reverse(); p.cables.reverse();
  b.room.listening.inputs = Object.fromEntries(Object.entries(b.room.listening.inputs).reverse());
  const report = compareLiveSystems(a, b);
  assert.equal(report.changed, 0);
  assert.equal(report.findings.changed.length, 0);
  assert.equal(report.findings.added.length, 0);
});

test('removed optical connection breaks four paths; reverse comparison reports additions and absent findings', () => {
  const f = fixture(), a = f.snapshot();
  f.room.getState().remove('digital'); const b = f.snapshot();
  const report = compareLiveSystems(a, b), reverse = compareLiveSystems(b, a);
  assert.equal(report.cables.length, 1); assert.equal(report.cables[0].kind, 'removed');
  assert.deepEqual(report.cables[0].beforeHint, { cable: 'digital' });
  assert.ok(report.routes.every(r => r.after === 'missing'));
  assert.equal(report.findings.added.filter(f => f.id.startsWith('missing-')).length, 4);
  assert.equal(reverse.cables[0].kind, 'added');
  assert.equal(reverse.findings.removed.filter(f => f.id.startsWith('missing-')).length, 4);
});

test('free plugs retain their connector, location and inspection target without mutating either snapshot', () => {
  const f = fixture(), a = f.snapshot(); f.room.getState().unplug('digital', 'to'); const b = f.snapshot();
  const bytes = JSON.stringify([a, b]), report = compareLiveSystems(a, b);
  assert.equal(JSON.stringify([a, b]), bytes);
  assert.equal(report.cables[0].kind, 'changed');
  assert.match(report.cables[0].after, /Свободный конец.*OPTICAL.*точка/);
  assert.deepEqual(report.findings.added.find(f => f.id === 'loose-digital').afterHint, { cable: 'digital' });
  assert.equal(b.room.cables.find(c => c.id === 'digital').to, null);
});

test('an unknown input becoming wrong is a changed finding, not a resolved problem or confirmed compatibility', () => {
  const a = selected(fixture().snapshot()); a.room.listening.inputs.bifrost = null;
  const b = structuredClone(a); b.room.listening.inputs.bifrost = 'bifrost.coax';
  const report = compareLiveSystems(a, b), finding = report.findings.changed.find(f => f.id === 'input-bifrost.opt');
  assert.equal(finding.before.level, 'unknown'); assert.equal(finding.after.level, 'issue');
  assert.equal(report.inputs.length, 1); assert.equal(report.inputs[0].before, 'Не указан');
  assert.ok(report.routes.every(r => r.before === 'unknown' && r.after === 'blocked'));
  assert.deepEqual(finding.afterHint, { device: 'bifrost' });
});

test('different audit modes are exposed and power/GND failures are assessed independently from audio routes', () => {
  const a = selected(fixture().snapshot()), b = structuredClone(a);
  b.room.listening.mode = 'possible';
  b.room.cables = b.room.cables.filter(c => c.to !== 'wiim.power');
  const report = compareLiveSystems(a, b);
  assert.deepEqual(report.modes, ['selected', 'possible']);
  assert.ok(report.inputs.some(r => r.id === 'mode'));
  assert.deepEqual(report.findings.added.find(f => f.id === 'power-wiim').afterHint, { device: 'wiim', kind: 'power' });
  assert.ok(report.routes.every(r => r.after === 'possible'));
  const vinyl = structuredClone(a); vinyl.room.listening.source = 'e1';
  const noGround = structuredClone(vinyl); noGround.room.cables = noGround.room.cables.filter(c => c.from !== 'e1.ground');
  assert.ok(compareLiveSystems(vinyl, noGround).findings.added.some(f => f.id === 'ground'));
});

test('rack diff covers geometry, materials, drilling, equipment and cable constraints with units', () => {
  const a = fixture().snapshot(), b = structuredClone(a), p = b.workshop.variants.rack;
  p.width += 10; p.material = 'oak'; p.shelves[0].y += 5;
  p.shelves[0].holes.push({ id: 'drill', x: 30, z: 40, diameter: 18 });
  p.equipment[0].x += 12; p.cables[0].bendRadius += 10; p.cables[0].waypoints = [[0, 100, -300]];
  const rows = rackRows(compareLiveSystems(a, b));
  for (const label of ['Ширина, мм', 'Материал', 'Высота, мм', 'Отверстие', 'Смещение X, мм', 'Радиус изгиба, мм', 'Точки трассы XYZ, мм']) assert.ok(rows.some(r => r.label.includes(label)), label);
  assert.ok(rows.some(r => r.after.includes('18 мм')));
  assert.ok(rows.some(r => r.after === '(0, 100, -300)'));
});

test('active-rack switches and edits to inactive saved racks are both visible', () => {
  const f = fixture(); f.workshop.getState().switchVariant('tv'); f.workshop.getState().switchVariant('rack');
  const a = f.snapshot(); f.workshop.getState().switchVariant('tv'); const b = f.snapshot();
  const report = compareLiveSystems(a, b);
  assert.ok(report.racks[0].rows.some(r => r.id === 'active' && r.after.includes('ТВ')));
  assert.ok(report.racks[0].rows.some(r => r.id === 'rack/width'));
  const c = structuredClone(b); c.workshop.variants.rack.depth += 10;
  const inactive = compareLiveSystems(b, c);
  assert.equal(inactive.racks[0].rows.length, 0);
  assert.ok(inactive.racks.find(g => g.id === 'rack').rows.some(r => r.id === 'rack/depth'));
});

test('device replacements report actual rewiring and component choices; invalid snapshots are rejected', () => {
  const f = fixture(), a = f.snapshot(); f.room.getState().preset('warmer'); const b = f.snapshot();
  const report = compareLiveSystems(a, b);
  assert.ok(report.cables.some(r => r.after.includes('WARMER')));
  assert.ok(report.inputs.some(r => r.id === 'component-preamp' && r.after.includes('Freya')));
  assert.ok(report.inputs.some(r => r.id === 'component-dac'));
  const bad = structuredClone(b); bad.room.listening.inputs.bifrost = 'unknown';
  assert.throws(() => compareLiveSystems(a, bad));
});
