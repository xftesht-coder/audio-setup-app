import { parseRoomSnapshot, roomSnapshot } from './roomBackup.js';
import { projectSchema } from './workshop.js';
import { MAX_VARIANTS, variantName } from './systemVariants.js';

export { MAX_VARIANTS, variantName };
export const MAX_LIVE_BYTES = 4 * 1024 * 1024;
export const sameSystem = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function parseLiveSnapshot(value) {
  if (value?.version !== 1 || value.workshop?.workspaceVersion !== 2 || !['rack', 'tv'].includes(value.workshop.activeVariant)) throw new Error('Неизвестный формат снимка системы.');
  const room = roomSnapshot(parseRoomSnapshot(JSON.stringify(value.room)));
  const { activeVariant } = value.workshop;
  const variants = { rack: projectSchema.parse(value.workshop.variants?.rack) };
  if (value.workshop.variants?.tv) variants.tv = projectSchema.parse(value.workshop.variants.tv);
  if (!variants[activeVariant]) throw new Error('В снимке отсутствует выбранная стойка.');
  return { version: 1, room, workshop: { workspaceVersion: 2, activeVariant, variants } };
}

export function captureLiveSystem(room, workshop) {
  return parseLiveSnapshot({ version: 1, room: roomSnapshot(room), workshop: {
    workspaceVersion: 2, activeVariant: workshop.activeVariant,
    variants: { ...workshop.variants, [workshop.activeVariant]: workshop.project },
  } });
}

export function validateLiveVariants(values) {
  if (!Array.isArray(values) || values.length > MAX_VARIANTS) throw new Error(`Можно сохранить до ${MAX_VARIANTS} вариантов.`);
  const ids = new Set(), names = new Set();
  return values.map(item => {
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 80 || ids.has(item.id)) throw new Error('Некорректный идентификатор варианта.');
    const name = variantName(item.name), key = name.toLowerCase();
    if (names.has(key)) throw new Error('Это название уже занято. Выбери другое.');
    ids.add(item.id); names.add(key);
    return { id: item.id, name, snapshot: parseLiveSnapshot(item.snapshot) };
  });
}

export function parseLiveJson(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_LIVE_BYTES) throw new Error('Файл слишком большой: максимум 4 МБ.');
  try { return JSON.parse(text); } catch { throw new Error('Не удалось прочитать JSON системы.'); }
}

export function exportLiveVariants(variants) {
  return { type: 'audio-setup-live-variants', version: 1, variants: validateLiveVariants(variants) };
}

export function mergeLiveVariants(text, current, makeId) {
  const data = parseLiveJson(text);
  if (data?.type !== 'audio-setup-live-variants' || data.version !== 1) throw new Error('Нужна копия живых вариантов системы, а не каталожного черновика или отдельной стойки.');
  const incoming = validateLiveVariants(data.variants), merged = validateLiveVariants(current);
  for (const item of incoming) {
    if (merged.some(v => v.name === item.name && sameSystem(v.snapshot, item.snapshot))) continue;
    let name = item.name, suffix = 2;
    while (merged.some(v => v.name.toLowerCase() === name.toLowerCase())) name = `${item.name.slice(0, 54)} (${suffix++})`;
    merged.push({ ...item, id: makeId(), name });
  }
  return validateLiveVariants(merged);
}
