import React from 'react';
import { useRoutingStore } from './store/routingStore';
import Sidebar from './components/Sidebar';
import RackView from './components/RackView';
import CableTable from './components/CableTable';
import ValidationPanel from './components/ValidationPanel';
import DeviceDetailPanel from './components/DeviceDetailPanel';

export default function App() {
  const selectedRig = useRoutingStore((s) => s.selectedRig);
  const selectedDevice = useRoutingStore((s) => s.selectedDevice);

  return (
    <div className="min-h-screen flex bg-paper">
      <Sidebar />
      <main className="flex-1 grid grid-cols-[1fr_340px] gap-4 p-4">
        <div className="flex flex-col gap-4">
          <RackView rigId={selectedRig} />
          <CableTable rigId={selectedRig} />
        </div>
        <div className="flex flex-col gap-4">
          {selectedDevice ? (
            <DeviceDetailPanel deviceId={selectedDevice} />
          ) : (
            <ValidationPanel rigId={selectedRig} />
          )}
        </div>
      </main>
    </div>
  );
}
