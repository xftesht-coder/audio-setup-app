import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_PORT_MAP } from '../src/data/roomEquipment.js';
import { roomPreset } from '../src/data/roomWiring.js';
import { roomPatchRows } from '../src/data/roomPatchView.js';
import { roomRackLayout, roomCableStyle } from '../src/data/roomRackLayout.js';

test('diagram keeps exact cable endpoints and both shared speaker branches in every preset and layer', () => {
  for (const preset of ['a90', 'bifrost', 'warmer']) for (const kind of ['all', 'audio', 'power', 'ground']) {
    const rows = roomPatchRows(roomPreset(preset), { kind }), original = JSON.stringify(rows);
    const layout = roomRackLayout(rows, { kind });
    assert.equal(layout.wires.length, rows.length);
    for (const wire of layout.wires) {
      assert.equal(wire.start, layout.ports[wire.from]);
      assert.equal(wire.end, layout.ports[wire.to]);
      assert.ok(!/NaN|undefined|Infinity/.test(wire.d));
      for (const p of [wire.start, wire.end]) assert.ok(p.x >= 0 && p.y >= 0 && p.x <= layout.width && p.y <= layout.height);
    }
    if (kind === 'audio') {
      assert.deepEqual(layout.wires.find(w => w.id === 'speaker0').start, layout.wires.find(w => w.id === 'sub0').start);
      assert.notEqual(layout.wires.find(w => w.id === 'speaker0').end, layout.wires.find(w => w.id === 'sub0').end);
    }
    assert.equal(JSON.stringify(rows), original);
  }
});
test('loose diagram ends remain distinct from occupied ports and retain HIGH LEVEL identity', () => {
  for (const end of ['from', 'to']) {
    const c = { ...roomPreset('warmer').find(c => c.id === 'sub0'), [end]: null };
    const layout = roomRackLayout([c], { kind: 'loose' }), w = layout.wires[0];
    assert.equal(w.loose, true);
    assert.equal(w.style.name, 'HIGH LEVEL → XLR · по владельцу');
    const anchor = ROOM_PORT_MAP[c.from || c.to];
    assert.ok(layout.cards.some(card => card.id === anchor.device));
    assert.notDeepEqual(w.start, w.end);
  }
  assert.notEqual(roomCableStyle({ from: 'rusich.speaker0', to: 'rel0.hi' }).name, roomCableStyle({ from: 'bifrost.xlrOut', to: 'freya.xlr1' }).name);
});
test('an empty diagram can expose unconnected sockets without manufacturing connections', () => {
  assert.equal(roomRackLayout([], { kind: 'audio' }).cards.length, 0);
  const all = roomRackLayout([], { kind: 'audio', showIdle: true });
  assert.equal(all.wires.length, 0);
  for (const id of ['a90', 'freya', 'bifrost', 'warmer']) assert.ok(all.cards.some(c => c.id === id));
  assert.ok(Object.keys(all.ports).every(id => !['power', 'ground'].includes(ROOM_PORT_MAP[id].signal)));
});

test('compact ports retain every wire, shared branch and loose end inside the canvas', () => {
  for (const preset of ['a90', 'bifrost', 'warmer']) {
    const rows = roomPatchRows(roomPreset(preset), { kind: 'audio' });
    const compact = roomRackLayout(rows, { connectedOnly: true });
    const expected = [...new Set(rows.flatMap(c => [c.from, c.to]).filter(Boolean))].sort();
    assert.deepEqual(Object.keys(compact.ports).sort(), expected);
    assert.equal(compact.wires.length, rows.length);
    assert.equal(compact.wires.find(w => w.id === 'speaker0').start, compact.wires.find(w => w.id === 'sub0').start);
    assert.ok(compact.cards.find(c => c.id === 'ae0').column === compact.cards.find(c => c.id === 'rel0').column);
    for (const row of rows) for (const end of ['from', 'to']) {
      const layout = roomRackLayout([{ ...row, [end]: null }], { kind: 'loose', connectedOnly: true });
      for (const p of [layout.wires[0].start, layout.wires[0].end]) assert.ok(p.x >= 0 && p.y >= 0 && p.x <= layout.width && p.y <= layout.height);
    }
  }
  const idle = roomRackLayout([], { showIdle: true, connectedOnly: true });
  assert.ok(idle.ports['freya.xlr1']);
  assert.equal(idle.wires.length, 0);
});
