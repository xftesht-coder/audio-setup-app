import React from 'react';
import { useSetupStore } from '../store/setupStore';

export default function SettingsBox({ config }) {
  const getComponent = useSetupStore((state) => state.getComponent);

  return (
    <div className="bg-card border border-rule rounded-lg p-3">
      <p className="text-xs font-bold uppercase tracking-widest text-signal mb-3">Параметры</p>
      <div className="flex flex-col gap-2">
        {config.settings.slice(0, 3).map((setting, idx) => {
          const comp = getComponent(setting.component);
          return (
            <div key={idx} className="text-xs">
              <p className="text-muted font-medium mb-1">{comp.name.split(' ')[0]}</p>
              <p className="font-mono text-signal text-xs">
                {setting.param}: <span className="font-bold">{setting.value}</span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
