import React from 'react';
import { useRoutingStore } from '../store/routingStore';

export default function Sidebar() {
  const selectedRig = useRoutingStore((s) => s.selectedRig);
  const setSelectedRig = useRoutingStore((s) => s.setSelectedRig);
  const presets = useRoutingStore((s) => s.getAllPresets());
  const selectedPort = useRoutingStore((s) => s.selectedPort);
  const cancelCable = useRoutingStore((s) => s.cancelCable);

  return (
    <aside className="w-52 bg-card border-r border-rule p-4 flex flex-col gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-signal mb-3">Тракты</p>
        <div className="flex flex-col gap-2">
          {Object.entries(presets).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => setSelectedRig(key)}
              className={`text-left p-3 rounded-md transition-all text-sm font-medium ${
                selectedRig === key
                  ? 'bg-signal-wash border border-signal text-ink'
                  : 'bg-faint/5 border border-rule text-ink hover:bg-faint/10'
              }`}
            >
              <span className="text-xs font-bold text-signal block">{key}</span>
              <span className="text-sm">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedPort && (
        <div className="bg-amber-wash border border-amber/30 rounded-md p-3">
          <p className="text-xs font-bold text-amber mb-2">🔌 Режим подключения</p>
          <p className="text-xs text-amber mb-2">
            Выбран порт: <b>{selectedPort.port}</b>
          </p>
          <p className="text-xs text-amber/80 mb-2">Клик на совместимый порт другого устройства для соединения</p>
          <button
            onClick={cancelCable}
            className="w-full py-1.5 px-2 bg-stop-wash text-stop rounded text-xs font-medium"
          >
            Отмена
          </button>
        </div>
      )}

      <div className="mt-auto pt-4 border-t border-rule">
        <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Как подключить</p>
        <p className="text-xs text-muted leading-relaxed">
          1. Клик на порт устройства (output)<br/>
          2. Клик на порт другого устройства (input)<br/>
          3. Кабель добавится автоматически, если разъёмы совместимы
        </p>
      </div>
    </aside>
  );
}
