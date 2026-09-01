import React from 'react';
import CabinetView3D from './CabinetView3D';
import MaterialPicker from './MaterialPicker';
import { useCabinetStore } from '../stores/useCabinetStore';
import { computeBOM, validateRackConstraints, MAIN_RACK, VINYL_TOWER, ROBOT_VACUUM_CLEARANCE, MATERIALS } from '../data/cabinetSpecs';
import { DEVICE_SPECS } from '../data/devicePorts';

export default function CabinetPanel() {
  const { xray, exploded, selected, materialId, setXray, setExploded, setSelected, setMaterial } = useCabinetStore();
  const bom = computeBOM();
  const issues = validateRackConstraints();
  const critical = issues.filter((i) => i.severity === 'critical');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const selectedSpec = selected ? DEVICE_SPECS[selected] : null;

  return (
    <div className="grid grid-cols-[1fr_340px] gap-4">
      <div className="flex flex-col gap-4">
        <div className="bg-card border border-rule rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm font-bold text-ink">Hi-Fi тумба — 3D конфигуратор (реальные размеры)</p>
          <div className="flex gap-2">
            <button
              onClick={() => setXray()}
              className={`text-xs px-3 py-1.5 rounded font-medium border ${xray ? 'bg-signal-wash border-signal text-signal' : 'border-rule text-muted'}`}
            >
              X-ray {xray ? '✓' : ''}
            </button>
            <button
              onClick={() => setExploded()}
              className={`text-xs px-3 py-1.5 rounded font-medium border ${exploded ? 'bg-go-wash border-go text-go' : 'border-rule text-muted'}`}
            >
              Exploded {exploded ? '✓' : ''}
            </button>
          </div>
        </div>

        <MaterialPicker
          materials={MATERIALS}
          selectedId={materialId}
          onSelect={setMaterial}
        />

        <CabinetView3D />

        <div className="bg-card border border-rule rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Габариты корпуса (MAIN RACK)</p>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div><span className="text-muted">Внутр. ширина</span><br /><b>{MAIN_RACK.innerWidth} мм</b></div>
            <div><span className="text-muted">Глубина полки</span><br /><b>{MAIN_RACK.shelfDepth} мм</b></div>
            <div><span className="text-muted">Высота ножек</span><br /><b>{MAIN_RACK.legHeight} мм</b></div>
          </div>
          <p className="text-[10px] text-faint mt-2">
            Проезд робота-пылесоса: ножки {ROBOT_VACUUM_CLEARANCE.legHeight}мм ≥ Roborock ~{ROBOT_VACUUM_CLEARANCE.knownModels.roborock}мм / Roomba ~{ROBOT_VACUUM_CLEARANCE.knownModels.roomba}мм. {ROBOT_VACUUM_CLEARANCE.note}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {selectedSpec && (
          <div className="bg-card border border-rule rounded-lg p-4">
            <p className="text-sm font-bold text-ink">{selectedSpec.name}</p>
            <p className="text-xs text-muted">{selectedSpec.fullName}</p>
            <button onClick={() => setSelected(null)} className="mt-2 text-[11px] text-stop">Снять выделение</button>
          </div>
        )}

        <div className={`rounded-lg p-4 border-l-4 ${critical.length ? 'bg-stop-wash border-stop' : 'bg-go-wash border-go'}`}>
          <p className={`text-xs font-bold mb-2 ${critical.length ? 'text-stop' : 'text-go'}`}>
            {critical.length ? `🔴 ${critical.length} критичных проблем компоновки` : '✓ Критичных проблем не найдено'}
          </p>
          {critical.map((c, i) => (
            <p key={i} className="text-[11px] text-stop leading-snug mb-1">{c.message}</p>
          ))}
        </div>

        {warnings.length > 0 && (
          <div className="bg-amber-wash border-l-4 border-amber rounded-lg p-4">
            <p className="text-xs font-bold text-amber mb-2">⚠️ {warnings.length} предупреждений</p>
            {warnings.map((w, i) => (
              <p key={i} className="text-[11px] text-amber leading-snug mb-1">{w.message}</p>
            ))}
          </div>
        )}

        <div className="bg-card border border-rule rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">BOM (расчётный)</p>
          <div className="text-xs flex flex-col gap-1.5">
            <div className="flex justify-between"><span className="text-muted">Полки (CLD)</span><b>{bom.shelves.count} шт, {bom.shelves.totalAreaM2} м²</b></div>
            <div className="flex justify-between"><span className="text-muted">Ножки</span><b>{bom.legs.count} × {bom.legs.heightMm}мм</b></div>
            <div className="flex justify-between"><span className="text-muted">Шурупы 4×50</span><b>{bom.fasteners.screws_4x50} шт</b></div>
            <div className="flex justify-between"><span className="text-muted">Pocket holes</span><b>{bom.fasteners.pocket_holes} шт</b></div>
            <div className="flex justify-between"><span className="text-muted">Кабели рэка</span><b>{bom.cables.count} шт, {bom.cables.totalLengthM} м</b></div>
          </div>
        </div>

        <div className="bg-card border border-rule rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Виниловая башня</p>
          <div className="text-xs flex flex-col gap-1.5">
            <div className="flex justify-between"><span className="text-muted">Секция под LP</span><b>≥{VINYL_TOWER.compartmentInnerSize}×{VINYL_TOWER.compartmentInnerSize} мм</b></div>
            <div className="flex justify-between"><span className="text-muted">Отделений</span><b>{VINYL_TOWER.compartments}</b></div>
          </div>
        </div>

        <div className="bg-faint/5 border border-rule rounded-lg p-3">
          <p className="text-[10px] text-muted leading-relaxed">
            Открытые вопросы (см. handoff §6): модель третьего DAC, модель робота-пылесоса, размер виниловой коллекции,
            фактический вес Topping A90, фактическая верхняя точка FiiO Warmer R2R с лампами. Не выдумываем значения —
            пересчитай constraints после уточнения.
          </p>
        </div>
      </div>
    </div>
  );
}
