import React from 'react';

/**
 * MaterialPicker — радиокнопки из MATERIALS каталога.
 *
 * Живой превью: цвет материала показывается в виде маленькой «доски»
 * с соответствующей текстурой/цветом, иначе пользовательу тяжело
 * визуально сопоставить hex с «олхой» или «CLD-сэндвичом».
 *
 * setMaterial из useCabinetStore сразу меняет materialId → CabinetView3D
 * перечитывает MATERIALS[materialId].color через useMemo и live-перекрашивает
 * полки и каркас без перезагрузки сцены (Zustand триггерит ре-рендер 3D).
 */
export default function MaterialPicker({ materials, selectedId, onSelect }) {
  const entries = Object.entries(materials);

  return (
    <div className="bg-card border border-rule rounded-lg p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Материал тумбы</p>
      <div className="flex flex-wrap gap-2">
        {entries.map(([id, mat]) => {
          const selected = id === selectedId;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={
                `flex items-center gap-2 px-3 py-1.5 rounded font-medium text-xs border ` +
                (selected
                  ? 'bg-signal-wash border-signal text-signal'
                  : 'border-rule text-muted hover:bg-faint/5 hover:border-rule')
              }
              title={mat.note || mat.name}
            >
              <span
                className="w-4 h-4 rounded-sm"
                style={{
                  backgroundColor: mat.color,
                  boxShadow: selected ? '0 0 0 2px var(--signal)' : '0 0 0 1px var(--rule)',
                }}
              />
              {mat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
