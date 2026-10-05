import { AUDIO_MODELS, AUDIO_ROLES, DEFAULT_SYSTEM_PLAN, SPEAKERS, TURNTABLE, WIIM } from './audioModels.js';

export const IMPEDANCE_REFERENCE = 'https://www.ranecommercial.com/legacy/tech.html';
export function validSystemPlan(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ...DEFAULT_SYSTEM_PLAN };
  const plan = { ...DEFAULT_SYSTEM_PLAN };
  for (const role of Object.keys(AUDIO_ROLES)) {
    if (input[role] === null && ['eq', 'headphoneAmp'].includes(role)) plan[role] = null;
    else if (typeof input[role] === 'string' && Object.hasOwn(AUDIO_MODELS, input[role]) && AUDIO_MODELS[input[role]].roles.includes(role)) plan[role] = input[role];
  }
  const options = { sourceMode: ['digital', 'vinyl', 'wiimAnalog'], transport: ['OPTICAL', 'COAXIAL'], lineConnector: ['RCA', 'XLR'], ampConnector: ['RCA', 'XLR'], phonoConnector: ['RCA', 'XLR'], preampMode: ['active', 'passive'], powerAmpQuantity: [1, 2] };
  for (const [key, values] of Object.entries(options)) if (values.includes(input[key])) plan[key] = input[key];
  return plan;
}

export function checkAudioLink(from, to, connector, signal, { quantity = 1, passive = false } = {}) {
  const checks = [];
  const add = (status, text) => checks.push({ status, text });
  const output = from?.outputs?.find(p => p.connector === connector && p.signal === signal);
  const input = to?.inputs?.find(p => p.connector === connector && p.signal === signal);
  if (!from || !to || from.outputs === null || to.inputs === null) add('unknown', 'Разъёмы ещё не подтверждены; совместимость не установлена.');
  else if (!output || !input) add('error', `Нет прямого соединения ${connector} с сигналом ${signal === 'line' ? 'линейного уровня' : signal}. Переходник не меняет тип сигнала.`);
  else {
    add('ok', `${connector} · ${signal === 'line' ? 'аналоговый линейный сигнал' : signal === 'spdif' ? 'цифровой S/PDIF' : signal === 'speaker' ? 'акустический выход' : 'сигнал картриджа'}`);
    if ((input.monoOnly || to.monoOnly) && quantity < 2) add('error', 'Для стерео нужны два моноблока. Один XLR-вход этой модели работает в моно.');
    if (signal === 'speaker') {
      if (!from.nominalLoads || !to.nominalOhm) add('unknown', 'Разъёмы акустического кабеля подходят; допустимая нагрузка и мощность усилителя не подтверждены.');
      else if (!from.nominalLoads.includes(to.nominalOhm)) add('warning', 'Номинальный импеданс акустики отсутствует среди проверенных нагрузок усилителя.');
    }
    if (signal === 'line') {
      const zout = passive ? (from.id === 'schiit-sys' ? 5000 : from.id === 'schiit-saga_2' ? 4800 : null) : output.impedanceOhm;
      if (Number.isFinite(zout) && Number.isFinite(input.impedanceOhm) && zout > 0) {
        const ratio = input.impedanceOhm / zout;
        add(ratio >= 10 ? 'ok' : 'warning', `Вход ${input.impedanceOhm.toLocaleString('ru-RU')} Ω / выход ${zout.toLocaleString('ru-RU')} Ω = ${ratio.toFixed(1)}×. Ориентир ≥10×${passive ? '; расчёт по максимальному выходному сопротивлению' : ''}.`);
      } else add('unknown', 'Для проверки нагрузки не хватает входного или выходного сопротивления.');
      if (output.maxVrms != null && input.maxVrms != null) add(output.maxVrms <= input.maxVrms ? 'ok' : 'warning', `Выход до ${output.maxVrms} Vrms; допустимый вход ${input.maxVrms} Vrms.`);
      else add('unknown', 'Запас по уровню не подтверждён: нужен допустимый входной уровень. Это не чувствительность усилителя.');
    }
  }
  const status = ['error', 'warning', 'unknown', 'ok'].find(status => checks.some(c => c.status === status));
  return { from, to, connector, signal, checks, status };
}

