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
    <div className="cabinet-info">
      <p className="cabinet-eyebrow">Отделка полок</p>
      <div className="cabinet-finishes">
        {entries.map(([id, mat]) => {
          const selected = id === selectedId;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              aria-pressed={selected}
              className="cabinet-finish"
              title={mat.note || mat.name}
            >
              <span
                className="cabinet-swatch"
                style={{
                  backgroundColor: mat.color,
                }}
              />
              {id === 'alder' ? 'Ольха' : mat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
