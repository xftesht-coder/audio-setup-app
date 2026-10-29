import { useMemo, useState } from 'react';
import { compareLiveSystems } from '../data/liveComparison';

const status = { missing: 'Нет пути', blocked: 'Другой вход', unknown: 'Вход не указан', possible: 'Путь по кабелям', ready: 'Входы совпадают' };
const severity = { issue: 'Ошибка схемы', attention: 'Обрати внимание', unknown: 'Неизвестно' };
const change = { added: 'Добавлено', removed: 'Убрано', changed: 'Изменено' };

function Inspect({ id, hint, side, onInspect }) {
  return hint && <button className="compare-inspect" onClick={() => onInspect(id, hint)} title={`Откроет вариант ${side} в рабочей системе. Можно отменить.`}>Открыть {side} ↗</button>;
}
function Changes({ rows, before, after, onInspect }) {
  return rows.length ? <dl className="compare-changes">{rows.map(r => <div className="compare-change" key={r.id}>
    <dt><span data-change={r.kind}>{change[r.kind]}</span>{r.label}</dt>
    <dd><small>А · было</small><p>{r.before}</p><Inspect id={before.id} hint={r.beforeHint} side="А" onInspect={onInspect} /></dd>
    <dd><small>Б · станет</small><p>{r.after}</p><Inspect id={after.id} hint={r.afterHint} side="Б" onInspect={onInspect} /></dd>
  </div>)}</dl> : <p className="compare-empty">В этом разделе различий нет.</p>;
}
function Findings({ items, before, after, onInspect }) {
  return <ul className="compare-findings">{items.map(item => {
    const f = item.after || item.before;
    return <li key={item.id} data-level={f.level}>
      <div className="compare-finding-title"><strong>{f.title}</strong><span>{severity[f.level]}</span></div>
      {item.before && item.after && (item.before.level !== item.after.level || item.before.evidence !== item.after.evidence) ? <><p><b>А:</b> {severity[item.before.level]} · {item.before.evidence}</p><p><b>Б:</b> {severity[item.after.level]} · {item.after.evidence}</p></> : <p>{f.evidence}</p>}
      <Inspect id={item.after ? after.id : before.id} hint={item.after ? item.afterHint : item.beforeHint} side={item.after ? 'Б' : 'А'} onInspect={onInspect} />
    </li>;
  })}</ul>;
}

export default function LiveSystemComparison({ variants, onInspect }) {
  const [a, setA] = useState(variants[0]?.id || ''), [b, setB] = useState(variants[1]?.id || variants[0]?.id || '');
  const [tab, setTab] = useState('cables');
  const before = variants.find(v => v.id === a) || variants[0], after = variants.find(v => v.id === b) || variants[1] || variants[0];
  const report = useMemo(() => before && after ? compareLiveSystems(before.snapshot, after.snapshot) : null, [before, after]);
  if (!report) return <p className="compare-empty">Сначала сохрани варианты во вкладке «Мои варианты». Здесь появится их сравнение.</p>;
  const { findings } = report;
  const changedFindings = findings.added.length + findings.removed.length + findings.changed.length;
  const unknown = [...findings.added, ...findings.changed, ...findings.unchanged].filter(f => f.after?.level === 'unknown').length;
  const tabs = [['cables', 'Кабели', report.cables.length], ['inputs', 'Входы и состав', report.inputs.length], ['rack', 'Стойка', report.racks.reduce((n, r) => n + r.rows.length, 0)], ['findings', 'Замечания', changedFindings]];
  return <section className="live-comparison" aria-label="Сравнение сохранённых систем">
    <div className="compare-selectors"><label>А · исходный<select aria-label="Исходный вариант А" value={before.id} onChange={e => setA(e.target.value)}>{variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label><button aria-label="Поменять варианты местами" onClick={() => { setA(after.id); setB(before.id); }}>⇄</button><label>Б · сравнить с<select aria-label="Сравниваемый вариант Б" value={after.id} onChange={e => setB(e.target.value)}>{variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label></div>
    <p className="compare-context">Сравнение А → Б. Текущая система не меняется.</p>
    {!report.changed && !changedFindings && <p className="compare-equal" role="status">Различий нет.{before.id === after.id ? ' Выбран один и тот же вариант.' : ' Снимки одинаковы.'} Это не подтверждает аппаратную совместимость.</p>}
    <div className="compare-tabs" role="group" aria-label="Раздел сравнения">{tabs.map(([id, label, count]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}<b>{count}</b></button>)}</div>
    <div className="compare-content" key={tab + before.id + after.id}>
      {tab === 'cables' && <Changes rows={report.cables} before={before} after={after} onInspect={onInspect} />}
      {tab === 'inputs' && <Changes rows={report.inputs} before={before} after={after} onInspect={onInspect} />}
      {tab === 'rack' && <><p className="compare-context">Размеры и размещение сравниваются по проекту. Кабельные трассы стойки показаны отдельно от электрических соединений.</p>{report.racks.map(group => <details className="compare-rack-group" key={group.id} open={group.id === 'active'}><summary>{group.title}<span>{group.rows.length}</span></summary><Changes rows={group.rows} before={before} after={after} onInspect={onInspect} /></details>)}</>}
      {tab === 'findings' && <>
        <div className="compare-routes" aria-label="Пути к акустике">{report.routes.map(r => <div key={r.id}><strong>{r.name}</strong><span>{status[r.before]} → <b>{status[r.after]}</b></span></div>)}</div>
        <p className="compare-context">{report.modes[0] !== report.modes[1] ? 'Режимы проверки А и Б различаются: учёт входов может изменить результат без перестановки кабелей. ' : ''}Путь по кабелям не подтверждает питание, выбранные входы или наличие звука.</p>
        {!changedFindings && <p className="compare-empty">Замечания не изменились.</p>}
        {[['added', 'Появилось в Б'], ['changed', 'Изменилось в Б'], ['removed', 'Больше не отмечается в Б']].map(([key, title]) => findings[key].length > 0 && <section className="compare-finding-group" key={key}><h3>{title} · {findings[key].length}</h3>{key === 'removed' && <p className="compare-context">Причиной может быть отключённый тракт или смена режима проверки. Это не всегда исправление.</p>}<Findings items={findings[key]} before={before} after={after} onInspect={onInspect} /></section>)}
        <details className="compare-unchanged"><summary>Без изменений · {findings.unchanged.length}</summary><Findings items={findings.unchanged} before={before} after={after} onInspect={onInspect} /></details>
      </>}
    </div>
    <p className="compare-limit">В варианте Б неизвестных условий: {unknown}. Совпадение разъёмов не подтверждает электрическое согласование. «Открыть А / Б» применяет выбранный вариант и ведёт к соединению; это действие можно отменить.</p>
  </section>;
}