export function assessSystem(candidate) {
  const plan = validSystemPlan(candidate), selected = Object.fromEntries(Object.keys(AUDIO_ROLES).map(role => [role, AUDIO_MODELS[plan[role]]]));
  const links = [], notes = [];
  const connect = (from, to, connector, signal, options) => links.push({ ...checkAudioLink(from, to, connector, signal, options), branch: options?.branch || 'speakers' });
  if (plan.sourceMode === 'vinyl') {
    connect(TURNTABLE, selected.phono, 'RCA', 'phono');
    connect(selected.phono, selected.preamp, plan.phonoConnector, 'line');
    notes.push({ status: 'unknown', text: 'Картридж и его рекомендуемая нагрузка не указаны; настройки фонокорректора нужно согласовать отдельно. Выход E1 должен работать в режиме PHONO.' });
  } else if (plan.sourceMode === 'wiimAnalog') connect(WIIM, selected.preamp, 'RCA', 'line');
  else { connect(WIIM, selected.dac, plan.transport, 'spdif'); connect(selected.dac, selected.preamp, plan.lineConnector, 'line'); }
  const passive = plan.preampMode === 'passive' || selected.preamp.passive;
  const preampInput = plan.sourceMode === 'vinyl' ? plan.phonoConnector : plan.sourceMode === 'wiimAnalog' ? 'RCA' : plan.lineConnector;
  if (passive && preampInput !== plan.ampConnector) notes.push({ status: 'unknown', text: 'В пассивном режиме преобразование RCA ↔ XLR не подтверждено. Проверьте руководство; активные режимы и пассивный путь различаются.' });
  if (selected.eq) {
    connect(selected.preamp, selected.eq, plan.ampConnector, 'line', { passive });
    connect(selected.eq, selected.powerAmp, plan.ampConnector, 'line', { quantity: plan.powerAmpQuantity });
  } else connect(selected.preamp, selected.powerAmp, plan.ampConnector, 'line', { quantity: plan.powerAmpQuantity, passive });
  connect(selected.powerAmp, SPEAKERS, 'BINDING_POST', 'speaker');
  if (selected.powerAmp.nominalLoads) {
    const mono = selected.powerAmp.monoOnly || (selected.powerAmp.stereoRcaMonoXlr && plan.ampConnector === 'XLR');
    notes.push({ status: 'ok', text: `AE320: номинальные 8 Ω. ${mono ? 'Для выбранного моно-режима показана 8-омная нагрузка; нужны два усилителя.' : 'Эта нагрузка присутствует в паспортных режимах усилителя.'} Минимум импеданса и акустическая мощность в комнате отдельно не оценены.` });
  } else notes.push({ status: 'unknown', text: 'Для Rusich не указаны выходная мощность, допустимая нагрузка, чувствительность и входное сопротивление. Полное электрическое согласование пока невозможно.' });
  if (!selected.headphoneAmp && !selected.preamp.hasHeadphoneOutput) notes.push({ status: 'warning', text: `${selected.preamp.name} не имеет выхода на наушники. Для HD 650 нужен отдельный усилитель; A90 не заменяется в этой роли автоматически.` });
  if (selected.headphoneAmp) {
    if (selected.headphoneAmp.id !== selected.preamp.id) {
      connect(selected.preamp, selected.headphoneAmp, 'RCA', 'line', { passive, branch: 'headphones' });
      if (plan.ampConnector === 'RCA' && selected.preamp.outputPairs?.RCA < 2) notes.push({ status: 'error', text: 'Единственная пара RCA-выходов предусилителя уже занята основным трактом. Одновременно подключить отдельный усилитель наушников без изменения схемы нельзя; разветвитель не добавляется автоматически.' });
      notes.push({ status: 'unknown', text: 'Ветка наушников показана от RCA предусилителя. Если этот выход уже занят усилителем мощности или эквалайзером, нужно проверить число выходных пар. Два регулятора громкости требуют согласовать уровни.' });
    }
    notes.push({ status: 'unknown', text: `Наушники HD 650: подтвердите разъём и распайку кабеля для ${selected.headphoneAmp.name}. Электрическая мощность на 300 Ω пока не рассчитана.` });
  }
  if (plan.dac === 'fiio-warmer-r2r' && plan.sourceMode === 'digital') notes.push({ status: 'ok', text: `WARMER R2R: ${plan.transport === 'OPTICAL' ? 'оптика до 24 бит / 96 кГц — задайте соответствующий предел выхода WiiM' : 'коаксиальный вход до 24 бит / 192 кГц'}.` });
  if (plan.preampMode === 'passive' && !['schiit-freya_2', 'schiit-kara-f', 'schiit-saga_2', 'schiit-sys'].includes(plan.preamp)) notes.push({ status: 'error', text: 'Пассивный режим у выбранного предусилителя не подтверждён.' });
  if (plan.powerAmpQuantity === 2 && !selected.powerAmp.monoOnly && !(selected.powerAmp.stereoRcaMonoXlr && plan.ampConnector === 'XLR')) notes.push({ status: 'unknown', text: 'Выбраны два усилителя, но соединение работает в стереорежиме. Распределение каналов между аппаратами и нагрузками нужно задать отдельно.' });
  notes.push({ status: 'unknown', text: 'Два REL Quake: соединение «XLR Hi» владельца не подтверждено. Линейный XLR и высокоуровневый вход сабвуфера — разные сигналы; автоматически их не соединяем.' });
  return { plan, selected, links, notes, hasErrors: [...links, ...notes].some(x => x.status === 'error') };
}

// External plans must be complete: silently replacing a bad component would change a friend's system.
export function parseSystemPlan(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Вариант системы повреждён или создан в другой версии приложения.');
  const plan = validSystemPlan(input), keys = Object.keys(DEFAULT_SYSTEM_PLAN);
  if (Object.keys(input).length !== keys.length || keys.some(key => !Object.hasOwn(input, key) || input[key] !== plan[key])) throw new Error('Вариант содержит неизвестный аппарат или режим подключения.');
  return plan;
}

export function systemShareUrl(plan, origin, name = '') {
  const url = new URL('/', origin);
  url.searchParams.set('view', 'share');
  url.searchParams.set('system', JSON.stringify(validSystemPlan(plan)));
  if (name.trim()) url.searchParams.set('name', name.trim().slice(0, 64));
  url.hash = 'room';
  return url.toString();
}
export function systemPlanFromSearch(search) {
  try { const raw = new URLSearchParams(search).get('system'); return raw ? parseSystemPlan(JSON.parse(raw)) : null; } catch { return null; }
}
