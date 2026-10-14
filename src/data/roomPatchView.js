import { ROOM_PORT_MAP } from './roomEquipment.js';
import { portLabel } from './roomIntelligence.js';
import { connectionCheck } from './roomWiring.js';

export const PATCH_KINDS = { all: 'Все кабели', audio: 'Аудио', power: 'Питание', ground: 'Земля', loose: 'Свободные концы' };
export function cableKind(cable) {
  const signal = (ROOM_PORT_MAP[cable.from] || ROOM_PORT_MAP[cable.to])?.signal;
  return ['power', 'ground'].includes(signal) ? signal : 'audio';
}
// A projection of the room graph, never a second editable configuration.
export function roomPatchRows(cables, { kind = 'all', query = '', path = null } = {}) {
  const search = query.trim().toLocaleLowerCase('ru');
  const pathOrder = path === null ? null : new Map(path.map((c, i) => [c.id, i]));
  const rows = cables.map(c => {
    const loose = !c.from || !c.to;
    const check = loose ? null : connectionCheck(c.from, c.to, cables, c.id);
    return { ...c, kind: cableKind(c), loose, fromLabel: portLabel(c.from), toLabel: portLabel(c.to), issue: check && !check.ok ? check.reason : null };
  }).filter(c => (kind === 'all' || (kind === 'loose' ? c.loose : c.kind === kind))
    && (!pathOrder || pathOrder.has(c.id))
    && `${c.fromLabel} ${c.toLabel} ${c.fromType || ''} ${c.toType || ''}`.toLocaleLowerCase('ru').includes(search));
  return pathOrder ? rows.sort((a, b) => pathOrder.get(a.id) - pathOrder.get(b.id)) : rows;
}
