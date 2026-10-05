import test from 'node:test';
import assert from 'node:assert/strict';
import { DEVICE_SPECS, checkCompatibility } from '../src/data/devicePorts.js';
import { REL_QUAKE } from '../src/data/listeningRoom.js';
import { DEFAULT_SYSTEM_PLAN } from '../src/data/audioModels.js';
import { assessSystem } from '../src/data/systemMatching.js';

const port = (device, id) => DEVICE_SPECS[device].ports.find(p => p.id === id);

test('owner REL connections share speaker outputs, preserving unknown pinout and stock passport', () => {
  const result = assessSystem(DEFAULT_SYSTEM_PLAN);
  const subs = result.links.filter(l => l.branch === 'subwoofers');
  assert.equal(subs.length, 2);
  assert.ok(subs.every(l => l.from.id === 'owner-rusich' && l.signal === 'speaker' && l.sourceConnector === 'BINDING_POST' && l.parallelWith === 'ae320'));
  assert.ok(subs.every(l => l.provenance === 'owner-reported' && l.status === 'unknown'));
  assert.equal(REL_QUAKE.installedHighLevelConnector.pinout, null);
  assert.equal(REL_QUAKE.highLevelConnector, 'Neutrik Speakon');
});

test('a line-level XLR cannot be mistaken for the owner high-level XLR', () => {
  const hi = port('sub_left', 'sub_left_hi');
  const line = port('dac_fiio', 'fiio_out_xlr');
  assert.equal(checkCompatibility(line, hi).compatible, false);
  assert.equal(checkCompatibility(hi, line).compatible, false);
  const result = checkCompatibility(port('rusich_a2', 'rusich_speakers'), hi);
  assert.equal(result.compatible, true);
  assert.equal(result.electricallyVerified, false);
  assert.equal(result.connectorType, 'XLR_HIGH_LEVEL');
  assert.equal(checkCompatibility({ id: 'other-speakers', type: 'SPEAKER', direction: 'output' }, hi).compatible, false);
});

test('replacing Rusich does not inherit an owner-verified subwoofer connection', () => {
  for (const plan of [{ powerAmp: 'schiit-wotan' }, { powerAmpQuantity: 2 }]) {
    const subs = assessSystem({ ...DEFAULT_SYSTEM_PLAN, ...plan }).links.filter(l => l.branch === 'subwoofers');
    assert.ok(subs.every(l => l.provenance === 'proposed' && l.status === 'unknown'));
  }
});
