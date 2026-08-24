import React from 'react';
import { useRoutingStore } from '../store/routingStore';

const severityStyles = {
  critical: { bg: 'bg-stop-wash', border: 'border-l-stop', text: 'text-stop', icon: '🔴' },
  warning: { bg: 'bg-amber-wash', border: 'border-l-amber', text: 'text-amber', icon: '⚠️' },
  info: { bg: 'bg-signal-wash', border: 'border-l-signal', text: 'text-signal', icon: 'ℹ️' },
  tip: { bg: 'bg-go-wash', border: 'border-l-go', text: 'text-go', icon: '💡' },
};

export default function ValidationPanel({ rigId }) {
  const warnings = useRoutingStore((s) => s.validateRig(rigId));
  const preset = useRoutingStore((s) => s.getPreset(rigId));

  const critical = warnings.filter(w => w.severity === 'critical');
  const others = warnings.filter(w => w.severity !== 'critical');

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-card border border-rule rounded-lg p-4">
        <p className="text-sm font-bold text-ink mb-1">{preset.name}</p>
        <p className="text-xs text-muted">{preset.devices.length} устройств в тракте</p>
      </div>

      {critical.length > 0 && (
        <div className="bg-card border border-rule rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-stop mb-3">
            Критичные проблемы ({critical.length})
          </p>
          <div className="flex flex-col gap-2">
            {critical.map((w, idx) => {
              const style = severityStyles[w.severity];
              return (
                <div key={idx} className={`${style.bg} border-l-4 ${style.border} rounded p-2.5`}>
                  <p className={`text-xs ${style.text} leading-snug`}>{w.message}</p>
                  {w.suggestion && (
                    <p className={`text-xs ${style.text} opacity-75 mt-1 leading-snug`}>
                      💡 {w.suggestion}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-card border border-rule rounded-lg p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-signal mb-3">
          Проверка системы ({others.length})
        </p>
        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
          {others.map((w, idx) => {
            const style = severityStyles[w.severity];
            return (
              <div key={idx} className={`${style.bg} border-l-4 ${style.border} rounded p-2.5`}>
                <p className={`text-xs ${style.text} leading-snug`}>{w.message}</p>
              </div>
            );
          })}
          {others.length === 0 && (
            <p className="text-xs text-muted text-center py-4">Всё в порядке ✓</p>
          )}
        </div>
      </div>
    </div>
  );
}
