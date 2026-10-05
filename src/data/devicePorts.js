import { REL_QUAKE } from './listeningRoom.js';

// ============================================================
// ПОЛНАЯ БАЗА ДАННЫХ ПОРТОВ УСТРОЙСТВ
// Составлено на основе официальной документации производителей
// ============================================================

// Типы разъёмов и их визуальные/технические свойства
export const CONNECTOR_TYPES = {
  SPEAKON_HIGH_LEVEL: {
    id: 'SPEAKON_HIGH_LEVEL', name: 'Neutrik Speakon · HIGH LEVEL',
    category: 'speaker', color: '#506f81', impedance: 'high-level 100kΩ',
  },
  RCA: {
    id: 'RCA',
    name: 'RCA (Cinch)',
    category: 'analog',
    color: '#E63946',
    maxLength: 3, // метры, рекомендуемая макс длина без деградации
    impedance: 'unbalanced',
  },
  XLR: {
    id: 'XLR',
    name: 'XLR (Balanced)',
    category: 'analog',
    color: '#F4A261',
    maxLength: 15,
    impedance: 'balanced',
  },
  USB_C: {
    id: 'USB_C',
    name: 'USB-C',
    category: 'digital',
    color: '#2A9D8F',
    maxLength: 2,
    impedance: 'digital',
  },
  USB_B: {
    id: 'USB_B',
    name: 'USB-B',
    category: 'digital',
    color: '#2A9D8F',
    maxLength: 2,
    impedance: 'digital',
  },
  OPTICAL: {
    id: 'OPTICAL',
    name: 'Optical (Toslink)',
    category: 'digital',
    color: '#E9C46A',
    maxLength: 10,
    impedance: 'digital',
  },
  COAXIAL: {
    id: 'COAXIAL',
    name: 'Coaxial (RCA digital)',
    category: 'digital',
    color: '#E9C46A',
    maxLength: 5,
    impedance: 'digital-75ohm',
  },
  SPEAKER: {
    id: 'SPEAKER',
    name: 'Speaker Cable',
    category: 'speaker',
    color: '#264653',
    maxLength: 10,
    impedance: 'speaker',
  },
  JACK_3_5: {
    id: 'JACK_3_5',
    name: '3.5mm Jack',
    category: 'analog',
    color: '#8ECAE6',
    maxLength: 2,
    impedance: 'unbalanced',
  },
  JACK_4_4: {
    id: 'JACK_4_4',
    name: '4.4mm Pentaconn (Balanced)',
    category: 'analog',
    color: '#F4A261',
    maxLength: 2,
    impedance: 'balanced',
  },
  JACK_6_35: {
    id: 'JACK_6_35',
    name: '6.35mm Jack',
    category: 'analog',
    color: '#8ECAE6',
    maxLength: 3,
    impedance: 'unbalanced',
  },
  XLR4: {
    id: 'XLR4',
    name: '4-Pin XLR (Headphone)',
    category: 'analog',
    color: '#F4A261',
    maxLength: 3,
    impedance: 'balanced',
  },
  GROUND: {
    id: 'GROUND',
    name: 'Ground Wire',
    category: 'ground',
    color: '#6C757D',
    maxLength: 1,
    impedance: 'ground',
  },
  ADAPTER_44_XLR: {
    id: 'ADAPTER_44_XLR',
    name: '4.4mm → 2×XLR Adapter Cable',
    category: 'adapter',
    color: '#9D4EDD',
    maxLength: 2,
    impedance: 'balanced',
    isAdapter: true,
    adapterFrom: 'JACK_4_4',
    adapterTo: 'XLR',
  },
};

// Известные переходные кабели (не прямая совместимость 1-в-1, но существуют готовые адаптер-кабели)
export const KNOWN_ADAPTERS = [
  { from: 'JACK_4_4', to: 'XLR', adapterType: 'ADAPTER_44_XLR', note: 'Специальный кабель 4.4mm Pentaconn (male) → 2x XLR3 (male), балансный сигнал сохраняется.' },
];

// ============================================================
// ПОЛНАЯ СПЕЦИФИКАЦИЯ УСТРОЙСТВ С РЕАЛЬНЫМИ ПОРТАМИ
// ============================================================

