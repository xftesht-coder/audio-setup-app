import { ROOM_PORT_MAP } from './roomEquipment.js';
import { connectionCheck, restoreRoomCables } from './roomWiring.js';
import { defaultListening, parseListening } from './roomListening.js';
import { inferComponents, parseComponents } from './roomComponents.js';

export const MAX_ROOM_BACKUP_BYTES = 128 * 1024;
export function parseRoomBackup(text) {
  return parseRoomSnapshot(text).cables;
}

export function roomSnapshot(state) {
  return { version: 3, cables: state.cables, listening: state.listening, components: state.components };
}

export function parseRoomSnapshot(text) {
  if (typeof text !== 'string' || text.length > MAX_ROOM_BACKUP_BYTES) throw new Error('Файл слишком большой. Максимум 128 КБ.');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Файл не является корректным JSON.'); }
  if (![1, 2, 3].includes(data?.version) || !Array.isArray(data.cables) || data.cables.length > 100) throw new Error('Нужна резервная копия комнаты версии 1, 2 или 3 (до 100 кабелей).');
  const listening = data.version === 1 ? defaultListening() : parseListening(data.listening);
  for (const c of data.cables) {
    if (!c || typeof c.id !== 'string' || !c.id.length || c.id.length > 120) throw new Error('Некорректный идентификатор кабеля.');
    for (const end of ['from', 'to']) {
      if (c[end] !== null && typeof c[end] !== 'string') throw new Error('Некорректный разъём в файле.');
      const p = ROOM_PORT_MAP[c[end]];
      if (c[end] !== null && !p) throw new Error('В файле есть неизвестный разъём.');
      if (p?.reserved) throw new Error('Файл занимает розетку стационарной лампы.');
      const type = c[`${end}Type`];
      if (type !== undefined && (typeof type !== 'string' || !Object.values(ROOM_PORT_MAP).some(port => port.connector === type) || (p && type !== p.connector))) throw new Error('Тип штекера не соответствует разъёму.');
      if (!p && !type) throw new Error('У свободного конца не указан тип штекера.');
    }
    if (Boolean(c.from) !== Boolean(c.to)) {
      const missingEnd = c.from ? 'to' : 'from';
      const compatible = Object.values(ROOM_PORT_MAP).some(p => p.connector === c[`${missingEnd}Type`] && connectionCheck(c.from || p.id, c.to || p.id).ok);
      if (!compatible) throw new Error('Штекер свободного конца несовместим с типом кабеля.');
    }
    if (c.loose !== undefined && (!Array.isArray(c.loose) || c.loose.length !== 3 || c.loose.some(n => !Number.isFinite(n) || Math.abs(n) > 10) || c.loose[2] < .004)) throw new Error('Некорректное положение свободного конца кабеля.');
  }
  const cables = restoreRoomCables(data.cables);
  if (cables.length !== data.cables.length) throw new Error('В файле есть дубликаты, занятые порты или несовместимые соединения. Текущая схема сохранена.');
  const components = data.version === 3 ? parseComponents(data.components) : inferComponents(cables);
  return { cables, listening, components };
}

export function downloadJson(filename, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
