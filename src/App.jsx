import React, { lazy, Suspense, useEffect, useState } from 'react';
import PowerDistribution from './components/PowerDistribution';
import ListeningRoom from './components/ListeningRoom';
import PageBoundary from './components/PageBoundary';
import { APP_SECTIONS, sectionForHash } from './data/appSections';
import LiveSystemVariants from './components/LiveSystemVariants';

const Sidebar = lazy(() => import('./components/Sidebar'));
const PatchPanel = lazy(() => import('./components/PatchPanel'));
const LegacyPatchPanel = lazy(() => import('./components/LegacyPatchPanel'));
const CabinetPanel = lazy(() => import('./components/CabinetPanel'));
const SystemIntelligence = lazy(() => import('./components/SystemIntelligence'));
const getSection = () => sectionForHash(window.location.hash);

export default function App() {
  const [section, setSectionState] = useState(getSection);
  useEffect(() => {
    const update = () => setSectionState(getSection());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const setSection = (next) => {
    setSectionState(next);
    window.location.hash = next;
  };

  return (
    <div className={'app-shell min-h-screen flex bg-paper' + (section === 'legacy-patch' ? '' : ' compact-shell')}>
      {section === 'legacy-patch' && <PageBoundary><Suspense fallback={null}><Sidebar /></Suspense></PageBoundary>}
      <main className="app-main flex-1 min-w-0 p-4">
        <nav className="app-navigation" aria-label="Разделы Audio Setup">
          {APP_SECTIONS.map(([id,label]) => <button key={id} aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}>{label}</button>)}
          {section !== 'legacy-patch' && <LiveSystemVariants />}
        </nav>

        {section === 'legacy-patch' && <PowerDistribution />}
        {section === 'legacy-patch' && <p className="system-legacy-note">Архивный редактор примеров. Эти соединения не меняют комнату и не сохраняются после перезагрузки. <a href="#patch">Открыть общую схему ↗</a></p>}
        <PageBoundary key={section}><Suspense fallback={<p className="page-loading" role="status">Открываем раздел…</p>}>
          {section === 'legacy-patch' ? <LegacyPatchPanel /> : section === 'patch' ? <PatchPanel /> : section === 'intelligence' ? <SystemIntelligence /> : section === 'room' ? <ListeningRoom /> : <CabinetPanel />}
        </Suspense></PageBoundary>
      </main>
    </div>
  );
}
