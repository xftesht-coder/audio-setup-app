import { useState } from 'react';
import { AUDIO_MODELS } from '../data/audioModels';
import { comparisonValues, exportVariants, MAX_IMPORT_BYTES, MAX_VARIANTS, samePlan } from '../data/systemVariants';
import { systemShareUrl } from '../data/systemMatching';
import { useSystemPlanStore } from '../stores/useSystemPlanStore';

export default function SystemVariants() {
  const { plan, variants, saveVariant, loadVariant, deleteVariant, restoreDeleted, deleted, importFile } = useSystemPlanStore();
  const [name, setName] = useState(''), [message, setMessage] = useState(''), [compareId, setCompareId] = useState('');
  const comparison = variants.find(v => v.id === compareId);
  const currentRows = comparisonValues(plan), otherRows = comparison ? comparisonValues(comparison.plan) : [];
  const attempt = action => { try { action(); } catch (error) { setMessage(error.message); } };
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportVariants(variants)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'audio-setup-variants.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Скачана резервная копия сохранённых вариантов. Мебель экспортируется отдельно в редакторе стойки.');
  };
  return <section className="system-variants" aria-label="Варианты системы">
    <div className="system-section-title"><div><p className="share-eyebrow">СЛУШАТЬ · СРАВНИВАТЬ · СОХРАНЯТЬ</p><h2>Твои варианты</h2></div><span className="system-status">{variants.length} / {MAX_VARIANTS}</span></div>
    <p className="variant-help">Сохрани настройки под своим названием. Варианты живут в этом браузере; файл переносит их на другой компьютер. Аппараты на полках сохраняются при переключении.</p>
    <form className="variant-save" onSubmit={event => { event.preventDefault(); attempt(() => { const id = saveVariant(name); setCompareId(id); setName(''); setMessage(`«${name.trim()}» сохранён.`); }); }}>
      <label>Название варианта<input maxLength={64} required placeholder="Например, WARMER + Freya · коаксиал" value={name} onChange={e => setName(e.target.value)} /></label>
      <button className="system-primary" type="submit">Сохранить текущий</button>
    </form>
    {!variants.length && <div className="variant-empty"><b>Начни с двух ЦАПов</b><p>Выбери WARMER или Bifrost ниже, настрой соединения и сохрани. После этого можно сравнить варианты по строкам.</p></div>}
    <div className="variant-grid">{variants.map(item => {
      const active = samePlan(plan, item.plan);
      return <article className={`variant-card ${active ? 'selected' : ''}`} key={item.id}>
        <div className="system-section-title"><h3>{item.name}</h3>{active && <span className="system-status ok">Совпадает с текущим</span>}</div>
        <p>{AUDIO_MODELS[item.plan.dac].name} · {AUDIO_MODELS[item.plan.preamp].name}</p>
        <div className="variant-actions"><button disabled={active} onClick={() => { loadVariant(item.id); setMessage(`Выбран «${item.name}». Предыдущие настройки можно вернуть кнопкой «Отменить».`); }}>Выбрать</button><button aria-pressed={compareId === item.id} onClick={() => setCompareId(compareId === item.id ? '' : item.id)}>Сравнить</button><a href={systemShareUrl(item.plan, window.location.origin, item.name)} target="_blank" rel="noreferrer">Показать другу ↗</a><button aria-label={`Удалить вариант ${item.name}`} onClick={() => { deleteVariant(item.id); setMessage(`«${item.name}» удалён. Можно восстановить ниже.`); }}>Удалить</button></div>
      </article>;
    })}</div>
    {comparison && <div className="variant-comparison"><div className="system-section-title"><h3>Сравнение подключений</h3><button onClick={() => setCompareId('')}>Закрыть сравнение</button></div><p>Подсвечены различия. Оценка звука здесь не предполагается; неполные данные остаются неполными.</p>
      <div className="comparison-scroll" role="region" aria-label="Таблица сравнения вариантов" tabIndex={0}><table><caption className="sr-only">Текущие настройки и {comparison.name}</caption><thead><tr><th scope="col">Параметр</th><th scope="col">Текущий вариант</th><th scope="col">{comparison.name}</th></tr></thead><tbody>{currentRows.map(([label, value], i) => <tr key={label} className={value !== otherRows[i][1] ? 'different' : ''}><th scope="row">{label}{value !== otherRows[i][1] && <span className="sr-only"> · отличается</span>}</th><td>{value}</td><td>{otherRows[i][1]}</td></tr>)}</tbody></table></div>
    </div>}
    <div className="variant-backup"><button disabled={!variants.length} onClick={() => attempt(download)}>Скачать варианты</button><label className="variant-file">Загрузить из файла<input type="file" accept=".json,application/json" onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      try { if (file.size > MAX_IMPORT_BYTES) throw new Error('Файл слишком большой: максимум 128 КБ.'); const count = importFile(await file.text()); setMessage(count ? `Добавлено вариантов: ${count}. Текущая система сохранена.` : 'Эти варианты уже есть в библиотеке.'); } catch (error) { setMessage(error.message); }
    }} /></label>{deleted && <button onClick={() => attempt(() => { restoreDeleted(); setMessage('Удалённый вариант восстановлен.'); })}>Восстановить «{deleted.name}»</button>}</div>
    {message && <p className="variant-notice" role="status">{message}</p>}
  </section>;
}
