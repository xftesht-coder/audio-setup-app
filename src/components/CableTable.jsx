import React from 'react';
import { useRoutingStore } from '../store/routingStore';
import { CABLE_LENGTHS, getCableLengthWarning } from '../data/systemRules';
import { getCableStyle } from '../data/cableStyles';

export default function CableTable({ rigId }) {
  const activeCables = useRoutingStore((s) => s.getActiveCables(rigId));
  const deviceSpecs = useRoutingStore((s) => s.getAllDeviceSpecs());
  const removeCable = useRoutingStore((s) => s.removeCable);
  const updateCableLength = useRoutingStore((s) => s.updateCableLength);

  const getPortLabel = (deviceId, portId) => {
    const spec = deviceSpecs[deviceId];
    const port = spec?.ports.find((p) => p.id === portId);
    return { deviceName: spec?.name, portLabel: port?.label };
  };

  const totalLength = activeCables.reduce((sum, c) => sum + c.length, 0);

  const exportCSV = () => {
    const style = (t) => getCableStyle(t).name;
    const header = ['Тип кабеля', 'Откуда (устройство)', 'Откуда (порт)', 'Куда (устройство)', 'Куда (порт)', 'Длина (м)'];
    const rows = activeCables.map((cable) => {
      const from = getPortLabel(cable.from.device, cable.from.port);
      const to = getPortLabel(cable.to.device, cable.to.port);
      return [style(cable.connectorType), from.deviceName, from.portLabel, to.deviceName, to.portLabel, cable.length];
    });
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patch-list-${rigId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-card border border-rule rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-ink">Патч-лист (Cable Schedule)</p>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted">Всего кабеля: <b>{totalLength.toFixed(1)}м</b></p>
          <button
            onClick={exportCSV}
            className="text-xs bg-signal-wash text-signal px-2.5 py-1 rounded font-medium hover:bg-signal/20"
          >
            ⬇ Экспорт CSV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-rule text-left text-muted">
              <th className="py-2 pr-2">Тип</th>
              <th className="py-2 pr-2">Откуда</th>
              <th className="py-2 pr-2">Куда</th>
              <th className="py-2 pr-2">Длина</th>
              <th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {activeCables.map((cable) => {
              const from = getPortLabel(cable.from.device, cable.from.port);
              const to = getPortLabel(cable.to.device, cable.to.port);
              const style = getCableStyle(cable.connectorType);
              const lengthCheck = getCableLengthWarning(cable.connectorType, cable.length);

              return (
                <tr key={cable.id} className="border-b border-rule/50">
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block rounded-full"
                        style={{
                          width: 28,
                          height: Math.max(style.width, 2),
                          background: style.dash
                            ? `repeating-linear-gradient(90deg, ${style.color} 0 4px, transparent 4px 7px)`
                            : style.color,
                        }}
                      />
                      <span className="text-[10px] text-ink font-medium">{style.name}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-2 text-ink">
                    {from.deviceName}<br/>
                    <span className="text-muted text-[10px]">{from.portLabel}</span>
                  </td>
                  <td className="py-2 pr-2 text-ink">
                    {to.deviceName}<br/>
                    <span className="text-muted text-[10px]">{to.portLabel}</span>
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      value={cable.length}
                      onChange={(e) => updateCableLength(rigId, cable.id, parseFloat(e.target.value))}
                      className="border border-rule rounded px-1 py-0.5 text-xs bg-white"
                    >
                      {CABLE_LENGTHS.map(len => (
                        <option key={len} value={len}>{len}м</option>
                      ))}
                    </select>
                    {lengthCheck.warning && (
                      <span className="block text-stop text-[10px] mt-0.5">⚠️ Длинновато</span>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <button
                      onClick={() => removeCable(rigId, cable.id)}
                      className="text-stop hover:bg-stop-wash rounded px-2 py-1 text-[10px] font-medium"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {activeCables.length === 0 && (
        <p className="text-xs text-muted text-center py-4">Нет подключенных кабелей</p>
      )}
    </div>
  );
}
