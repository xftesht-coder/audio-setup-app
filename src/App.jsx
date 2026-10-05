import React, { lazy, Suspense, useEffect, useState } from 'react';
import PowerDistribution from './components/PowerDistribution';
import ListeningRoom from './components/ListeningRoom';
import PageBoundary from './components/PageBoundary';

const Sidebar = lazy(() => import('./components/Sidebar'));
const PatchPanel = lazy(() => import('./components/PatchPanel'));
const CabinetPanel = lazy(() => import('./components/CabinetPanel'));
const ShareView = lazy(() => import('./components/ShareView'));
const LightingCatalog = lazy(() => import('./components/LightingCatalog'));
const SystemBuilder = lazy(() => import('./components/SystemBuilder'));
const getSection = () => ({ '#cabinet': 'cabinet', '#room': 'room', '#lighting': 'lighting', '#system': 'system' }[window.location.hash] || 'patch');

export default function App() {
  const [section, setSectionState] = useState(getSection);
  const isShareView = new URLSearchParams(window.location.search).get('view') === 'share';
  useEffect(() => {
    const update = () => setSectionState(getSection());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  if (isShareView) return <PageBoundary><Suspense fallback={<p className="page-loading" role="status">Открываем аудиосистему…</p>}><ShareView /></Suspense></PageBoundary>;
  const setSection = (next) => {
    setSectionState(next);
    window.history.replaceState(null, '', `#${next}`);
  };

  return (
    <div className="min-h-screen flex bg-paper">
      {section === 'patch' && <PageBoundary><Suspense fallback={null}><Sidebar /></Suspense></PageBoundary>}
      <main className="flex-1 min-w-0 p-4">
        <div className="app-navigation flex gap-2 mb-4 flex-wrap">
          <button onClick={() => setSection('room')} className={`text-sm font-bold px-4 py-2 rounded-md border ${section === 'room' ? 'bg-go-wash border-go text-go' : 'border-rule text-muted bg-card'}`}>Комната</button>
          <button onClick={() => setSection('system')} className={`text-sm font-bold px-4 py-2 rounded-md border ${section === 'system' ? 'bg-go-wash border-go text-go' : 'border-rule text-muted bg-card'}`}>Система · Schiit</button>
          <button onClick={() => setSection('lighting')} className={`text-sm font-bold px-4 py-2 rounded-md border ${section === 'lighting' ? 'bg-go-wash border-go text-go' : 'border-rule text-muted bg-card'}`}>Свет · Govee</button>
          <button
            onClick={() => setSection('patch')}
            className={`text-sm font-bold px-4 py-2 rounded-md border ${section === 'patch' ? 'bg-signal-wash border-signal text-signal' : 'border-rule text-muted bg-card'}`}
          >
            🔌 Патч-панель
          </button>
          <button
            onClick={() => setSection('cabinet')}
            className={`text-sm font-bold px-4 py-2 rounded-md border ${section === 'cabinet' ? 'bg-go-wash border-go text-go' : 'border-rule text-muted bg-card'}`}
          >
            🪵 Тумба (3D)
          </button>
        </div>

        {!['lighting', 'system','room'].includes(section) && <PowerDistribution />}
        {section === 'patch' && <p className="system-legacy-note">Сохранённая схема с A90. Выбрать Freya, WARMER или другой аппарат и проверить новый тракт можно в <a href="/#system">конфигураторе системы ↗</a>.</p>}
        <PageBoundary key={section}><Suspense fallback={<p className="page-loading" role="status">Открываем раздел…</p>}>
          {section === 'patch' ? <PatchPanel /> : section === 'system' ? <SystemBuilder /> : section === 'lighting' ? <LightingCatalog /> : section === 'room' ? <ListeningRoom /> : <CabinetPanel />}
        </Suspense></PageBoundary>
      </main>
    </div>
  );
}
