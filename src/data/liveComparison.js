import { parseLiveSnapshot } from './liveSystem.js';
import { auditRoom, portLabel } from './roomIntelligence.js';
import { ROOM_DEVICE_MAP, ROOM_PORT_MAP } from './roomEquipment.js';
import { FREYA_MODES } from './roomPassports.js';
import { equipmentName } from './equipmentProfiles.js';

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const deviceName = id => ROOM_DEVICE_MAP[id]?.name || 'Не указан';
const rackName = id => id === 'tv' ? 'ТВ · 2 уровня' : 'Высокая стойка';
const valueText = value => value === undefined || value === null ? 'Не указано' : typeof value === 'boolean' ? value ? 'Да' : 'Нет' : Array.isArray(value) ? value.map(v => Array.isArray(v) ? `(${v.join(', ')})` : v).join(' · ') || 'Нет' : String(value);
const row = (id, label, before, after, format = valueText) => equal(before, after) ? [] : [{ id, label, before: format(before), after: format(after), kind: before === undefined ? 'added' : after === undefined ? 'removed' : 'changed' }];

function cableValue(c) {
  return { from: c.from, to: c.to, fromType: c.fromType, toType: c.toType, loose: !c.from || !c.to ? c.loose : undefined };
}
const cableText = c => c ? `${portLabel(c.from)} → ${portLabel(c.to)}${!c.from || !c.to ? ` · штекер ${!c.from ? c.fromType : c.toType}${c.loose ? ` · точка (${c.loose.map(v => Number(v.toFixed(3))).join(', ')}) м` : ''}` : ''}` : 'Нет кабеля';

function compareCables(a, b) {
  const remaining = new Map(b.map(c => [c.id, c])), rows = [];
  for (const before of a) {
    // Identity first; otherwise recognise a recreated connection with the same plugs.
    const after = remaining.get(before.id) || [...remaining.values()].find(c => !a.some(old => old.id === c.id) && equal(cableValue(before), cableValue(c)));
    if (after) remaining.delete(after.id);
    if (after && equal(cableValue(before), cableValue(after))) continue;
    rows.push({ id: before.id, label: after ? 'Изменён кабель' : 'Убран кабель', kind: after ? 'changed' : 'removed', before: cableText(before), after: cableText(after), beforeHint: { cable: before.id }, afterHint: after ? { cable: after.id } : null });
  }
  for (const after of remaining.values()) rows.push({ id: after.id, label: 'Добавлен кабель', kind: 'added', before: 'Нет кабеля', after: cableText(after), afterHint: { cable: after.id } });
  return rows;
}

