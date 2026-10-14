import { ROOM_DEVICE_MAP, ROOM_PORT_MAP } from './roomEquipment.js';
import { connectionCheck } from './roomWiring.js';
import { portElectricalFacts, FREYA_MODES, electricalFact, PASSPORT_DATE } from './roomPassports.js';

export const LOADING_METHOD = {
  url: 'https://www.analog.com/en/resources/glossary/voltage-divider.html',
  formula: 'k = Rin / (Rout + Rin); ΔL = 20 × log10(k)',
  scope: 'Оценка одного линейного соединения с резистивной нагрузкой относительно выхода без нагрузки. Не учитывает частоту, ёмкость кабеля, общие выходные каскады и другие параллельные нагрузки. Это не оценка качества звука или разрешение на подключение.',
};
export function loadingEstimate(output, input) {
  if (![output, input].every(f => f?.status === 'published' && f.unit === 'Ω' && f.revision && f.source?.url && Number.isFinite(f.value)) || output.value < 0 || input.value <= 0) return null;
  const transfer = input.value / (output.value + input.value);
  if (!Number.isFinite(transfer) || transfer <= 0) return null;
  return { transfer, lossDb: 20 * Math.log10(transfer), ratio: output.value === 0 ? null : input.value / output.value };
}
export function assessRoomElectrical(cables, listening) {
  const links = [];
  for (const cable of cables) {
    const from = ROOM_PORT_MAP[cable.from], to = ROOM_PORT_MAP[cable.to];
    if (from?.signal !== 'line' || to?.signal !== 'line' || !connectionCheck(cable.from, cable.to, cables, cable.id).ok) continue;
    const output = portElectricalFacts(from, listening.freyaMode), input = portElectricalFacts(to, listening.freyaMode);
    links.push({ id: cable.id, from: from.id, to: to.id, fromName: ROOM_DEVICE_MAP[from.device].name, toName: ROOM_DEVICE_MAP[to.device].name, connector: from.connector,
      output, input, loading: loadingEstimate(output.impedance, input.impedance), headroom: null,
      headroomReason: 'Запас до перегрузки не рассчитан: нужны предельные уровни, режимы, настройки громкости и условия нагрузки обоих аппаратов.' });
  }
  const digital = cables.flatMap(c => {
    const from = ROOM_PORT_MAP[c.from], to = ROOM_PORT_MAP[c.to];
    if (from?.device !== 'wiim' || !['bifrost', 'warmer'].includes(to?.device) || !['OPTICAL', 'COAX'].includes(to.connector) || !connectionCheck(c.from, c.to, cables, c.id).ok) return [];
    const maxKhz = to.device === 'warmer' && to.connector === 'OPTICAL' ? 96 : 192;
    return [{ id: c.id, device: to.device, connector: to.connector, limit: electricalFact(to.device, 'pcmSampleRate', maxKhz, 'kHz', `${to.connector}; PCM, до 24 бит`), note: 'Предел входа ЦАПа. Частота текущего трека и настройка выхода WiiM неизвестны; приложение их не переключает.' }];
  });
  const gainMode = FREYA_MODES[listening.freyaMode];
  return { version: 1, checkedAt: PASSPORT_DATE, scope: 'connected-line-cables', method: LOADING_METHOD, links, digital,
    gain: electricalFact('freya', 'voltageGain', gainMode?.gain ?? null, '×', gainMode?.label || 'Режим не указан', 'Коэффициент каскада до ослабления регулятором; не уровень на выходе и не запас до перегрузки.'),
    notice: 'Рассматриваются все соединённые линейные кабели, включая невыбранные ветки. Наличие сигнала, mute и включение аппаратов не подтверждены.' };
}
