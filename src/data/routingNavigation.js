import { ROOM_DEVICE_MAP, ROOM_PORT_MAP } from './roomEquipment.js';

const targets = new Set(['ae0', 'ae1', 'rel0', 'rel1']);
const layers = new Set(['audio', 'power', 'ground', 'all', 'loose']);

// A navigation hint never imports, reconnects or changes the listening source.
export function routingHref({ target, cable, device, kind } = {}) {
  const params = new URLSearchParams();
  if (targets.has(target)) params.set('target', target);
  if (typeof cable === 'string' && cable.length && cable.length <= 160) params.set('cable', cable);
  if (Object.hasOwn(ROOM_DEVICE_MAP, device)) params.set('device', device);
  if (layers.has(kind)) params.set('layer', kind);
  return '#patch' + (params.size ? '?' + params : '');
}

export function routingLocation(hash, cables = []) {
  const params = new URLSearchParams(hash.split('?').slice(1).join('?'));
  const requestedCable = params.get('cable');
  const cable = cables.find(c => c.id === requestedCable);
  const endpoint = cable && (ROOM_PORT_MAP[cable.to] || ROOM_PORT_MAP[cable.from]);
  const requestedDevice = params.get('device');
  const device = endpoint?.device || (Object.hasOwn(ROOM_DEVICE_MAP, requestedDevice) ? requestedDevice : '');
  const signal = endpoint?.signal;
  const kind = cable ? !cable.from || !cable.to ? 'loose' : ['power','ground'].includes(signal) ? signal : 'audio' : layers.has(params.get('layer')) ? params.get('layer') : 'audio';
  return {
    cable: endpoint ? cable.id : '', device, kind,
    target: !cable && targets.has(params.get('target')) ? params.get('target') : '',
    missingCable: requestedCable !== null && !endpoint,
  };
}
