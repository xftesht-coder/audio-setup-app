import { assessSystem } from '../data/systemMatching';
import SignalTopology from './SignalTopology';

const STATUS = { ok: 'Проверено', unknown: 'Нужны данные', warning: 'Проверить', error: 'Не подключается' };
export default function SystemSummary({ plan, detailed = false }) {
  const result = assessSystem(plan);
  return <section className="system-summary" aria-label="Проверка выбранного тракта">
    <div className="system-section-title"><div><p className="share-eyebrow">ВЫБРАННЫЙ ТРАКТ · ПЛАН</p><h2>{result.hasErrors ? 'Есть несовместимые соединения' : 'Соединения и условия работы'}</h2></div><span className={`system-status ${result.hasErrors ? 'error' : 'unknown'}`}>{result.hasErrors ? 'Исправьте схему' : 'Проверка частичная'}</span></div>
    <SignalTopology result={result} />
    <details className="system-check-details"><summary>Проверка каждого соединения · {result.links.length}</summary><ol className="system-links">{result.links.map((link, index) => <li key={`${link.from.id}-${link.to.id}-${index}`}>
      <div className="system-link-heading"><b>{link.from.name} <span>→</span> {link.to.name}</b><span className={`system-status ${link.status}`}>{STATUS[link.status]}</span></div>
      <small>{link.connector === 'BINDING_POST' ? 'Акустический кабель · + / −' : link.connector === 'XLR_HIGH_LEVEL' ? 'Акустические клеммы → HIGH LEVEL → XLR на REL' : link.connector}</small>
      <ul>{link.checks.map((check, i) => <li key={i} className={`system-check ${check.status}`}><span aria-hidden="true">{check.status === 'ok' ? '✓' : check.status === 'error' ? '×' : '·'}</span>{check.text}</li>)}</ul>
    </li>)}</ol></details>
    <details className="system-caveats" open={detailed}><summary>Что ещё нужно согласовать</summary>{result.notes.map((note, i) => <p key={i} className={`system-check ${note.status}`}>{note.text}</p>)}<p>Проверяем тип сигнала, входы и выходы, известные сопротивления и режим стерео/моно. Совпадение разъёма не подтверждает все электрические параметры.</p></details>
  </section>;
}
