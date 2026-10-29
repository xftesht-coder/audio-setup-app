import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveSystemStore } from '../stores/useLiveSystemStore';
import { exportLiveVariants, MAX_LIVE_BYTES, MAX_VARIANTS, sameSystem } from '../data/liveSystem';
import { downloadJson } from '../data/roomBackup';
import { ROOM_DEVICE_MAP } from '../data/roomEquipment';
import { routingHref } from '../data/routingNavigation';
import LiveSystemComparison from './LiveSystemComparison';
import LiveVariantShare from './LiveVariantShare';
import '../liveSystem.css';

function summary(snapshot) {
  const { room, workshop } = snapshot, project = workshop.variants[workshop.activeVariant];
  return `${ROOM_DEVICE_MAP[room.listening.source].name} · ${room.cables.length} кабелей · ${workshop.activeVariant === 'tv' ? 'ТВ-стойка' : 'Высокая стойка'} ${project.width} × ${project.depth} мм`;
}

export default function LiveSystemVariants() {
  const s = useLiveSystemStore();
  const dialog = useRef(null), input = useRef(null), upload = useRef(null);
  const [name, setName] = useState(''), [error, setError] = useState(''), [renaming, setRenaming] = useState(null), [reading, setReading] = useState(false);
  const [mode, setMode] = useState('library');
  const [sharing, setSharing] = useState(null);
  const matched = s.variants.find(v => sameSystem(v.snapshot, s.current));
  const run = action => { try { const result = action(); setError(''); return result; } catch (e) { setError(e.message); return null; } };
  const open = () => { dialog.current.showModal(); input.current?.focus(); };
  const inspect = (id, hint) => {
    if (run(() => s.loadVariant(id))) {
      dialog.current.close();
      const href = routingHref(hint);
      if (window.location.hash === href) window.dispatchEvent(new Event('hashchange'));
      else window.location.hash = href;
    }
  };
  const save = e => {
    e.preventDefault();
    const result = run(() => renaming ? s.renameVariant(renaming, name) : s.saveVariant(name));
    if (result) { setName(''); setRenaming(null); }
  };
  const exportCurrent = () => downloadJson('audio-current-system.json', exportLiveVariants([{ id: 'current-system', name: 'Текущая система', snapshot: s.current }]));
  return <>
    <button className="live-system-toggle" aria-haspopup="dialog" onClick={open} title={s.storageError || 'Снимки проводки, входов и стойки'}>{s.storageError ? 'Не сохранено' : 'Варианты'} <span>{s.storageError ? '!' : s.variants.length || '+'}</span></button>
    {createPortal(<dialog ref={dialog} className="live-variants-dialog" data-mode={mode} aria-labelledby="live-variants-title">
      <header><div><small>AUDIO SETUP · МОИ ВАРИАНТЫ</small><h2 id="live-variants-title">{mode === 'compare' ? 'Что изменится в системе' : 'Сохранить систему целиком'}</h2></div><button aria-label="Закрыть варианты" onClick={() => dialog.current.close()}>×</button></header>
      <div className="live-variant-modes" role="group" aria-label="Работа с вариантами"><button aria-pressed={mode === 'library'} onClick={() => setMode('library')}>Мои варианты</button><button aria-pressed={mode === 'compare'} onClick={() => setMode('compare')}>Сравнение</button></div>
      <div className="live-variants-body">
        {mode === 'compare' ? <>{(error || s.storageError) && <p className="live-variant-error" role="alert">{error || s.storageError}</p>}<LiveSystemComparison variants={s.variants} onInspect={inspect} /></> : <>
        <section className="live-current" aria-label="Текущая система"><strong>{matched ? matched.name : 'Текущая система · новый вариант'}</strong><p>{summary(s.current)}</p><small>Проводка, источник, входы, состав и обе стойки с размерами, материалами и трассами кабелей.</small></section>
        <form className="live-save-form" onSubmit={save}><label htmlFor="live-variant-name">{renaming ? 'Новое название' : 'Название нового варианта'}</label><div><input ref={input} id="live-variant-name" value={name} onChange={e => setName(e.target.value)} maxLength={64} placeholder="Например: Сейчас · A90" required /><button type="submit">{renaming ? 'Переименовать' : 'Сохранить вариант'}</button>{renaming && <button type="button" onClick={() => { setRenaming(null); setName(''); }}>Отмена</button>}</div></form>
        <div className="live-variant-history"><button disabled={!s.past.length} onClick={s.undo}>↶ Отменить изменение</button><button disabled={!s.future.length} onClick={s.redo}>↷ Повторить</button><small>Общая история комнаты и стойки · до перезагрузки</small></div>
        {error && <p className="live-variant-error" role="alert">{error}</p>}
        {s.storageError && <div className="live-variant-error" role="alert"><p>{s.storageError}</p><button onClick={s.retrySave}>Повторить сохранение</button><button onClick={exportCurrent}>Скачать текущую систему</button></div>}
        {s.message && <p className="live-variant-message" role="status">{s.message}</p>}
        <div className="live-list-heading"><h3>Сохранённые варианты</h3><span>{s.variants.length} / {MAX_VARIANTS}</span></div>
        {!s.variants.length && <p className="live-variant-empty">Сохрани текущую систему, затем меняй входы, кабели или стойку. Сохранённый вариант останется прежним.</p>}
        <ul className="live-variant-list">{s.variants.map(item => <li key={item.id} data-current={matched?.id === item.id}><div><strong>{item.name}</strong>{matched?.id === item.id && <span className="live-variant-badge">Открыт</span>}<p>{summary(item.snapshot)}</p></div><div className="live-variant-actions"><button disabled={matched?.id === item.id} onClick={() => run(() => s.loadVariant(item.id))} aria-label={`Открыть вариант ${item.name}`}>Открыть</button><button onClick={() => setSharing(item)} aria-label={`Поделиться вариантом ${item.name}`}>Ссылка</button><button onClick={() => { setName(item.name); setRenaming(item.id); input.current.focus(); }} aria-label={`Переименовать вариант ${item.name}`}>Название</button><button onClick={() => run(() => { const ok = s.deleteVariant(item.id); if (ok && renaming === item.id) { setRenaming(null); setName(''); } return ok; })} aria-label={`Удалить вариант ${item.name}`}>Удалить</button></div></li>)}</ul>
        {sharing && <LiveVariantShare key={sharing.id + sharing.name} item={sharing} onClose={() => setSharing(null)} />}
        {s.deleted && <button className="live-restore-deleted" onClick={() => run(s.restoreDeleted)}>Вернуть удалённый «{s.deleted.name}»</button>}
        <div className="live-variant-backup"><button disabled={!s.variants.length} onClick={() => downloadJson('audio-live-variants.json', exportLiveVariants(s.variants))}>Скачать варианты</button><button onClick={exportCurrent}>Скачать текущую</button><button disabled={reading} onClick={() => upload.current.click()}>{reading ? 'Читаем…' : 'Импорт вариантов'}</button></div>
        <input ref={upload} hidden type="file" accept=".json,application/json" aria-label="Файл вариантов системы" onChange={async e => {
          const file = e.target.files?.[0]; if (!file) return;
          setReading(true);
          try { if (file.size > MAX_LIVE_BYTES) throw new Error('Файл слишком большой: максимум 4 МБ.'); s.importFile(await file.text()); setError(''); }
          catch (err) { setError(err.message); }
          finally { setReading(false); e.target.value = ''; }
        }} />
        <p className="live-variant-note">Сохраняется в этом браузере. JSON — копия для другого устройства. Импорт добавляет варианты; текущую систему меняет только «Открыть». Переключатели реальных аппаратов меняются вручную.</p>
        </>}
      </div>
    </dialog>, document.body)}
  </>;
}
