import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { createRoomWiringStore } from '../src/store/roomWiringStore.js';
import { createWorkshopStore } from '../src/stores/useWorkshopStore.js';
import { captureLiveSystem } from '../src/data/liveSystem.js';
import { createLiveShareUrl, readLiveShare, sharedRoomScene, MAX_SHARE_JSON_BYTES, MAX_SHARE_URL_LENGTH } from '../src/data/liveShare.js';
import { roomSceneLayout } from '../src/data/roomSceneLayout.js';
import { auditRoom } from '../src/data/roomIntelligence.js';

function fixture(tv = false) {
  const storage = () => ({ getItem: () => null, setItem: () => {} });
  const room = createRoomWiringStore(storage), workshop = createWorkshopStore(storage);
  room.getState().preset('warmer');
  room.getState().setListening({ mode: 'selected', inputs: { warmer: 'warmer.coax', freya: 'freya.xlr1' } });
  room.getState().unplug('sub0', 'to');
  if (tv) workshop.getState().switchVariant('tv');
  const snapshot = captureLiveSystem(room.getState(), workshop.getState());
  const project = snapshot.workshop.variants[snapshot.workshop.activeVariant];
  project.material = 'oak'; project.depth = 605;
  project.shelves[0].holes.push({ id: 'owner-hole', x: 12, z: 15, diameter: 36 });
  project.cables[0].waypoints = [[50, 200, -150]];
  return { id: 'private-library-id', name: 'Антон · ТВ / музыка 🎵', snapshot };
}
const packed = value => '#snapshot=v1.' + gzipSync(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

for (const tv of [false, true]) test(`shared ${tv ? 'TV' : 'high'} rack preserves the complete saved snapshot and actual room scene`, async () => {
  const item = fixture(tv), original = structuredClone(item);
  const url = new URL(await createLiveShareUrl(item, 'https://audio-setup-app.vercel.app/?room=patch&name=old#patch?cable=abc'));
  assert.equal(url.search, '?view=share');
  assert.ok(url.href.length < MAX_SHARE_URL_LENGTH);
  const shared = await readLiveShare(url.hash);
  assert.deepEqual(shared.snapshot, original.snapshot);
  assert.equal(shared.name, original.name);
  assert.equal(shared.id, undefined);
  assert.deepEqual(item, original);
  const scene = sharedRoomScene(shared.snapshot);
  assert.deepEqual(scene.project, original.snapshot.workshop.variants[tv ? 'tv' : 'rack']);
  assert.deepEqual(scene.cables, original.snapshot.room.cables);
  const layout = roomSceneLayout(scene.project);
  assert.equal(Boolean(layout.project.television), tv);
  assert.equal(layout.project.depth, 605);
  assert.equal(scene.cables.find(c => c.id === 'sub0').to, null);
  assert.deepEqual(auditRoom(scene.cables, 'wiim', shared.snapshot.room.listening), auditRoom(original.snapshot.room.cables, 'wiim', original.snapshot.room.listening));
});

test('the link is immutable after edits, renaming or deleting the source variant', async () => {
  const item = fixture(), url = new URL(await createLiveShareUrl(item, 'https://example.org/audio/'));
  const before = await readLiveShare(url.hash);
  item.name = 'Другой'; item.snapshot.room.cables = [];
  item.snapshot.workshop.variants.rack.width = 900;
  assert.deepEqual(await readLiveShare(url.hash), before);
  assert.equal(url.pathname, '/audio/');
});

test('malformed, truncated, unknown-version and invalid device links fail closed', async () => {
  const item = fixture(), good = { type: 'audio-setup-share', version: 1, ...item };
  for (const hash of ['', '#room', '#snapshot=', '#snapshot=v2.abc', '#snapshot=v1.%xx', '#snapshot=v1.a', '#snapshot=v1.' + 'a'.repeat(MAX_SHARE_URL_LENGTH), packed('{'), packed({ ...good, version: 2 }), packed({ ...good, snapshot: { version: 99 } })]) {
    await assert.rejects(readLiveShare(hash), /Ссылка повреждена/);
  }
  const url = new URL(await createLiveShareUrl(item, 'https://example.org/'));
  await assert.rejects(readLiveShare(url.hash.slice(0, -8)), /Ссылка повреждена/);
  good.snapshot.room.listening.inputs.warmer = 'rusich.rca1';
  await assert.rejects(readLiveShare(packed(good)), /Ссылка повреждена/);
});

test('decompression is bounded before JSON parsing, including highly compressible payloads', async () => {
  const bomb = packed(' '.repeat(MAX_SHARE_JSON_BYTES + 1));
  assert.ok(bomb.length < 1000);
  await assert.rejects(readLiveShare(bomb), /Ссылка повреждена/);
});

test('oversized URLs and unsupported browsers report a real failure instead of a partial link', async () => {
  await assert.rejects(createLiveShareUrl(fixture(), 'https://example.org/' + 'a'.repeat(MAX_SHARE_URL_LENGTH)), /слишком большой/);
  await assert.rejects(createLiveShareUrl(fixture(), 'javascript:alert(1)'), /адрес сайта/);
  const original = globalThis.CompressionStream;
  try {
    globalThis.CompressionStream = undefined;
    await assert.rejects(createLiveShareUrl(fixture(), 'https://example.org/'), /современный браузер/);
  } finally { globalThis.CompressionStream = original; }
});

test('snapshot rendering has no static dependency on editor stores or browser persistence', async () => {
  const visited = new Set();
  async function walk(url) {
    if (visited.has(url.href)) return;
    visited.add(url.href);
    const text = await readFile(url, 'utf8');
    assert.doesNotMatch(text, /localStorage|sessionStorage|useLiveSystemStore|useWorkshopStore|useRoomWiring/, url.pathname);
    for (const match of text.matchAll(/\b(?:import|export)\s[^;]*?\bfrom\s*['"](\.[^'"]+)['"]/g)) {
      const path = match[1];
      if (/\.(css|json)$/.test(path)) continue;
      const target = new URL(/\.(jsx?|tsx?)$/.test(path) ? path : path + '.js', url);
      try { await walk(target); } catch (error) {
        if (error.code !== 'ENOENT' || /\.(jsx?|tsx?)$/.test(path)) throw error;
        await walk(new URL(path + '.jsx', url));
      }
    }
  }
  await walk(new URL('../src/components/ShareView.jsx', import.meta.url));
  await walk(new URL('../src/components/RoomView3D.jsx', import.meta.url));
  const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /import\s+App\s+from/);
});
