import React, { forwardRef, useState } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { Html } from '@react-three/drei';
import { EQUIPMENT_PHYSICAL } from '../data/cabinetSpecs';
import { DEVICE_SPECS } from '../data/devicePorts';
import EquipmentModel from './EquipmentModel';

const MM_TO_M = 0.001;

// Физическое тело устройства: настоящий RigidBody с массой из реальных
// характеристик (phys.weight), которое падает под гравитацией и
// упирается в полку снизу (Collider полки — см. ShelfMesh). Контакт
// решает Rapier, поэтому устройство реально СТОИТ на полке — не висит
// в заранее посчитанной точке, которая рассинхронизируется при любых
// изменениях сцены (exploded, будущий drag-and-drop).
//
// EquipmentModel builds schematic chassis, controls and a turntable platter
// within the catalog envelope. Product photos remain in the details panel.
//
// ref передаётся НАПРЯМУЮ в <RigidBody> (rapier's RigidBodyApi) — никакой
// промежуточной useImperativeHandle-обёртки: та фиксирует bodyRef.current
// в момент первого рендера этого компонента (до коммита RigidBody), из-за
// чего родитель навсегда получал null и физические кабели/дебаг-хук не
// видели тело устройства вообще.
const EquipmentBox = forwardRef(function EquipmentBox(
  { equipmentId, dropPosition, exploded = false, onSelect, selected },
  ref
) {
  const [hovered, setHovered] = useState(false);

  const phys = EQUIPMENT_PHYSICAL[equipmentId];
  const spec = DEVICE_SPECS[equipmentId];
  if (!phys || !spec) return null;

  const w = phys.dims.w * MM_TO_M;
  const h = phys.dims.h * MM_TO_M;
  const d = phys.dims.d * MM_TO_M;

  return (
    <RigidBody
      ref={ref}
      position={dropPosition}
      colliders={false}
      mass={Math.max(phys.weight, 0.1)}
      friction={2.0} // высокие резиновые опоры реально держат корпус на месте;
                     // без этого лёгкие устройства (a90 2кг) перетягиваются
                     // вверх тяжёлыми кабелями к устройствам на ярус выше
      restitution={0.02}
      linearDamping={0.6}
      angularDamping={0.95}
      // Positions on a shelf are design constraints. Let gravity seat the box,
      // but cable impulses must not rotate or move a configured unit sideways.
      lockRotations
      enabledTranslations={[false, true, false]}
      type={exploded ? 'kinematicPosition' : 'dynamic'}
      userData={{ equipmentId }}
    >
      <CuboidCollider args={[w / 2, h / 2, d / 2]} />
      <group
          onClick={(e) => { e.stopPropagation(); onSelect && onSelect(equipmentId); }}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
          onPointerOut={() => setHovered(false)}
        >
        <EquipmentModel {...{ equipmentId, w, h, d }} selected={hovered || selected} />
        {(hovered || selected) && (
          <Html position={[0, h / 2 + 0.03, 0]} center>
            <div style={{
              background: '#11171A', color: '#fff', padding: '3px 8px', borderRadius: 4,
              fontSize: 11, whiteSpace: 'nowrap', fontFamily: 'sans-serif', pointerEvents: 'none',
            }}>
              {spec.name} · {phys.dims.w}×{phys.dims.h}×{phys.dims.d}мм · {phys.weight}кг
            </div>
          </Html>
        )}
      </group>
    </RigidBody>
  );
});

export default EquipmentBox;