function relQuakeSpec(id, side) {
  return {
    id, name: `REL Quake ${side}`, fullName: 'REL Quake · активный сабвуфер',
    category: 'subwoofer', manufacturer: 'REL', width: 110, height: 95,
    color: '#bac5c6', hasBack: true,
    ports: [
      { id: `${id}_hi`, type: 'SPEAKON_HIGH_LEVEL', direction: 'input', label: 'HIGH LEVEL · Speakon', position: 'rear', count: 1, impedance: '100kΩ', notes: 'Штатный высокоуровневый вход. Фактическое подключение владельца пока не подтверждено.' },
      { id: `${id}_low`, type: 'RCA', direction: 'input', label: 'LOW LEVEL / LFE · RCA', position: 'rear', count: 1, notes: 'Монофонический линейный вход; это другой тракт, чем HIGH LEVEL.' },
    ],
    specs: { 'Габариты Ш × В × Г': '253 × 294 × 272 мм', 'Масса': '7,4 кг', 'Динамик': '200 мм · вниз', 'Корпус': 'Закрытый', 'Питание': 'Свой фильтр на 3 розетки у стены' },
    warnings: [REL_QUAKE.connection.note],
    verifiedSources: [{ name: 'REL Q-Series manual · Quake · стр. 8, 23', url: REL_QUAKE.source }],
    sourceDoc: 'Официальное руководство REL Q-Series',
  };
}

