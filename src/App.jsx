import React, { useEffect, useState } from 'react';
import { useRoutingStore } from './store/routingStore';
import Sidebar from './components/Sidebar';
import RackView from './components/RackView';
import CableTable from './components/CableTable';
import ValidationPanel from './components/ValidationPanel';
import DeviceDetailPanel from './components/DeviceDetailPanel';
import CabinetPanel from './components/CabinetPanel';
import PowerDistribution from './components/PowerDistribution';

export default function App() {
  const selectedRig = useRoutingStore((s) => s.selectedRig);
  const selectedMode = useRoutingStore((s) => s.selectedMode);
  const selectedDevice = useRoutingStore((s) => s.selectedDevice);
  const [section, setSectionState] = useState(() => window.location.hash === '#cabinet' ? 'cabinet' : 'patch');
  useEffect(() => {
    const update = () => setSectionState(window.location.hash === '#cabinet' ? 'cabinet' : 'patch');
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const setSection = (next) => {
    setSectionState(next);
    window.history.replaceState(null, '', `#${next}`);
  };

  return (
    <div className="min-h-screen flex bg-paper">
      {section === 'patch' && <Sidebar />}
      <main className="flex-1 min-w-0 p-4">
        <div className="flex gap-2 mb-4">
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

        <PowerDistribution />
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
        ) : (
          <CabinetPanel />
        )}
      </main>
    </div>
  );
}
