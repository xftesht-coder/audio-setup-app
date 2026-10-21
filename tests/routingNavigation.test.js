import test from 'node:test';
import assert from 'node:assert/strict';
import { routingHref, routingLocation } from '../src/data/routingNavigation.js';
import { roomPreset } from '../src/data/roomWiring.js';
import { ROOM_PORT_MAP } from '../src/data/roomEquipment.js';
import { sectionForHash } from '../src/data/appSections.js';

test('audit cable links resolve the existing cable and correct signal layer without modifying wiring', () => {
  for (const preset of ['a90','bifrost','warmer']) {
    const cables = roomPreset(preset), before = JSON.stringify(cables);
    for (const cable of cables) {
      const hash = routingHref({ cable:cable.id, target:'rel0' });
      assert.equal(sectionForHash(hash), 'patch');
      const location = routingLocation(hash,cables), port = ROOM_PORT_MAP[cable.to];
      assert.equal(location.cable,cable.id);
      assert.equal(location.device,port.device);
      assert.equal(location.kind,['power','ground'].includes(port.signal) ? port.signal : 'audio');
      assert.equal(location.target,'');
      assert.equal(location.missingCable,false);
    }
    assert.equal(JSON.stringify(cables),before);
  }
});

test('free ends open the remaining device in the loose layer and obsolete links report the missing cable', () => {
  const original = roomPreset('a90').find(c => c.id === 'digital');
  for (const end of ['from','to']) {
    const cable = {...original,[end]:null};
    const location = routingLocation(routingHref({cable:cable.id}),[cable]);
    assert.equal(location.kind,'loose');
    assert.equal(location.device,ROOM_PORT_MAP[cable.to || cable.from].device);
  }
  const missing = routingLocation(routingHref({cable:original.id}),[]);
  assert.equal(missing.missingCable,true);
  assert.equal(missing.cable,''); assert.equal(missing.device,'');
});

test('target links retain the exact output, including a missing path; base navigation clears the hint', () => {
  for (const target of ['ae0','ae1','rel0','rel1']) assert.equal(routingLocation(routingHref({target}),[]).target,target);
  assert.deepEqual(routingLocation('#patch'),{target:'',device:'',cable:'',kind:'audio',missingCable:false});
  assert.equal(sectionForHash('#intelligence?unused=value'),'intelligence');
});

test('foreign targets, prototype names and malformed cable hints cannot select or create equipment', () => {
  for (const key of ['__proto__','constructor','unknown','<script>']) {
    const hash = '#patch?target='+encodeURIComponent(key)+'&device='+encodeURIComponent(key)+'&layer='+encodeURIComponent(key);
    assert.equal(routingLocation(hash).device,'');
    assert.equal(routingLocation(hash).target,'');
    assert.equal(routingLocation(hash).kind,'audio');
  }
  assert.equal(routingLocation('#patch?cable=%E0%A4%A',roomPreset('a90')).missingCable,true);
});