export const DEVICE_SPECS = {
  sub_left: relQuakeSpec('sub_left', 'L'),
  sub_right: relQuakeSpec('sub_right', 'R'),
  // ---------------- ИСТОЧНИК: ВИНИЛ ----------------
  turntable: {
    id: 'turntable',
    name: 'Pro-Ject E1',
    fullName: 'Pro-Ject E1 Phono Turntable',
    category: 'source',
    manufacturer: 'Pro-Ject Audio Systems',
    width: 90,
    height: 60,
    color: '#D4C5B9',
    hasBack: true,
    ports: [
      {
        id: 'tt_out',
        type: 'RCA',
        direction: 'output',
        label: 'Phono/Line Out',
        position: 'rear',
        count: 2, // stereo pair
        notes: 'Switchable PHONO or LINE output. Gold-plated female RCA.',
      },
      {
        id: 'tt_ground',
        type: 'GROUND',
        direction: 'output',
        label: 'Ground Wire',
        position: 'rear',
        count: 1,
        notes: 'Earthing wire from tonearm - connect to amp/phono ground terminal.',
      },
    ],
    verifiedSources: [
      { name: 'Pro-Ject Audio Systems (официальный сайт)', url: 'https://www.project-audio.com/en/product/e1-phono/' },
      { name: 'E1 Instruction Manual (PDF)', url: 'https://www.project-audio.com/wp-content/uploads/2022/05/E1_UNI-Userguide.pdf' },
      { name: 'Digital Trends (обзор)', url: 'https://www.digitaltrends.com/home-theater/pro-ject-e1-turntable-review/' },
    ],
    photoQuery: 'Pro-Ject E1 turntable',
    sourceDoc: 'Pro-Ject E1 Instruction Manual + Digital Trends review',
  },

  // ---------------- ФОНОКОРРЕКТОР ----------------
  phono: {
    id: 'phono',
    name: 'Schiit Skoll F',
    fullName: 'Schiit Skoll F Balanced Phono Preamp',
    category: 'phono_stage',
    manufacturer: 'Schiit Audio',
    width: 80,
    height: 50,
    color: '#D4B5A0',
    hasBack: true,
    ports: [
      {
        id: 'phono_in_rca',
        type: 'RCA',
        direction: 'input',
        label: 'RCA In (Single-Ended)',
        position: 'rear',
        count: 2,
        notes: 'Single-ended input from turntable RCA. Рекомендуется для большинства проигрывателей.',
      },
      {
        id: 'phono_in_xlr',
        type: 'XLR',
        direction: 'input',
        label: 'XLR In (Balanced)',
        position: 'rear',
        count: 2,
        notes: 'Балансный вход - редкость для проигрывателей. ⚠️ На форумах (Tracking Angle) есть репорты о проблемах совместимости с некоторыми DIN→XLR кабелями от тонармов Kuzma - если шумит, попробуй RCA вход.',
      },
      {
        id: 'phono_out_rca',
        type: 'RCA',
        direction: 'output',
        label: 'RCA Out (Single-Ended)',
        position: 'rear',
        count: 2,
        notes: 'Always active - can run simultaneously with XLR out.',
      },
      {
        id: 'phono_out_xlr',
        type: 'XLR',
        direction: 'output',
        label: 'XLR Out (Balanced)',
        position: 'rear',
        count: 2,
        notes: 'Always active - can run simultaneously with RCA out.',
      },
      {
        id: 'phono_ground',
        type: 'GROUND',
        direction: 'input',
        label: 'Ground Terminal',
        position: 'rear',
        count: 1,
        notes: 'Connect turntable ground wire here for hum reduction.',
      },
    ],
    settings: {
      gainOptions: ['40dB', '50dB', '60dB', '70dB'],
      resistiveLoad: '47kΩ, 10Ω, 50Ω, 100Ω, 150Ω (5 steps)',
      capacitiveLoad: '50, 100, 150, 200pF (4 steps)',
      lfFilter: 'Off / 2-pole 15Hz passive',
    },
    verifiedSources: [
      { name: 'Schiit Audio (официальный сайт)', url: 'https://www.schiit.com/products/skoll-f' },
      { name: 'Schiit Skoll F Manual (PDF)', url: 'https://www.schiit.com/public/upload/PDF/skoll%20f%20manual%201_1.pdf' },
      { name: 'Tracking Angle (форум, известные проблемы)', url: 'https://trackingangle.com/equipment/schiit-skoll-is-not-a-schiit-show' },
      { name: 'Future Audiophile Magazine (обзор + фото задней панели)', url: 'https://futureaudiophile.com/schiit-skoll-f-phonostage-reviewed/' },
    ],
    photoQuery: 'Schiit Skoll F phono preamp',
    sourceDoc: 'Schiit Skoll F Manual + Tracking Angle forum + Future Audiophile review',
  },

  // ---------------- ЦАП: Schiit Bifrost 3 ----------------
  // Stable legacy IDs preserve saved projects and cable connections.
  dac_fiio: {
    id: 'dac_fiio',
    name: 'Schiit Bifrost 3',
    fullName: 'Schiit Bifrost 3 Mesh DAC',
    category: 'dac',
    manufacturer: 'Schiit',
    width: 90,
    height: 55,
    color: '#C4A5A0',
    hasBack: true,
    ports: [
      {
        id: 'fiio_usb',
        type: 'USB_C',
        direction: 'input',
        label: 'USB-C (Unison 384) In',
        position: 'rear',
        count: 1,
        notes: 'Unison 384: PCM до 32 бит / 384 кГц.',
      },
      {
        id: 'fiio_optical',
        type: 'OPTICAL',
        direction: 'input',
        label: 'Optical In',
        position: 'rear',
        count: 1,
        notes: 'PCM до 24 бит / 192 кГц.',
      },
      {
        id: 'fiio_coaxial',
        type: 'COAXIAL',
        direction: 'input',
        label: 'Coaxial In',
        position: 'rear',
        count: 1,
        notes: 'PCM до 24 бит / 192 кГц.',
      },
      {
        id: 'fiio_out_rca',
        type: 'RCA',
        direction: 'output',
        label: 'RCA Out',
        position: 'rear',
        count: 2,
        voltage: '2.0Vrms',
        notes: 'Максимальный выход 2 Vrms. Внутреннее управление громкостью Forkbeard описано производителем; фактическую настройку проверить на устройстве.',
      },
      {
        id: 'fiio_out_xlr',
        type: 'XLR',
        direction: 'output',
        label: 'XLR Out (Balanced)',
        position: 'rear',
        count: 2,
        voltage: '4.0Vrms',
        notes: 'Максимальный выход 4 Vrms. Внутреннее управление громкостью Forkbeard описано производителем; фактическую настройку проверить на устройстве.',
      },
    ],
    warnings: ['Громкость и EQ доступны через Forkbeard. Перед прослушиванием проверь уровень на Bifrost и усилителе.'],
    verifiedSources: [{ name: 'Schiit Bifrost 3 — официальные характеристики', url: 'https://www.schiit.com/products/bifrost-3' }],
    photoQuery: 'Schiit Bifrost 3 DAC',
    sourceDoc: 'Schiit Bifrost 3 official specifications',
  },

  // ---------------- ЦАП: Cayin RU7 ----------------
  dac_cayin: {
    id: 'dac_cayin',
    name: 'Cayin RU7',
    fullName: 'Cayin RU7 Portable DAC/AMP',
    category: 'dac_portable',
    manufacturer: 'Cayin',
    width: 70,
    height: 40,
    color: '#B5A5A0',
    hasBack: true,
    ports: [
      {
        id: 'cayin_usb',
        type: 'USB_C',
        direction: 'input',
        label: 'USB-C In',
        position: 'side',
        count: 1,
        notes: 'PCM up to 384kHz, native DSD64-DSD256.',
      },
      {
        id: 'cayin_out_35',
        type: 'JACK_3_5',
        direction: 'output',
        label: '3.5mm SE Out (PO/LO)',
        position: 'side',
        count: 1,
        voltage: '1.2Vrms (Line-Out mode)',
        notes: 'Dual function: Headphone (160mW@32Ω) or Line-Out (fixed 1.2Vrms).',
      },
      {
        id: 'cayin_out_44',
        type: 'JACK_4_4',
        direction: 'output',
        label: '4.4mm Balanced Out (PO/LO)',
        position: 'side',
        count: 1,
        voltage: '2.4Vrms (Line-Out mode)',
        notes: 'Dual function: Headphone (400mW@32Ω) or Line-Out (fixed 2.4Vrms).',
      },
    ],
    warnings: [
      'Нужно переключить режим PO (headphone) → LO (line-out) в меню перед использованием как источник для A90!',
      'В режиме Line-Out громкость фиксирована - НЕ регулируется кнопками.',
    ],
    verifiedSources: [
      { name: 'Cayin (официальный сайт)', url: 'https://en.cayin.cn/features/7/124/603.html' },
      { name: 'Headfonics (обзор + фото портов)', url: 'https://headfonics.com/cayin-ru7-review/' },
      { name: 'Head-Fi.org (форум, обсуждение LO функции)', url: 'https://www.head-fi.org/showcase/cayin-ru7.26493/' },
      { name: 'Frieve Audio Review (независимые измерения)', url: 'https://audioreview.frieve.com/products/en/cayin-ru7/' },
    ],
    photoQuery: 'Cayin RU7 dongle DAC',
    sourceDoc: 'Cayin official specs + Headfonics + Head-Fi forum + Frieve measurements',
  },

  // ---------------- ПРЕАМП: Topping A90 ----------------
  a90: {
    id: 'a90',
    name: 'Topping A90',
    fullName: 'Topping A90 Discrete Preamp/Headphone Amp',
    category: 'preamp',
    manufacturer: 'Topping',
    width: 95,
    height: 60,
    color: '#A59585',
    hasBack: true,
    ports: [
      {
        id: 'a90_in_rca',
        type: 'RCA',
        direction: 'input',
        label: 'RCA In',
        position: 'rear',
        count: 2,
        impedance: '2kΩ (est.)',
        notes: 'Single-ended input.',
      },
      {
        id: 'a90_in_xlr',
        type: 'XLR',
        direction: 'input',
        label: 'XLR In (Balanced)',
        position: 'rear',
        count: 2,
        notes: 'Balanced input - max input sensitivity 9.1Vrms high-gain.',
      },
      {
        id: 'a90_out_rca',
        type: 'RCA',
        direction: 'output',
        label: 'RCA Pre-Out',
        position: 'rear',
        count: 2,
        impedance: '20Ω output',
        notes: 'Preamp output - simultaneous with XLR out possible.',
      },
      {
        id: 'a90_out_xlr',
        type: 'XLR',
        direction: 'output',
        label: 'XLR Pre-Out (Balanced)',
        position: 'rear',
        count: 2,
        impedance: '40Ω output',
        notes: 'Preamp output - up to 49Vpp on mid/high gain.',
      },
      {
        id: 'a90_hp_xlr4',
        type: 'XLR4',
        direction: 'output',
        label: '4-Pin XLR Headphone',
        position: 'front',
        count: 1,
        power: '7600mW@16Ω',
        notes: 'Balanced headphone output.',
      },
      {
        id: 'a90_hp_44',
        type: 'JACK_4_4',
        direction: 'output',
        label: '4.4mm Balanced Headphone',
        position: 'front',
        count: 1,
        power: '7600mW@16Ω',
        notes: 'Balanced headphone output.',
      },
      {
        id: 'a90_hp_635',
        type: 'JACK_6_35',
        direction: 'output',
        label: '6.35mm SE Headphone',
        position: 'front',
        count: 1,
        power: '3300mW@16Ω',
        notes: 'Single-ended headphone output.',
      },
      {
        id: 'a90_trigger',
        type: 'JACK_3_5',
        direction: 'io',
        label: '12V Trigger',
        position: 'rear',
        count: 1,
        notes: 'For syncing power with other devices.',
      },
    ],
    settings: {
      gainLevels: ['Low', 'Mid', 'High'],
      modes: ['Headphone Amp', 'Preamp', 'Simultaneous'],
      groundLift: 'GND / LIFT switch on rear',
    },
    warnings: [
      'RCA и XLR входы переключаются кнопкой - нельзя использовать оба одновременно как вход.',
      'GND/LIFT переключатель - используй LIFT при гуле от земляной петли.',
    ],
    verifiedSources: [
      { name: 'Topping Audio (официальный сайт)', url: 'https://www.toppingaudio.com/product-item/a90-discrete' },
      { name: 'A90 Discrete User Manual', url: 'https://toppingaudio.com/download/a90-discrete-user-manual' },
      { name: 'Audio Science Review (ASR) — измерения + фото задней панели', url: 'https://www.audiosciencereview.com/forum/index.php?threads/topping-a90-discrete-review-headphone-amp-preamp.35114/' },
      { name: 'ecoustics.com (обзор, подтверждает 2 XLR + 2 RCA пары)', url: 'https://www.ecoustics.com/reviews/topping-a90/' },
      { name: 'Headfonics (детальный обзор портов)', url: 'https://headfonics.com/topping-a90-review/' },
    ],
    photoQuery: 'Topping A90 Discrete',
    sourceDoc: 'Topping official manual + ASR measurements + ecoustics + Headfonics',
  },

  // По чертежу владельца; внутренний ID новый, поля без размеров на чертеже оставлены неизвестными.
  rusich_a2: {
    id: 'rusich_a2',
    name: 'Rusich ALEPH PASS A2',
    fullName: 'Rusich ALEPH PASS A2 · усилитель мощности, класс A, dual mono',
    category: 'power_amp',
    manufacturer: 'Rusich',
    width: 430,
    height: 180,
    color: '#bfc1bf',
    hasBack: true,
    ports: [
      { id: 'rusich_rca1', type: 'RCA', direction: 'input', label: 'RCA 1 · stereo', position: 'rear', count: 2, notes: 'Вход RCA 1, L/R; выбранный вход задаётся селектором на корпусе.' },
      { id: 'rusich_rca2', type: 'RCA', direction: 'input', label: 'RCA 2 · stereo', position: 'rear', count: 2, notes: 'Вход RCA 2, L/R; выбранный вход задаётся селектором на корпусе.' },
      { id: 'rusich_xlr1', type: 'XLR', direction: 'input', label: 'XLR 1 · stereo balanced', position: 'rear', count: 2, notes: 'Балансный вход XLR 1, L/R.' },
      { id: 'rusich_xlr2', type: 'XLR', direction: 'input', label: 'XLR 2 · stereo balanced', position: 'rear', count: 2, notes: 'Балансный вход XLR 2, L/R.' },
      { id: 'rusich_speakers', type: 'SPEAKER', direction: 'output', label: 'Выходы на акустику · L/R', position: 'rear', count: 4, notes: 'На чертеже показаны отдельные клеммы «+ / −» для правого и левого каналов.' },
    ],
    settings: { topology: 'Dual mono', amplifierClass: 'Class A', inputSelector: ['RCA 1', 'RCA 2', 'XLR 1', 'XLR 2'], mains: '230 V AC; предохранитель 10 A (маркировка чертежа)' },
    warnings: ['Присланный чертёж подтверждает входы и выходы, но не указывает массу, глубину, выходную мощность, потребление и точную раскладку разъёмов. Измерьте и сверьте их перед изготовлением стойки и кабелей.'],
    verifiedSources: [],
    photoQuery: '',
    sourceDoc: 'Чертёж владельца: ALEPH PASS A2 Антон Р.pdf, лист 1; ширина 430 мм, высота 180 мм.',
  },

  // ---------------- АКУСТИКА: AE320 ----------------
  speakers: {
    id: 'speakers',
    name: 'Acoustic Energy AE320',
    fullName: 'Acoustic Energy AE320 Floorstanding Speaker',
    category: 'speakers',
    manufacturer: 'Acoustic Energy',
    width: 110,
    height: 120,
    color: '#8A7565',
    hasBack: true,
    ports: [
      {
        id: 'speaker_input',
        type: 'SPEAKER',
        direction: 'input',
        label: 'Binding Posts',
        position: 'rear',
        count: 2,
        impedance: '8Ω nominal',
        sensitivity: '90dB',
        powerHandling: '200W',
        notes: 'Single pair binding posts - NO bi-wiring/bi-amping possible on this model.',
      },
    ],
    specs: {
      type: '3-way, reflex loaded floorstanding',
      impedance: '8Ω nominal',
      sensitivity: '90dB',
      frequencyResponse: '35Hz - 30kHz',
      powerHandling: '200W',
      peakSPL: '116dB',
    },
    verifiedSources: [
      { name: 'The Ear (детальный обзор + фото задней панели)', url: 'https://the-ear.net/review-hardware/acoustic-energy-ae320-floorstanding-loudspeaker/' },
      { name: 'Audiograde (обзор, подтверждает single pair binding posts)', url: 'https://audiograde.uk/review/ae320/' },
      { name: 'StereoNET (независимый обзор)', url: 'https://www.stereonet.com/reviews/acoustic-energy-ae320-floorstanding-loudspeaker-review' },
      { name: 'HiFi Boutique (спецификации производителя)', url: 'https://www.hifiboutique.us/products/acoustic-energy-ae320' },
    ],
    photoQuery: 'Acoustic Energy AE320 speaker',
    sourceDoc: 'The Ear + Audiograde + StereoNET reviews + manufacturer specs',
  },

  // ---------------- НАУШНИКИ: HD650 ----------------
  headphones: {
    id: 'headphones',
    name: 'Sennheiser HD 650',
    fullName: 'Sennheiser HD 650 Open-Back Headphones',
    category: 'headphones',
    manufacturer: 'Sennheiser',
    width: 60,
    height: 60,
    color: '#7A6555',
    hasBack: false,
    ports: [
      {
        id: 'hd650_plug',
        type: 'JACK_4_4',
        direction: 'input',
        label: '4.4mm Plug (via cable)',
        position: 'cable',
        count: 1,
        impedance: '300Ω',
        notes: 'Stock cable is 6.35mm; using 4.4mm requires aftermarket balanced cable.',
      },
    ],
    sourceDoc: 'User system reference',
  },

  // ---------------- СТРИМЕР: WiiM Pro Plus ----------------
  streamer_wiim: {
    id: 'streamer_wiim',
    name: 'WiiM Pro Plus',
    fullName: 'WiiM Pro Plus Hi-Res Audio Streamer',
    category: 'streamer',
    manufacturer: 'WiiM (Linkplay)',
    width: 90,
    height: 50,
    color: '#C9C0B8',
    hasBack: true,
    photoQuery: 'WiiM Pro Plus streamer',
    ports: [
      {
        id: 'wiim_out_rca',
        type: 'RCA',
        direction: 'output',
        label: 'RCA Line Out',
        position: 'rear',
        count: 2,
        voltage: 'до 2Vrms (переменный) / фиксированный в режиме Fixed Volume',
        notes: 'Использует встроенный ЦАП AKM AK4493SEQ. Громкость регулируется либо с самого WiiM (App), либо через "Fixed Volume" для управления с амплифайера.',
      },
      {
        id: 'wiim_out_optical',
        type: 'OPTICAL',
        direction: 'output',
        label: 'Optical (SPDIF) Out',
        position: 'rear',
        count: 1,
        notes: 'До 192kHz/24-bit. Для вывода в отдельный ЦАП (например Schiit Bifrost 3).',
      },
      {
        id: 'wiim_out_coax',
        type: 'COAXIAL',
        direction: 'output',
        label: 'Coaxial Out',
        position: 'rear',
        count: 1,
        notes: 'До 192kHz/24-bit. Обычно чуть выше качеством передачи, чем optical.',
      },
    ],
    warnings: [
      '⚠️ По официальному мануалу WiiM Pro Plus выводит звук ТОЛЬКО через один порт одновременно (RCA / Optical / Coaxial) — переключается в приложении WiiM Home, не работает параллельно на все три.',
      'Если используешь Optical/Coaxial в другой ЦАП — включи "Fixed Volume" и отключи EQ в приложении, чтобы не было двойной обработки сигнала.',
    ],
    verifiedSources: [
      { name: 'WiiM (официальные характеристики)', url: 'https://wiimhome.com/WiiMPro/specs' },
      { name: 'WiiM Pro Plus User Manual (PDF)', url: 'https://www.wiimhome.com/pdf/WiiM%20Pro%20Plus%20User%20Manual.pdf' },
      { name: 'FCC Filing (полная тех. документация)', url: 'https://fcc.report/FCC-ID/2BABF-ASR003/6687668.pdf' },
      { name: 'SoundPath Lab (независимый разбор портов)', url: 'https://www.soundpathlab.com/wiim-pro-plus-explained-inputs-outputs-streaming-dsp-and-who-it-is-for/' },
    ],
    sourceDoc: 'WiiM official specs + User Manual + FCC filing + SoundPath Lab',
  },

  // ---------------- СТРИМЕР: MacBook ----------------
  macbook: {
    id: 'macbook',
    name: 'MacBook',
    fullName: 'MacBook (as digital streamer)',
    category: 'streamer',
    manufacturer: 'Apple',
    width: 90,
    height: 50,
    color: '#B8BCC0',
    hasBack: false,
    photoQuery: 'MacBook laptop',
    ports: [
      {
        id: 'mb_optical',
        type: 'OPTICAL',
        direction: 'output',
        label: 'Optical Out (3.5mm combo jack + mini-Toslink адаптер)',
        position: 'side',
        count: 1,
        notes: 'Комбинированный аудио-разъём MacBook поддерживает цифровой optical (Toslink) выход через переходник mini-jack → Toslink. До 24bit/96kHz.',
      },
      {
        id: 'mb_coaxial',
        type: 'COAXIAL',
        direction: 'output',
        label: 'Coaxial Out (через USB-DAC/USB-Coax адаптер)',
        position: 'side',
        count: 1,
        notes: 'У MacBook нет нативного coaxial выхода - требуется USB-to-S/PDIF (coax) конвертер, подключаемый через USB-C.',
      },
    ],
    warnings: [
      'macOS выводит звук только на ОДНО устройство одновременно - выбери правильный выход в System Settings → Sound перед прослушиванием.',
      'Optical и Coaxial выходы не могут использоваться одновременно - это два разных физических адаптера.',
    ],
    sourceDoc: 'Apple audio combo jack spec (optical via mini-Toslink) + generic USB-to-S/PDIF adapter behavior',
  },
};

