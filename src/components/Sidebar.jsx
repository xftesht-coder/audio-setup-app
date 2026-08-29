import React from 'react';
import { useRoutingStore } from '../store/routingStore';

export default function Sidebar() {
  const selectedRig = useRoutingStore((s) => s.selectedRig);
  const selectedMode = useRoutingStore((s) => s.selectedMode);
  const setSelectedRig = useRoutingStore((s) => s.setSelectedRig);
  const setSelectedMode = useRoutingStore((s) => s.setSelectedMode);
  const rigs = useRoutingStore((s) => s.getAllRigs());
  const modes = useRoutingStore((s) => s.getAllModes());
  const selectedPort = useRoutingStore((s) => s.selectedPort);
  const cancelCable = useRoutingStore((s) => s.cancelCable);

  return (
    <aside className="w-56 bg-card border-r border-rule p-4 flex flex-col gap-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-signal mb-3">Сетап (источник)</p>
        <div className="flex flex-col gap-2">
          {Object.entries(rigs).map(([key, rig]) => (
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
              <span className="text-sm">{rig.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-go mb-3">Режим прослушивания</p>
        <p className="text-[10px] text-muted mb-2 leading-snug">
          Одно из двух — колонки и наушники не используются одновременно.
        </p>
        <div className="flex flex-col gap-2">
          {Object.entries(modes).map(([key, mode]) => (
            <button
              key={key}
              onClick={() => setSelectedMode(key)}
              className={`text-left p-3 rounded-md transition-all text-sm font-medium ${
                selectedMode === key
                  ? 'bg-go-wash border border-go text-ink'
                  : 'bg-faint/5 border border-rule text-ink hover:bg-faint/10'
              }`}
            >
              {mode.name}
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
          1. Клик на порт устройства (output)<br />
          2. Клик на порт другого устройства (input)<br />
          3. Кабель добавится автоматически, если разъёмы совместимы
        </p>
      </div>
    </aside>
  );
}
