import { useMemo, useState } from 'react';
import { auditRoom, LISTENING_SOURCES, portLabel } from '../data/roomIntelligence';
import { ROOM_DEVICE_MAP, ROOM_PORT_MAP } from '../data/roomEquipment';
import { downloadJson } from '../data/roomBackup';
import { useRoomWiring } from '../store/roomWiringStore';
import '../intelligence.css';

const levels = { issue: 'Исправить', attention: 'Проверить', unknown: 'Нет данных' };
export default function SystemIntelligence() {
  const cables = useRoomWiring(s => s.cables);
  const [source, setSource] = useState('wiim');
  const report = useMemo(() => auditRoom(cables, source), [cables, source]);
  const issues = report.findings.filter(f => f.level === 'issue').length;
  const devices = [...new Set(report.routes.flatMap(r => r.path.flatMap(c => [ROOM_PORT_MAP[c.from].device, ROOM_PORT_MAP[c.to].device])))];
  return <section className="system-intelligence" aria-labelledby="intelligence-title">
    <header className="intelligence-header"><div><span className="intelligence-eyebrow">SYSTEM INTELLIGENCE · 0.1</span><h1 id="intelligence-title">Проверка системы</h1><p>Что соединено, где обрыв и чего ещё не знаем.</p></div><a href="#room">Открыть комнату ↗</a></header>
    <div className="intelligence-scope"><strong>Проверяем сохранённые подключения комнаты</strong><p>Это та же схема, которую ты меняешь «За стойкой». Каталожный конфигуратор и старая патч-панель пока отдельно. Проверка описывает возможные пути; выбранные входы, громкость и включение реальных аппаратов ей неизвестны.</p></div>
    <div className="intelligence-controls"><label>Источник<select value={source} onChange={e => setSource(e.target.value)}>{LISTENING_SOURCES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button onClick={() => downloadJson('audio-setup-check.json', { ...report, createdAt: new Date().toISOString(), cables })}>Скачать отчёт</button></div>
    <div className="intelligence-summary" role="status"><b>{report.connected} / 4</b><span>путей к акустике найдено</span><strong>{issues ? `Замечаний по подключению: ${issues}` : 'Пути найдены; питание аппаратов показано'}</strong><small>Наличие пути не подтверждает качество звука или электрическое согласование. Остальные замечания — ниже.</small></div>
    <h2>От источника до акустики</h2><div className="intelligence-routes">{report.routes.map(route => <article key={route.id} className={route.connected ? 'route-found' : 'route-missing'}><header><h3>{route.name}</h3><span>{route.connected ? 'Путь найден' : 'Нет пути'}</span></header>{route.connected ? <><p className="intelligence-chain">{[source, ...route.path.map(c => ROOM_PORT_MAP[c.to].device)].map(id => ROOM_DEVICE_MAP[id].name).join(' → ')}</p><details><summary>Разъёмы и кабели</summary><ol>{route.path.map(c => <li key={c.id}>{portLabel(c.from)}<br />→ {portLabel(c.to)}</li>)}</ol></details></> : <p>Проверь подключения «За стойкой». Неиспользуемую ветку можно оставить отключённой.</p>}</article>)}</div>
    <h2>Основания и следующий шаг</h2><div className="intelligence-findings">{report.findings.map(f => <article key={f.id} className={`finding-${f.level}`}><span>{levels[f.level]}</span><h3>{f.title}</h3><p>{f.evidence}</p><p className="finding-next"><b>Дальше:</b> {f.next}</p></article>)}</div>
    <details className="intelligence-references"><summary>Паспорта устройств в найденных путях</summary>{devices.length ? devices.map(id => {const d = ROOM_DEVICE_MAP[id];return <p key={id}><b>{d.name}</b> — {d.accuracy} {d.source && <a href={d.source} target="_blank" rel="noreferrer">Источник ↗</a>}</p>;}) : <p>Полные пути пока не найдены.</p>}</details>
    <footer>Следующий этап: единая схема во всех разделах → паспорта с измерениями → сравнение замен → цены рынка. <a href="https://github.com/xftesht-coder/audio-setup-app/blob/main/ROADMAP.md" target="_blank" rel="noreferrer">Roadmap проекта ↗</a></footer>
  </section>;
}