const fields = {
  name: ['Название'], material: ['Материал', v => ({ walnut: 'Орех', oak: 'Дуб', alder: 'Ольха' })[v] || valueText(v)],
  width: ['Ширина, мм'], depth: ['Глубина, мм'], postInsetX: ['Отступ стоек X, мм'], postInsetZ: ['Отступ стоек Z, мм'], postDiameter: ['Диаметр стоек, мм'], rearGap: ['Сервисный зазор, мм'], powerGap: ['Разнос питания, мм'], centerSupports: ['Центральные опоры'],
  diagonal: ['Диагональ ТВ, ″'], standHeight: ['Высота ножек ТВ, мм'], footSpan: ['Разнос ножек ТВ, мм'], footDepth: ['Глубина ножек ТВ, мм'], x: ['Смещение X, мм'], z: ['Смещение Z, мм'],
  y: ['Высота, мм'], thickness: ['Толщина, мм'], diameter: ['Диаметр, мм'], modelId: ['Модель', id => id ? equipmentName({ modelId: id }) : 'Базовая модель'], shelfId: ['Полка'],
  from: ['Откуда', id => id === 'service' ? 'Кабельный канал' : equipmentName({ id })], to: ['Куда', id => id === 'service' ? 'Кабельный канал' : equipmentName({ id })], fromPort: ['Выход'], toPort: ['Вход'], type: ['Тип'], category: ['Назначение', v => ({ signal: 'Сигнал', power: 'Питание', dc: 'Низковольтное питание' })[v] || v],
  bendRadius: ['Радиус изгиба, мм'], massPerM: ['Масса, г/м'], connectorLength: ['Длина штекера, мм'], connectorDiameter: ['Диаметр штекера, мм'], connectorMass: ['Масса штекера, г'], straight: ['Прямой участок, мм'], available: ['Длина кабеля, мм'], reserve: ['Запас, мм'], supportSpan: ['Шаг опор, мм'], depthOffset: ['Отступ трассы, мм'], fromOffset: ['Смещение выхода XYZ, мм'], toOffset: ['Смещение входа XYZ, мм'], waypoints: ['Точки трассы XYZ, мм'], note: ['Примечание'],
};
function fieldRows(a, b, prefix, keys) {
  return keys.flatMap(key => {
    const [label, format] = fields[key];
    return row(`${prefix}/${key}`, label, a?.[key], b?.[key], format);
  });
}
function listRows(a = [], b = [], type, describe, keys, extra = () => [], name = v => v.name || v.id) {
  const first = new Map(a.map(v => [v.id, v])), second = new Map(b.map(v => [v.id, v]));
  return [...new Set([...first.keys(), ...second.keys()])].sort().flatMap(id => {
    const before = first.get(id), after = second.get(id), prefix = `${type}/${id}`, label = `${type} · ${name(after || before)}`;
    if (!before || !after) return [{ id: prefix, label, kind: before ? 'removed' : 'added', before: before ? describe(before, 'before') : 'Нет', after: after ? describe(after, 'after') : 'Нет' }];
    return [...fieldRows(before, after, prefix, keys), ...extra(before, after)].map(r => ({ ...r, id: `${prefix}/${r.id}`, label: `${label} · ${r.label}` }));
  });
}
function projectRows(a, b) {
  const summary = p => `${p.width} × ${p.depth} мм · ${p.shelves.length} полок · ${fields.material[1](p.material)}`;
  if (!a || !b) return row('project', 'Проект стойки', a && summary(a), b && summary(b));
  const shelfName = (project, id) => project.shelves.find(s => s.id === id)?.name || id;
  return [
    ...fieldRows(a, b, 'rack', ['name', 'material', 'width', 'depth', 'postInsetX', 'postInsetZ', 'postDiameter', 'rearGap', 'powerGap', 'centerSupports']),
    ...fieldRows(a.television, b.television, 'tv', ['diagonal', 'standHeight', 'footSpan', 'footDepth', 'x', 'z']).map(r => ({ ...r, label: `ТВ · ${r.label}` })),
    ...listRows(a.shelves, b.shelves, 'Полка', s => `${s.name} · ${s.width} × ${s.depth} × ${s.thickness} мм · высота ${s.y} мм`, ['name', 'y', 'thickness', 'width', 'depth', 'x', 'z'], (l, r) => listRows(l.holes, r.holes, 'Отверстие', h => `Ø${h.diameter} мм · X ${h.x}, Z ${h.z} мм`, ['x', 'z', 'diameter'])),
    ...listRows(a.equipment, b.equipment, 'Аппарат', (e, side) => `${equipmentName(e)} · ${shelfName(side === 'before' ? a : b, e.shelfId)} · X ${e.x}, Z ${e.z} мм`, ['modelId', 'shelfId', 'x', 'z'], undefined, equipmentName).map(r => r.id.endsWith('/shelfId') ? { ...r, before: shelfName(a, r.before), after: shelfName(b, r.after) } : r),
    ...listRows(a.cables, b.cables, 'Трасса', c => `${c.name} · ${c.available} мм`, ['name', 'from', 'to', 'fromPort', 'toPort', 'type', 'category', 'diameter', 'bendRadius', 'massPerM', 'connectorLength', 'connectorDiameter', 'connectorMass', 'straight', 'available', 'reserve', 'supportSpan', 'depthOffset', 'fromOffset', 'toOffset', 'waypoints', 'note']),
  ];
}

