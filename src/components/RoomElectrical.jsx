import { ROOM_DEVICE_MAP, ROOM_PORT_MAP } from '../data/roomEquipment';
import { PASSPORT_GAPS, ELECTRICAL_SOURCES, portElectricalFacts, FREYA_MODES } from '../data/roomPassports';
import { useRoomWiring } from '../store/roomWiringStore';
import '../roomElectrical.css';

const number = (n, digits = 2) => Number.isFinite(n) ? n.toLocaleString('ru-RU', { maximumFractionDigits: digits }) : '—';
const labels = { inputImpedance: 'Входное сопротивление', outputImpedance: 'Выходное сопротивление', outputLevel: 'Выходной уровень', maxInputLevel: 'Предельный входной уровень' };
const passportPorts = { bifrost: ['rcaOut', 'xlrOut'], warmer: ['rcaOut', 'xlrOut'], freya: ['rca3', 'xlr1', 'rcaOut1', 'xlrOut'], a90: ['rcaIn', 'xlrIn', 'rcaOut', 'xlrOut'], rusich: ['rca1', 'xlr1'] };

function Fact({ fact }) {
  return <div className="electrical-fact"><b>{labels[fact.key]}: {fact.value === null ? 'нет данных' : `${number(fact.value)} ${fact.unit}`}</b><span>{fact.conditions}</span>{fact.reason && <span>{fact.reason}</span>}
    <small>{fact.status === 'published' ? 'Опубликовано производителем · не измерение экземпляра' : 'Не подтверждено'}{fact.revision ? ` · ${fact.revision}` : ' · ревизия не установлена'}{fact.checkedAt ? ` · проверено ${fact.checkedAt}` : ''}</small>
    {fact.source && <a href={fact.source.url} target="_blank" rel="noreferrer">{fact.source.name} ↗</a>}
  </div>;
}
export default function RoomElectrical({ report }) {
  const freyaMode = useRoomWiring(s => s.listening.freyaMode);
  return <section className="room-electrical" aria-labelledby="electrical-title">
    <header><div><small>ПАСПОРТА И РАСЧЁТЫ · 0.5</small><h2 id="electrical-title">Электрическое согласование</h2></div><span>{report.links.filter(l => l.loading).length} / {report.links.length} оценок нагрузки</span></header>
    <p>{report.notice}</p>
    <div className="electrical-links">{report.links.map(link => <article key={link.id}>
      <header><h3>{link.fromName} → {link.toName}</h3><span>{link.connector}</span></header>
      <p>{ROOM_PORT_MAP[link.from].label} → {ROOM_PORT_MAP[link.to].label}</p>
      {link.loading ? <div className="electrical-result" role="status"><b>Оценка нагрузки: {number(link.loading.transfer * 100)}% напряжения</b><span>{number(link.loading.lossDb, 3)} дБ относительно выхода без нагрузки</span><span>Rout = {number(link.output.impedance.value)} Ω; Rin = {number(link.input.impedance.value)} Ω{link.loading.ratio !== null ? `; отношение ${number(link.loading.ratio, 1)}×` : ''}.</span><small>Расчёт делителя напряжения. Порог «хорошо / плохо» и оценка звука не назначаются.</small></div> : <div className="electrical-missing" role="status"><b>Нагрузка не рассчитана</b>{[link.output.impedance, link.input.impedance].filter(f => f.value === null).map(f => <p key={`${f.device}-${f.key}`}>{ROOM_DEVICE_MAP[f.device].name}: {f.reason}</p>)}</div>}
      <p className="electrical-headroom">{link.headroomReason}</p>
      <details><summary>Исходные данные и источники</summary><Fact fact={link.output.impedance} /><Fact fact={link.input.impedance} /><Fact fact={link.output.level} /><Fact fact={link.input.level} /></details>
    </article>)}</div>
    {!report.links.length && <p>Нет полностью подключённых совместимых линейных кабелей. Сначала проверь соединения в патч-панели.</p>}
    <details className="electrical-method"><summary>Формула и границы расчёта</summary><code>{report.method.formula}</code><p>{report.method.scope}</p><a href={report.method.url} target="_blank" rel="noreferrer">Модель делителя · Analog Devices ↗</a></details>
    {report.digital.length > 0 && <div className="electrical-digital"><h3>Цифровое подключение WiiM</h3>{report.digital.map(d => <p key={d.id}><b>{ROOM_DEVICE_MAP[d.device].name} · {d.connector}: до 24 бит / {d.limit.value} кГц.</b> {d.note} <a href={d.limit.source.url} target="_blank" rel="noreferrer">Паспорт ↗</a></p>)}</div>}
    <div className="electrical-gain"><h3>Режим Freya 2</h3><p>{FREYA_MODES[freyaMode]?.label || 'Не указан в настройках прослушивания.'}{report.gain.value !== null ? ` · усиление каскада ×${report.gain.value}.` : ''}</p><p>{report.gain.reason} Для пассивного и гибридных режимов сопротивление активного выхода не подставляется автоматически.</p><a href={ELECTRICAL_SOURCES.freya.url} target="_blank" rel="noreferrer">Режимы по спецификации Freya 2 ↗</a></div>
    <details className="electrical-passports"><summary>Паспорта согласования · 5 аппаратов</summary><p>Первая проверенная часть базы: два ЦАПа, два предусилителя и заказной усилитель. Геометрия хранится отдельно; неизвестные параметры остальных аппаратов не заимствуются у похожих моделей.</p>{Object.entries(passportPorts).map(([device, keys]) => <details key={device}><summary>{ROOM_DEVICE_MAP[device].name}</summary><p>{PASSPORT_GAPS[device]}</p>{keys.map(key => { const port = ROOM_PORT_MAP[`${device}.${key}`], facts = portElectricalFacts(port, freyaMode); return <div key={key} className="passport-port"><h4>{port.label}</h4><Fact fact={facts.impedance} /><Fact fact={facts.level} /></div>; })}</details>)}</details>
  </section>;
}
