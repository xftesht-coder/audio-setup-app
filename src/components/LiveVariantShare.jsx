import { useEffect, useRef, useState } from 'react';
import { createLiveShareUrl } from '../data/liveShare';

export default function LiveVariantShare({ item, onClose }) {
  const [url, setUrl] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  const field = useRef(null);
  useEffect(() => {
    let cancelled = false;
    createLiveShareUrl(item, window.location.href).then(value => { if (!cancelled) setUrl(value); }, e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [item]);
  useEffect(() => { if (url) field.current?.focus(); }, [url]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setMessage('Ссылка скопирована. Отправь её другу.'); }
    catch { field.current.focus(); field.current.select(); setMessage('Не удалось скопировать автоматически. Ссылка выделена — скопируй её вручную.'); }
  };
  return <section className="live-share-link" aria-label={`Ссылка на вариант ${item.name}`}>
    <div><strong>Ссылка для друга · {item.name}</strong><button aria-label="Закрыть ссылку" onClick={onClose}>×</button></div>
    <p>Сохранённые комната, стойка, входы и проводка. Только просмотр; дальнейшие правки не изменят этот снимок.</p>
    {error ? <p className="live-variant-error" role="alert">{error}</p> : !url ? <p role="status">Готовим ссылку…</p> : <>
      <textarea ref={field} readOnly rows={2} aria-label="Ссылка для друга" value={url} onFocus={e => e.target.select()} />
      <div className="live-share-actions"><button onClick={copy}>Скопировать ссылку</button><a href={url} target="_blank" rel="noreferrer">Открыть просмотр ↗</a></div>
      <small>Доступно всем, у кого есть ссылка. В неё входят название и данные этого варианта.</small>
      {message && <p role="status">{message}</p>}
    </>}
  </section>;
}
