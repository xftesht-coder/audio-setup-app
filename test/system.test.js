import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO_MODELS, DEFAULT_SYSTEM_PLAN, SCHIIT_CATALOG, WIIM } from '../src/data/audioModels.js';
import { assessSystem, checkAudioLink, systemPlanFromSearch, systemShareUrl, validSystemPlan } from '../src/data/systemMatching.js';
import { completeListeningRack, plannedRack } from '../src/data/equipmentProfiles.js';
import { defaultProject, projectSchema, validateConstruction } from '../src/data/workshop.js';
import { routeAllCables } from '../src/data/cableRouting.js';

test('DAC alternatives accept both WiiM digital transports, not analogue over the same socket name', () => {
  for (const id of ['fiio-warmer-r2r', 'schiit-bifrost-3']) {
    for (const connector of ['OPTICAL', 'COAXIAL']) assert.equal(checkAudioLink(WIIM, AUDIO_MODELS[id], connector, 'spdif').status, 'ok');
    assert.equal(checkAudioLink(WIIM, AUDIO_MODELS[id], 'RCA', 'line').status, 'error');
  }
});
test('preamp replacement detects absent XLR inputs and fixed output-pair conflicts', () => {
  const plan = { ...DEFAULT_SYSTEM_PLAN, preamp: 'schiit-saga_2' };
  assert.ok(assessSystem(plan).links.some(l => l.status === 'error' && l.to.id === plan.preamp));
  assert.ok(assessSystem({ ...plan, lineConnector: 'RCA' }).notes.some(n => n.status === 'error' && n.text.includes('Единственная')));
  assert.equal(assessSystem({ ...plan, lineConnector: 'RCA', headphoneAmp: null }).hasErrors, false);
});
test('balanced mono amplifier input requires two units for stereo', () => {
  const plan = { ...DEFAULT_SYSTEM_PLAN, powerAmp: 'schiit-vidar-2f', ampConnector: 'XLR' };
  assert.equal(assessSystem(plan).hasErrors, true);
  assert.equal(assessSystem({ ...plan, powerAmpQuantity: 2 }).hasErrors, false);
});
test('unknown measurements never become approval, and passive impedance is not active impedance', () => {
  const active = checkAudioLink(AUDIO_MODELS['schiit-freya_2'], AUDIO_MODELS['schiit-wotan'], 'XLR', 'line');
  assert.ok(active.checks.some(c => c.status === 'ok' && c.text.includes('313.3')));
  assert.equal(active.status, 'unknown'); // Missing maximum input voltage.
  const passive = checkAudioLink(AUDIO_MODELS['schiit-freya_2'], AUDIO_MODELS['schiit-wotan'], 'XLR', 'line', { passive: true });
  assert.ok(!passive.checks.some(c => c.text.includes('313.3')));
  assert.equal(checkAudioLink(AUDIO_MODELS['schiit-sys'], AUDIO_MODELS['schiit-vidar-2f'], 'RCA', 'line', { passive: true }).status, 'warning');
  assert.equal(checkAudioLink(AUDIO_MODELS['fiio-warmer-r2r'], AUDIO_MODELS['schiit-freya_2'], 'RCA', 'line').status, 'unknown');
  assert.ok(assessSystem(DEFAULT_SYSTEM_PLAN).notes.some(n => n.status === 'unknown' && n.text.includes('Rusich')));
});
test('share round-trip preserves the active path and rejects untrusted roles and invalid values', () => {
  const plan = { ...DEFAULT_SYSTEM_PLAN, dac: 'fiio-warmer-r2r', transport: 'COAXIAL', headphoneAmp: null };
  const url = new URL(systemShareUrl(plan, 'https://audio-setup-app.vercel.app'));
  assert.deepEqual(systemPlanFromSearch(url.search), plan);
  assert.equal(systemPlanFromSearch('?system=%7Bbroken'), null);
  assert.deepEqual(validSystemPlan({ dac: '__proto__', preamp: 'schiit-bifrost-3', powerAmpQuantity: 500, ampConnector: 'SPEAKON' }), DEFAULT_SYSTEM_PLAN);
});
test('all eight physical devices survive DAC and preamp switching, and furniture edits survive insertion', () => {
  const base = defaultProject(); base.width = 710; base.shelves[0].holes.push({ id: 'owner-hole', x: 120, z: 50, diameter: 10 });
  const rack = completeListeningRack(base);
  assert.equal(rack.equipment.length, 8); assert.equal(rack.shelves.length, 5);
  assert.equal(rack.width, 710); assert.deepEqual(rack.shelves[0], base.shelves[0]);
  assert.deepEqual(completeListeningRack(rack), rack);
  for (const dac of ['fiio-warmer-r2r', 'schiit-bifrost-3']) for (const preamp of ['schiit-freya_2', 'owner-a90']) {
    const next = plannedRack(rack, { ...DEFAULT_SYSTEM_PLAN, dac, preamp });
    assert.deepEqual(next, rack); assert.equal(projectSchema.safeParse(next).success, true);
    assert.equal(validateConstruction(next).some(i => i.severity === 'error'), false);
    assert.ok(routeAllCables(next).every(r => r.issues.length === 0));
  }
  assert.throws(() => plannedRack(rack, { ...DEFAULT_SYSTEM_PLAN, dac: 'owner-current-dac' }), /габарита/);
  assert.equal(rack.equipment.length, 8);
});
test('new catalog candidates retain the existing equipment and do not inherit its cable coordinates', () => {
  const rack = plannedRack(defaultProject(), { ...DEFAULT_SYSTEM_PLAN, preamp: 'schiit-kara-f', powerAmp: 'schiit-vidar-2f', powerAmpQuantity: 2 });
  assert.equal(rack.equipment.length, 11);
  assert.equal(rack.equipment.filter(e => e.modelId === 'schiit-vidar-2f').length, 2);
  assert.equal(projectSchema.safeParse(rack).success, true);
  assert.ok(!routeAllCables(rack).some(r => r.cable.from.includes('kara') || r.cable.to.includes('kara')));
});
test('catalog has unique source-backed entries and planned Bifrost is marked as preorder', () => {
  assert.equal(SCHIIT_CATALOG.products.length, 54);
  assert.equal(new Set(SCHIIT_CATALOG.products.map(p => p.id)).size, 54);
  assert.ok(SCHIIT_CATALOG.products.every(p => p.source.startsWith('https://www.schiit.com/products/')));
  assert.equal(AUDIO_MODELS['schiit-bifrost-3'].availability, 'preorder');
  assert.equal(AUDIO_MODELS['schiit-freya_2'].envelope.h, 114.3); // Extra tube height.
  assert.equal(AUDIO_MODELS['schiit-valhalla-3'].envelope.h, 82.5); // Total height with tubes.
  assert.equal(AUDIO_MODELS['schiit-lyr-5'].envelope, null); // Tube envelope not specified.
});
