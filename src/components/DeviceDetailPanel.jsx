import React from 'react';
import { useRoutingStore } from '../store/routingStore';
import { CONNECTOR_TYPES } from '../data/devicePorts';

export default function DeviceDetailPanel({ deviceId }) {
  const spec = useRoutingStore((s) => s.getDeviceSpec(deviceId));
  const setSelectedDevice = useRoutingStore((s) => s.setSelectedDevice);

  if (!spec) return null;

  const inputs = spec.ports.filter(p => p.direction === 'input');
  const outputs = spec.ports.filter(p => p.direction === 'output' || p.direction === 'io');

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-card border border-rule rounded-lg p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-sm font-bold text-ink">{spec.name}</p>
            <p className="text-xs text-muted">{spec.manufacturer}</p>
          </div>
          <button
            onClick={() => setSelectedDevice(null)}
            className="text-xs text-stop bg-stop-wash rounded px-2 py-1"
          >
            Закрыть
          </button>
        </div>
        <p className="text-xs text-faint mt-2">{spec.fullName}</p>
        {spec.photoQuery && (
          <a
            href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(spec.photoQuery + ' front back panel')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-xs text-signal hover:underline"
          >
            📷 Смотреть фото устройства (перед/зад) →
          </a>
        )}
      </div>

      {outputs.length > 0 && (
        <div className="bg-card border border-rule rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-go mb-2">Выходы ({outputs.length})</p>
          <div className="flex flex-col gap-2">
            {outputs.map((port) => (
              <div key={port.id} className="border border-rule/50 rounded p-2">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: CONNECTOR_TYPES[port.type]?.color }}
                  />
                  <span className="text-xs font-medium text-ink">{port.label}</span>
                </div>
                {port.notes && <p className="text-[10px] text-muted leading-snug">{port.notes}</p>}
                {port.voltage && <p className="text-[10px] text-signal mt-0.5">⚡ {port.voltage}</p>}
                {port.power && <p className="text-[10px] text-signal mt-0.5">🔊 {port.power}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {inputs.length > 0 && (
        <div className="bg-card border border-rule rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-signal mb-2">Входы ({inputs.length})</p>
          <div className="flex flex-col gap-2">
            {inputs.map((port) => (
              <div key={port.id} className={`border rounded p-2 ${port.critical ? 'border-stop bg-stop-wash' : 'border-rule/50'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: CONNECTOR_TYPES[port.type]?.color }}
                  />
                  <span className={`text-xs font-medium ${port.critical ? 'text-stop' : 'text-ink'}`}>{port.label}</span>
                </div>
                {port.notes && (
                  <p className={`text-[10px] leading-snug ${port.critical ? 'text-stop' : 'text-muted'}`}>{port.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {spec.warnings && spec.warnings.length > 0 && (
        <div className="bg-amber-wash border-l-4 border-amber rounded-lg p-3">
          <p className="text-xs font-bold text-amber mb-2">Важно знать</p>
          {spec.warnings.map((w, idx) => (
            <p key={idx} className="text-xs text-amber leading-snug mb-1">{w}</p>
          ))}
        </div>
      )}

      {spec.specs && (
        <div className="bg-card border border-rule rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Спецификации</p>
          {Object.entries(spec.specs).map(([key, value]) => (
            <div key={key} className="flex justify-between text-xs py-1 border-b border-rule/30">
              <span className="text-muted">{key}</span>
              <span className="text-ink font-medium">{value}</span>
            </div>
          ))}
        </div>
      )}

      {spec.verifiedSources && spec.verifiedSources.length > 0 && (
        <div className="bg-card border border-rule rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-go mb-2">
            ✓ Проверено на {spec.verifiedSources.length} источниках
          </p>
          <div className="flex flex-col gap-1.5">
            {spec.verifiedSources.map((src, idx) => (
              <a
                key={idx}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-signal hover:underline flex items-start gap-1.5"
              >
                <span className="text-go mt-0.5">✓</span>
                <span>{src.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-faint text-center">{spec.sourceDoc}</p>
    </div>
  );
}
