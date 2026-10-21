import test from 'node:test';
import assert from 'node:assert/strict';
import { routingScene, routingTrace } from '../src/data/routingScene.js';
import { roomPatchRows } from '../src/data/roomPatchView.js';
import { roomPreset } from '../src/data/roomWiring.js';
import { auditRoom } from '../src/data/roomIntelligence.js';
import { defaultListening } from '../src/data/roomListening.js';
import { ROOM_PORT_MAP } from '../src/data/roomEquipment.js';
import { APP_SECTIONS, sectionForHash } from '../src/data/appSections.js';

test('every cable keeps its actual device endpoints in landscape and portrait, for every preset and layer', () => {
  for (const preset of ['a90','bifrost','warmer']) for (const kind of ['audio','power','ground','all']) for (const portrait of [true,false]) {
    const cables = roomPreset(preset), before = JSON.stringify(cables), rows = roomPatchRows(cables,{kind});
    const scene = routingScene(rows,{kind,portrait});
    assert.equal(scene.wires.length, rows.length);
    for (const wire of scene.wires) {
      assert.deepEqual(wire.points[0], scene.ports[wire.from].position);
      assert.deepEqual(wire.points.at(-1), scene.ports[wire.to].position);
      assert.equal(wire.fromNode, ROOM_PORT_MAP[wire.from].device);
      assert.equal(wire.toNode, ROOM_PORT_MAP[wire.to].device);
      assert.ok(wire.points.every(p => p.length === 3 && p.every(Number.isFinite)));
      assert.ok(!wire.loose);
    }
    assert.equal(JSON.stringify(cables), before);
    assert.ok(Number.isFinite(scene.width) && Number.isFinite(scene.depth));
  }
});

test('AE320 and REL share each Rusich speaker output; HIGH LEVEL is never shown as a line output', () => {
  const scene = routingScene(roomPatchRows(roomPreset('a90'),{kind:'audio'}));
  for (const channel of [0,1]) {
    const speaker = scene.wires.find(w => w.to === `ae${channel}.in`), sub = scene.wires.find(w => w.to === `rel${channel}.hi`);
    assert.equal(speaker.from, `rusich.speaker${channel}`); assert.equal(sub.from,speaker.from);
    assert.deepEqual(sub.points[0],speaker.points[0]);
    assert.equal(sub.style.name, 'HIGH LEVEL → XLR · по владельцу');
  }
});

test('source and destination traces match audit paths and never claim a missing route', () => {
  const cables=roomPreset('a90'), listening=defaultListening();
  const report=auditRoom(cables,'wiim',listening), target=report.routes.find(r=>r.name.includes('REL') && r.name.includes('L'));
  const trace=routingTrace(report,'wiim',target.id);
  assert.deepEqual([...trace.cables],target.path.map(c=>c.id));
  assert.ok(trace.devices.has('wiim')); assert.ok(!trace.devices.has('e1'));
  const broken=auditRoom(cables.filter(c=>c.id!=='digital'),'wiim',listening);
  assert.equal(routingTrace(broken,'wiim',target.id).cables.size,0);
  const vinyl=auditRoom(cables,'e1',{...listening,source:'e1'});
  assert.ok(routingTrace(vinyl,'e1').devices.has('skoll'));
  assert.ok(!routingTrace(vinyl,'e1').devices.has('bifrost'));
});

test('free ends remain visible in the break layer; empty search and idle devices never create cables', () => {
  const cables=roomPreset('a90').map(c=>c.id==='digital'?{...c,to:null}:c);
  const scene=routingScene(roomPatchRows(cables,{kind:'loose'}),{kind:'loose'});
  assert.equal(scene.wires.length,1); assert.ok(scene.wires[0].loose);
  assert.equal(scene.wires[0].toNode,undefined); assert.equal(scene.wires[0].points.length,2);
  assert.ok(scene.nodes.some(n=>n.id==='wiim'));
  const empty=routingScene([]); assert.equal(empty.nodes.length,0); assert.equal(empty.wires.length,0);
  const idle=routingScene([],{showIdle:true}); assert.ok(idle.nodes.some(n=>n.id==='freya')); assert.equal(idle.wires.length,0);
});

test('catalog sections are hidden and old links still lead to a working workspace', () => {
  assert.deepEqual(APP_SECTIONS.map(([id])=>id),['patch','room','intelligence','cabinet']);
  assert.equal(sectionForHash('#system'),'patch'); assert.equal(sectionForHash('#lighting'),'room');
  assert.equal(sectionForHash('#intelligence'),'intelligence'); assert.equal(sectionForHash(''),'patch');
});
