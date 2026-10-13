import { ROOM_DEVICE_MAP, ROOM_PORT_MAP } from './roomEquipment.js';
import { connectionCheck } from './roomWiring.js';

export const LISTENING_SOURCES = [{ id: 'wiim', name: 'WiiM Pro Plus' }, { id: 'e1', name: 'Pro-Ject E1 · винил' }];
// Explicit internal signal transitions, not arbitrary device-level reachability.
const transitions = {
  bifrost: ['digital:line', 'usb:line'], warmer: ['digital:line', 'usb:line'],
  skoll: ['phono:line'], a90: ['line:line'], freya: ['line:line'], rusich: ['line:speaker'],
};
const targets = ['ae0', 'ae1', 'rel0', 'rel1'];
export const portLabel = id => {
  const p = ROOM_PORT_MAP[id];
  return p ? `${ROOM_DEVICE_MAP[p.device].name} · ${p.label}` : 'Свободный конец';
};

export function auditRoom(cables, source = 'wiim') {
  if (!LISTENING_SOURCES.some(s => s.id === source)) throw new Error('Неизвестный источник.');
  const findings = [], valid = [];
  for (const c of cables) {
    if (!c.from || !c.to) {
      findings.push({ id: `loose-${c.id}`, level: 'attention', title: 'Свободный конец кабеля', evidence: `${portLabel(c.from)} → ${portLabel(c.to)}`, next: 'Подключи свободный конец или убери неиспользуемый кабель за стойкой.' });
      continue;
    }
    const check = connectionCheck(c.from, c.to, cables, c.id);
    if (!check.ok) findings.push({ id: `invalid-${c.id}`, level: 'issue', title: 'Соединение требует исправления', evidence: `${portLabel(c.from)} → ${portLabel(c.to)}: ${check.reason}`, next: 'Исправь соединение за стойкой.' });
    else valid.push(c);
  }
  const audio = valid.filter(c => !['power', 'ground'].includes(ROOM_PORT_MAP[c.from].signal));
  const queue = [{ device: source, signal: null, path: [], devices: [source] }], reached = new Set([source]), paths = new Map();
  while (queue.length) {
    const state = queue.shift();
    if (targets.includes(state.device)) { if (!paths.has(state.device)) paths.set(state.device, state.path); continue; }
    for (const c of audio) {
      const from = ROOM_PORT_MAP[c.from], to = ROOM_PORT_MAP[c.to];
      if (from.device !== state.device || state.devices.includes(to.device)) continue;
      if (state.signal && !transitions[state.device]?.includes(`${state.signal}:${from.signal}`)) continue;
      reached.add(to.device);
      queue.push({ device: to.device, signal: to.signal, path: [...state.path, c], devices: [...state.devices, to.device] });
    }
  }
  const routes = targets.map(id => ({ id, name: ROOM_DEVICE_MAP[id].name, path: paths.get(id) || [], connected: paths.has(id) }));
  for (const r of routes.filter(r => !r.connected)) findings.push({ id: `missing-${r.id}`, level: 'issue', title: `Нет полного пути к ${r.name}`, evidence: `В сохранённой схеме нет непрерывного аудиопути от ${ROOM_DEVICE_MAP[source].name}. Питание и GND не считаются аудиосигналом.`, next: 'Проверь выход источника, вход DAC / предусилителя и выход усилителя в комнате.' });
  for (const id of reached) {
    if (ROOM_PORT_MAP[`${id}.power`] && !valid.some(c => c.to === `${id}.power`)) findings.push({ id: `power-${id}`, level: 'issue', title: `Не показано питание: ${ROOM_DEVICE_MAP[id].name}`, evidence: 'Аппарат участвует в доступном участке тракта, но его вход питания не подключён в схеме.', next: 'Добавь кабель питания со штатным БП, если он требуется. Проверка не определяет, включён ли реальный аппарат.' });
  }
  const planned = [...reached].filter(id => ROOM_DEVICE_MAP[id].status);
  if (planned.length) findings.push({ id: 'planned', level: 'attention', title: 'В тракте есть планируемые устройства', evidence: planned.map(id => `${ROOM_DEVICE_MAP[id].name}: ${ROOM_DEVICE_MAP[id].status}`).join('; '), next: 'Это проект системы. Наличие аппаратов нужно подтвердить отдельно.' });
  if (source === 'e1' && reached.has('skoll') && !valid.some(c => c.from === 'e1.ground' && c.to === 'skoll.ground')) findings.push({ id: 'ground', level: 'attention', title: 'Не показан GND проигрывателя', evidence: 'Виниловый тракт проходит через Skoll, но связь E1 GND → Skoll GND отсутствует.', next: 'Сверь подключение земли с инструкциями аппаратов; наличие фона по схеме определить нельзя.' });
  if (valid.some(c => ROOM_PORT_MAP[c.to].connector === 'XLR_HIGH')) findings.push({ id: 'rel-pinout', level: 'unknown', title: 'Распайка REL HIGH LEVEL не подтверждена', evidence: 'Общий выход Rusich на колонки и REL задан владельцем. Тип XLR_HIGH хранится отдельно от линейного XLR.', next: 'Нужны распайка конкретного кабеля и подтверждение допустимого подключения к усилителю. Это не монтажная инструкция.' });
  findings.push(
    { id: 'gain', level: 'unknown', title: 'Уровни и согласование пока не рассчитаны', evidence: 'В модели комнаты нет полного набора выходных напряжений, усилений, чувствительности и входных / выходных импедансов выбранных ревизий.', next: 'Заполнить паспорта со ссылками на спецификации. Совпадение разъёмов не доказывает электрическое согласование.' },
    { id: 'room', level: 'unknown', title: 'Акустический результат не оценён', evidence: 'Визуальная комната не является измерением помещения. Нет подтверждённых размеров реальной комнаты, позиции слушателя и измерений.', next: 'Зафиксировать расстановку, задачу прослушивания и измерения до выбора акустического улучшения.' },
    { id: 'market', level: 'unknown', title: 'Оснований рекомендовать покупку пока нет', evidence: 'Цены сделок, конкретная проблема звучания и сравнение вариантов ещё не подключены.', next: 'Сначала описать проблему и проверить тракт. Стоимость устройства сама по себе не определяет слабое звено.' },
  );
  return { version: 1, scope: 'room-wiring', source, routes, findings, connected: routes.filter(r => r.connected).length };
}
