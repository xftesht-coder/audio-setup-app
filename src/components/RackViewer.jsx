import React from 'react';
import { useSetupStore } from '../store/setupStore';
import RackFront from './RackFront';
import RackBack from './RackBack';

export default function RackViewer({ config }) {
  const view = useSetupStore((state) => state.selectedView);
  const setView = useSetupStore((state) => state.setSelectedView);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 bg-card border border-rule rounded-lg p-2">
        <button
          onClick={() => setView('front')}
          className={`flex-1 py-2 px-3 rounded text-sm font-medium transition ${
            view === 'front'
              ? 'bg-signal text-white'
              : 'bg-faint/10 text-ink hover:bg-faint/20'
          }`}
        >
          Спереди
        </button>
        <button
          onClick={() => setView('back')}
          className={`flex-1 py-2 px-3 rounded text-sm font-medium transition ${
            view === 'back'
              ? 'bg-signal text-white'
              : 'bg-faint/10 text-ink hover:bg-faint/20'
          }`}
        >
          Сзади
        </button>
      </div>

      <div className="bg-card border border-rule rounded-lg p-4 flex-1">
        {view === 'front' ? (
          <RackFront config={config} />
        ) : (
          <RackBack config={config} />
        )}
      </div>

      <div className="bg-go-wash border border-l-4 border-go border-l-go rounded-lg p-3">
        <p className="text-sm text-go font-medium">
          {view === 'front'
            ? '▶ Передняя панель с элементами управления'
            : '◀ Задняя панель с разъёмами и соединениями'}
        </p>
      </div>
    </div>
  );
}
