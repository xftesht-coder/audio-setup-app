import React from 'react';
import { useSetupStore } from '../store/setupStore';
import RecommendationsBox from './RecommendationsBox';
import SettingsBox from './SettingsBox';
import SpecsBox from './SpecsBox';

export default function InfoPanel({ config }) {
  const selectedComponent = useSetupStore((state) => state.selectedComponent);
  const setSelectedComponent = useSetupStore((state) => state.setSelectedComponent);
  const getComponent = useSetupStore((state) => state.getComponent);

  const selected = selectedComponent ? getComponent(selectedComponent) : null;

  return (
    <div className="flex flex-col gap-3">
      {selected ? (
        <div className="bg-card border border-rule rounded-lg p-3">
          <p className="text-xs font-bold uppercase tracking-widest text-signal mb-2">
            {selected.name}
          </p>
          <p className="text-xs text-muted mb-3">{selected.category}</p>
          <div className="bg-faint/5 p-2 rounded text-xs text-muted mb-3 font-mono">
            Размер: {selected.width} × {selected.height}px
          </div>
          <button
            onClick={() => setSelectedComponent(null)}
            className="w-full py-2 px-3 bg-stop-wash text-stop border border-stop/20 rounded text-xs font-medium hover:bg-stop/10 transition"
          >
            Деселект
          </button>
        </div>
      ) : (
        <div className="bg-go-wash border border-go rounded-lg p-3 text-center">
          <p className="text-sm text-go font-medium">Выберите компонент</p>
        </div>
      )}

      <RecommendationsBox config={config} />
      <SettingsBox config={config} />
      <SpecsBox config={config} />
    </div>
  );
}