function findingHint(f) {
  if (f.id.startsWith('loose-')) return { cable: f.id.slice(6) };
  if (f.id.startsWith('invalid-')) return { cable: f.id.slice(8) };
  if (f.id.startsWith('missing-')) return { target: f.id.slice(8) };
  if (f.id.startsWith('power-')) return { device: f.id.slice(6), kind: 'power' };
  if (f.id.startsWith('input-')) return { device: ROOM_PORT_MAP[f.id.slice(6)]?.device };
  if (f.id === 'ground') return { device: 'e1', kind: 'ground' };
  return null;
}
function compareFindings(before, after) {
  const a = new Map(before.map(f => [f.id, f])), b = new Map(after.map(f => [f.id, f]));
  const result = { added: [], removed: [], changed: [], unchanged: [] };
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    const left = a.get(id), right = b.get(id);
    const kind = !left ? 'added' : !right ? 'removed' : equal(left, right) ? 'unchanged' : 'changed';
    result[kind].push({ id, before: left, after: right, beforeHint: left && findingHint(left), afterHint: right && findingHint(right) });
  }
  return result;
}

// Pure comparison of validated snapshots. It never accesses the working stores.
export function compareLiveSystems(first, second) {
  const a = parseLiveSnapshot(first), b = parseLiveSnapshot(second);
  const cables = compareCables(a.room.cables, b.room.cables);
  const inputs = [
    ...row('source', 'Источник', a.room.listening.source, b.room.listening.source, deviceName),
    ...row('mode', 'Режим проверки', a.room.listening.mode, b.room.listening.mode, v => v === 'possible' ? 'Только пути по кабелям' : 'С выбранными входами'),
    ...Object.keys(a.room.listening.inputs).flatMap(id => row(`input-${id}`, deviceName(id), a.room.listening.inputs[id], b.room.listening.inputs[id], v => v ? ROOM_PORT_MAP[v].label : 'Не указан').map(r => ({ ...r, beforeHint: { device: id }, afterHint: { device: id } }))),
    ...row('freyaMode', 'Режим Freya', a.room.listening.freyaMode, b.room.listening.freyaMode, v => FREYA_MODES[v]?.label || 'Не указан'),
    ...['dac', 'preamp'].flatMap(key => row(`component-${key}`, key === 'dac' ? 'ЦАП в тракте' : 'Предусилитель в тракте', a.room.components[key], b.room.components[key], deviceName)),
  ];
  const activeA = a.workshop.activeVariant, activeB = b.workshop.activeVariant;
  const racks = [{ id: 'active', title: 'Стойка в комнате', rows: [...row('active', 'Выбранная стойка', activeA, activeB, rackName), ...projectRows(a.workshop.variants[activeA], b.workshop.variants[activeB])] }];
  for (const id of ['rack', 'tv']) {
    if (activeA === id && activeB === id) continue;
    const rows = projectRows(a.workshop.variants[id], b.workshop.variants[id]);
    if (rows.length) racks.push({ id, title: `Сохранённый проект · ${rackName(id)}`, rows });
  }
  const audit = snapshot => auditRoom([...snapshot.room.cables].sort((x, y) => `${x.from}:${x.to}:${x.id}`.localeCompare(`${y.from}:${y.to}:${y.id}`)), snapshot.room.listening.source, snapshot.room.listening);
  const before = audit(a), after = audit(b);
  const findings = compareFindings(before.findings, after.findings);
  const routes = before.routes.map((r, i) => ({ id: r.id, name: r.name, before: r.status, after: after.routes[i].status }));
  const changed = cables.length + inputs.length + racks.reduce((n, r) => n + r.rows.length, 0);
  return { cables, inputs, racks, findings, routes, changed, modes: [a.room.listening.mode, b.room.listening.mode] };
}
