// ============================================================
// СИСТЕМНЫЕ ПРАВИЛА И ПРЕДУПРЕЖДЕНИЯ ДЛЯ КОНКРЕТНОЙ СИСТЕМЫ
// ============================================================

// Критичные правила - специфичные комбинации устройств, которые опасны или неверны
export const CRITICAL_RULES = [
  {
    id: 'phono_line_level',
    check: (fromDeviceId, fromPortId, toDeviceId, toPortId) => {
      return toDeviceId === 'arcam' && toPortId === 'arcam_phono' &&
        fromDeviceId !== 'turntable';
    },
    severity: 'critical',
    message: '🔴 ОПАСНО: Phono вход Arcam SA10 предназначен ТОЛЬКО для сырого сигнала с MM картриджа напрямую с проигрывателя! Подключение линейного уровня (преамп, DAC) даст ~40dB лишнего усиления + неправильную RIAA коррекцию → искажения и риск повреждения акустики.',
    suggestion: 'Используй вход CD, PVR или STB для линейного сигнала.',
  },
  {
    id: 'fiio_no_volume',
    check: (fromDeviceId, fromPortId) => {
      return fromDeviceId === 'dac_fiio' && (fromPortId === 'fiio_out_rca' || fromPortId === 'fiio_out_xlr');
    },
    severity: 'info',
    message: 'ℹ️ FiiO WARMER R2R не имеет регулировки громкости - выход всегда фиксированного уровня (1.8Vrms RCA / 3.8Vrms XLR). Убедись, что следующее устройство в цепи (например A90) имеет регулировку громкости.',
  },
  {
    id: 'cayin_mode_switch',
    check: (fromDeviceId, fromPortId) => {
      return fromDeviceId === 'dac_cayin' && (fromPortId === 'cayin_out_35' || fromPortId === 'cayin_out_44');
    },
    severity: 'warning',
    message: '⚠️ Cayin RU7: переключи режим PO (Headphone) → LO (Line-Out) в меню устройства перед использованием как источник для преампа! В режиме PO сигнал будет управляться громкостью RU7, что может конфликтовать с гейном следующего устройства.',
  },
  {
    id: 'a90_input_switch',
    check: (fromDeviceId, fromPortId, toDeviceId, toPortId) => {
      return toDeviceId === 'a90' && (toPortId === 'a90_in_rca' || toPortId === 'a90_in_xlr');
    },
    severity: 'info',
    message: 'ℹ️ Topping A90 переключает вход (RCA/XLR) кнопкой на передней панели - используется только один источник за раз, даже если оба физически подключены.',
  },
  {
    id: 'ground_wire_needed',
    check: (fromDeviceId, fromPortId, toDeviceId, toPortId) => {
      return fromDeviceId === 'turntable' && toDeviceId === 'phono' && fromPortId === 'tt_out';
    },
    severity: 'tip',
    message: '💡 Не забудь также подключить земляной провод (Ground Wire) от проигрывателя к Ground терминалу на Schiit Skoll F для минимизации фона/гула.',
  },
  {
    id: 'speaker_no_biwire',
    check: (fromDeviceId, fromPortId, toDeviceId, toPortId) => {
      return toDeviceId === 'speakers';
    },
    severity: 'info',
    message: 'ℹ️ Acoustic Energy AE320 имеет одну пару binding posts - bi-wiring/bi-amping физически невозможен на этой модели.',
  },
  {
    id: 'gain_staging_hot',
    check: (fromDeviceId, fromPortId, toDeviceId, toPortId) => {
      return fromDeviceId === 'dac_fiio' && toDeviceId === 'a90' && toPortId === 'a90_in_xlr';
    },
    severity: 'warning',
    message: '⚠️ Gain Staging: WARMER R2R выдаёт 3.8Vrms по XLR - это довольно горячий уровень. На A90 рекомендуется Gain = Low при этом источнике, иначе диапазон регулировки громкости будет слишком узким сверху.',
  },
  {
    id: 'wiim_single_output',
    check: (fromDeviceId, fromPortId) => {
      return fromDeviceId === 'streamer_wiim';
    },
    severity: 'info',
    message: 'ℹ️ WiiM Pro Plus выводит звук только через ОДИН порт одновременно (RCA/Optical/Coaxial) — переключается в приложении WiiM Home. Убедись, что выбран правильный выход перед прослушиванием.',
  },
  {
    id: 'macbook_optical_default',
    check: (fromDeviceId, fromPortId) => {
      return fromDeviceId === 'macbook' && fromPortId === 'mb_optical';
    },
    severity: 'info',
    message: 'ℹ️ MacBook подключён по Optical в FiiO WARMER R2R (пресет по умолчанию). Хочешь Coaxial — удали этот кабель (кнопка "Удалить" в патч-листе) и вручную соедини порт "Coaxial Out" на MacBook с "Coaxial In" на FiiO кликом.',
  },
  {
    id: 'macbook_coaxial_selected',
    check: (fromDeviceId, fromPortId) => {
      return fromDeviceId === 'macbook' && fromPortId === 'mb_coaxial';
    },
    severity: 'info',
    message: 'ℹ️ MacBook подключён по Coaxial (обычно чуть выше качеством передачи, чем Optical, но требует USB-to-S/PDIF адаптер). Убедись, что выбран правильный выход звука в System Settings → Sound на Mac.',
  },
  {
    id: 'macbook_output_switch',
    check: (fromDeviceId) => {
      return fromDeviceId === 'macbook';
    },
    severity: 'warning',
    message: '⚠️ macOS выводит звук только на ОДНО устройство одновременно — выбери правильный цифровой выход (Optical или Coaxial adapter) в System Settings → Sound перед прослушиванием.',
  },
];

// Проверка всех правил для конкретного соединения
export function checkSystemRules(fromDeviceId, fromPortId, toDeviceId, toPortId) {
  return CRITICAL_RULES
    .filter(rule => rule.check(fromDeviceId, fromPortId, toDeviceId, toPortId))
    .map(rule => ({
      id: rule.id,
      severity: rule.severity,
      message: rule.message,
      suggestion: rule.suggestion,
    }));
}

// ============================================================
// ТИПОВЫЕ ДЛИНЫ КАБЕЛЕЙ (для калькулятора)
// ============================================================
export const CABLE_LENGTHS = [0.3, 0.5, 1, 1.5, 2, 3, 5, 8, 10];

// Расчёт рекомендации по длине кабеля
export function getCableLengthWarning(connectorType, lengthMeters) {
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