// ============================================================
// МАТРИЦА СОВМЕСТИМОСТИ РАЗЪЁМОВ
// ============================================================
export const COMPATIBILITY_MATRIX = {
  RCA: ['RCA'],
  XLR: ['XLR'],
  USB_C: ['USB_C'],
  USB_B: ['USB_B'],
  OPTICAL: ['OPTICAL'],
  COAXIAL: ['COAXIAL'],
  SPEAKER: ['SPEAKER'],
  JACK_3_5: ['JACK_3_5'],
  JACK_4_4: ['JACK_4_4'],
  JACK_6_35: ['JACK_6_35'],
  XLR4: ['XLR4'],
  GROUND: ['GROUND'],
};

// Проверка совместимости двух портов
export function checkCompatibility(portA, portB) {
  if (portA.direction === portB.direction) {
    return {
      compatible: false,
      reason: `Оба порта имеют направление "${portA.direction}" - нужен один output и один input.`,
    };
  }
  if (portA.type === portB.type) {
    return { compatible: true, connectorType: portA.type };
  }
  // Проверяем известные переходные кабели (в любом направлении)
  const adapter = KNOWN_ADAPTERS.find(
    a => (a.from === portA.type && a.to === portB.type) || (a.from === portB.type && a.to === portA.type)
  );
  if (adapter) {
    return {
      compatible: true,
      connectorType: adapter.adapterType,
      isAdapter: true,
      adapterNote: adapter.note,
    };
  }
  return {
    compatible: false,
    reason: `Несовместимые разъёмы: ${portA.type} ≠ ${portB.type}. Готового переходника для этой пары нет в базе.`,
  };
}
