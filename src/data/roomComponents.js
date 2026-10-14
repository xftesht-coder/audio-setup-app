import { ROOM_PORT_MAP } from './roomEquipment.js';

// Catalog model IDs map to the existing physical instances in the room.
export const ROOM_COMPONENTS = {
  dac: [{ id: 'bifrost', model: 'schiit-bifrost-3' }, { id: 'warmer', model: 'fiio-warmer-r2r' }],
  preamp: [{ id: 'a90', model: 'owner-a90' }, { id: 'freya', model: 'schiit-freya_2' }],
};
export const defaultComponents = () => ({ dac: 'bifrost', preamp: 'a90' });
export const roomInstance = (role, model) => ROOM_COMPONENTS[role]?.find(c => c.model === model)?.id;
export function parseComponents(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !Object.hasOwn(ROOM_COMPONENTS, k))) throw new Error('Некорректный состав комнаты.');
  for (const role of Object.keys(ROOM_COMPONENTS)) if (value[role] !== null && !ROOM_COMPONENTS[role].some(c => c.id === value[role])) throw new Error('Аппарат не поддерживается в этой роли комнаты.');
  return { dac: value.dac, preamp: value.preamp };
}
export function inferComponents(cables) {
  const unique = ids => { const all = [...new Set(ids)]; return all.length === 1 ? all[0] : null; };
  const complete = cables.filter(c => c.from && c.to);
  const preamp = unique(complete.filter(c => ROOM_PORT_MAP[c.to]?.device === 'rusich' && ROOM_PORT_MAP[c.to]?.signal === 'line').map(c => ROOM_PORT_MAP[c.from]?.device).filter(id => ROOM_COMPONENTS.preamp.some(d => d.id === id)));
  const dac = unique(complete.filter(c => ROOM_PORT_MAP[c.to]?.device === preamp && ROOM_PORT_MAP[c.to]?.signal === 'line').map(c => ROOM_PORT_MAP[c.from]?.device).filter(id => ROOM_COMPONENTS.dac.some(d => d.id === id)));
  return { dac, preamp };
}
