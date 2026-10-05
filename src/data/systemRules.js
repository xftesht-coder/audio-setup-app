// ============================================================
// СИСТЕМНЫЕ ПРАВИЛА И ПРЕДУПРЕЖДЕНИЯ ДЛЯ КОНКРЕТНОЙ СИСТЕМЫ
// ============================================================

// Критичные правила - специфичные комбинации устройств, которые опасны или неверны
export const CRITICAL_RULES = [
  {
    id: 'owner_rel_high_level',
    check: (fromDeviceId, fromPortId, toDeviceId, toPortId) => fromDeviceId === 'rusich_a2' && fromPortId === 'rusich_speakers' && ['sub_left', 'sub_right'].includes(toDeviceId) && toPortId === `${toDeviceId}_hi`,
    severity: 'info',
    message: 'HIGH LEVEL от общих с AE320 выходов Rusich → XLR на REL: соединение указано владельцем. Распайка XLR и электрические параметры не проверены; это не линейный XLR.',
  },
  {
    id: 'turntable_needs_phono',
    check: (fromDeviceId, _fromPortId, toDeviceId, toPortId) => fromDeviceId === 'turntable' && toDeviceId === 'rusich_a2' && ['rusich_rca1', 'rusich_rca2', 'rusich_xlr1', 'rusich_xlr2'].includes(toPortId),
    severity: 'critical',
    message: 'Не подключай выход картриджа проигрывателя прямо во вход усилителя мощности. Сначала сигнал должен пройти через фонокорректор Schiit Skoll F.',
    suggestion: 'Виниловый тракт: Pro-Ject E1 → Skoll F → A90 → Rusich ALEPH PASS A2 → Acoustic Energy AE320.',
  },
  {
    id: 'bifrost_output_level',
    check: fromDeviceId => fromDeviceId === 'dac_fiio',
    severity: 'info',
    message: 'Schiit Bifrost 3: максимум 2.0 Vrms RCA и 4.0 Vrms XLR. Проверь уровень и регулятор Topping A90 перед прослушиванием.',
  },
  {
    id: 'a90_input_switch',
    check: (_fromDeviceId, _fromPortId, toDeviceId, toPortId) => toDeviceId === 'a90' && ['a90_in_rca', 'a90_in_xlr'].includes(toPortId),
    severity: 'info',
    message: 'У Topping A90 вход выбирается переключателем. Выбери тот вход (RCA или XLR), к которому подключён источник.',
  },
  {
    id: 'ground_wire_needed',
    check: (fromDeviceId, fromPortId, toDeviceId) => fromDeviceId === 'turntable' && fromPortId === 'tt_out' && toDeviceId === 'phono',
    severity: 'tip',
    message: 'Подключи отдельный земляной провод проигрывателя к GND на Schiit Skoll F, чтобы снизить риск сетевого гула.',
  },
  {
    id: 'speaker_no_biwire',
    check: (_fromDeviceId, _fromPortId, toDeviceId) => toDeviceId === 'speakers',
    severity: 'info',
    message: 'У Acoustic Energy AE320 одна пара клемм на колонку; схема рассчитана на обычное подключение без bi-wiring.',
  },
  {
    id: 'wiim_digital_output_select',
    check: (fromDeviceId, fromPortId, toDeviceId) => fromDeviceId === 'streamer_wiim' && ['wiim_out_optical', 'wiim_out_coax'].includes(fromPortId) && toDeviceId === 'dac_fiio',
    severity: 'info',
    message: 'Выбери Optical или Coaxial выход в WiiM Home. В патч-панели каждому варианту соответствует свой вход Bifrost 3.',
  },
  {
    id: 'macbook_output_switch',
    check: fromDeviceId => fromDeviceId === 'macbook',
    severity: 'warning',
    message: 'macOS отправляет звук только на выбранное устройство. Проверь цифровой выход в настройках звука перед прослушиванием.',
  },
];

export function checkSystemRules(fromDeviceId, fromPortId, toDeviceId, toPortId) {
  return CRITICAL_RULES
    .filter(rule => rule.check(fromDeviceId, fromPortId, toDeviceId, toPortId))
    .map(({ id, severity, message, suggestion }) => ({ id, severity, message, suggestion }));
}

export const CABLE_LENGTHS = [0.3, 0.5, 1, 1.5, 2, 3, 5, 8, 10];

// Расчёт рекомендации по длине кабеля
export function getCableLengthWarning(connectorType, lengthMeters) {
  if (!Number.isFinite(lengthMeters) || connectorType === 'XLR_HIGH_LEVEL') return { warning: false };
  const spec = {
    RCA: 3,
    XLR: 15,
    USB_C: 2,
    USB_B: 2,
    OPTICAL: 10,
    COAXIAL: 5,
    SPEAKER: 10,
    JACK_3_5: 2,
    JACK_4_4: 2,
    JACK_6_35: 3,
    XLR4: 3,
    GROUND: 1,
    ADAPTER_44_XLR: 2,
  };
  const maxRecommended = spec[connectorType] || 5;
  if (lengthMeters > maxRecommended) {
    return {
      warning: true,
      message: `Длина ${lengthMeters}м превышает рекомендованный максимум ${maxRecommended}м для ${connectorType} - возможна деградация сигнала.`,
    };
  }
  return { warning: false };
}
