import { ROOM_PORTS } from './roomEquipment.js';

export const LISTENING_SOURCES = [{ id: 'wiim', name: 'WiiM Pro Plus · стриминг' }, { id: 'e1', name: 'Pro-Ject E1 · винил' }];
// These are project declarations, not remote control or measured device state.
export const INPUT_DEVICES = ['bifrost', 'warmer', 'skoll', 'a90', 'freya', 'rusich'];
export const INPUT_OPTIONS = Object.fromEntries(INPUT_DEVICES.map(id => [id, ROOM_PORTS.filter(p => p.device === id && p.direction === 'in' && ['digital', 'usb', 'phono', 'line'].includes(p.signal))]));
export const defaultListening = () => ({ source: 'wiim', mode: 'possible', inputs: Object.fromEntries(INPUT_DEVICES.map(id => [id, null])) });

export function parseListening(value) {
  if (!value || !LISTENING_SOURCES.some(s => s.id === value.source) || !['possible', 'selected'].includes(value.mode) || !value.inputs || typeof value.inputs !== 'object' || Array.isArray(value.inputs)) throw new Error('Некорректные настройки прослушивания.');
  if (Object.keys(value.inputs).some(id => !INPUT_DEVICES.includes(id))) throw new Error('В настройках входов есть неизвестный аппарат.');
  const inputs = {};
  for (const id of INPUT_DEVICES) {
    const port = value.inputs[id];
    if (port !== null && !INPUT_OPTIONS[id].some(p => p.id === port)) throw new Error('Выбранный вход не принадлежит аппарату или отсутствует.');
    inputs[id] = port;
  }
  return { source: value.source, mode: value.mode, inputs };
}

export function assessInputPath(path, listening) {
  if (listening.mode === 'possible') return { status: 'possible', inputs: [] };
  const inputs = path.flatMap(c => {
    const id = c.to.split('.')[0];
    if (!INPUT_DEVICES.includes(id)) return [];
    const selected = listening.inputs[id];
    return selected === c.to ? [] : [{ device: id, required: c.to, selected, status: selected === null ? 'unknown' : 'blocked' }];
  });
  return { status: inputs.some(i => i.status === 'blocked') ? 'blocked' : inputs.length ? 'unknown' : 'ready', inputs };
}
