import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useRoutingStore } from './store/routingStore';
import Sidebar from './components/Sidebar';
import RackView from './components/RackView';
import CableTable from './components/CableTable';
import ValidationPanel from './components/ValidationPanel';
import DeviceDetailPanel from './components/DeviceDetailPanel';
import CabinetPanel from './components/CabinetPanel';
import PowerDistribution from './components/PowerDistribution';
import ShareView from './components/ShareView';
import ListeningRoom from './components/ListeningRoom';

const LightingCatalog = lazy(() => import('./components/LightingCatalog'));
const SystemBuilder = lazy(() => import('./components/SystemBuilder'));
const getSection = () => ({ '#cabinet': 'cabinet', '#room': 'room', '#lighting': 'lighting', '#system': 'system' }[window.location.hash] || 'patch');

export default function App() {
  const selectedRig = useRoutingStore((s) => s.selectedRig);
  const selectedMode = useRoutingStore((s) => s.selectedMode);
  const selectedDevice = useRoutingStore((s) => s.selectedDevice);
  const [section, setSectionState] = useState(getSection);
  const isShareView = new URLSearchParams(window.location.search).get('view') === 'share';
  useEffect(() => {
    const update = () => setSectionState(getSection());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  if (isShareView) return <ShareView />;
  const setSection = (next) => {
    setSectionState(next);
    window.history.replaceState(null, '', `#${next}`);
  };

  return (
    <div className="min-h-screen flex bg-paper">
      {section === 'patch' && <Sidebar />}
      <main className="flex-1 min-w-0 p-4">
        <div className="flex gap-2 mb-4 flex-wrap">
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

        {!['lighting', 'system'].includes(section) && <PowerDistribution />}
        {section === 'patch' && <p className="system-legacy-note">Сохранённая схема с A90. Выбрать Freya, WARMER или другой аппарат и проверить новый тракт можно в <a href="/#system">конфигураторе системы ↗</a>.</p>}
        {section === 'patch' ? (
          <div className="grid grid-cols-[1fr_340px] gap-4">
            <div className="flex flex-col gap-4">
              <RackView rigId={selectedRig} modeId={selectedMode} />
              <CableTable rigId={selectedRig} modeId={selectedMode} />
            </div>
            <div className="flex flex-col gap-4">
              {selectedDevice ? (
                <DeviceDetailPanel deviceId={selectedDevice} />
              ) : (
                <ValidationPanel rigId={selectedRig} modeId={selectedMode} />
              )}
            </div>
          </div>
        ) : section === 'system' ? <Suspense fallback={<p role="status">Открываем систему…</p>}><SystemBuilder /></Suspense> : section === 'lighting' ? <Suspense fallback={<p role="status">Открываем каталог Govee…</p>}><LightingCatalog /></Suspense> : section === 'room' ? <ListeningRoom /> : (
          <CabinetPanel />
        )}
      </main>
    </div>
  );
}
