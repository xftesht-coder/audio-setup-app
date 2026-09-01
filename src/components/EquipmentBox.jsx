import React, { forwardRef, useState } from 'react';
import { RigidBody } from '@react-three/rapier';
import { Html } from '@react-three/drei';
import { EQUIPMENT_PHYSICAL } from '../data/cabinetSpecs';
import { DEVICE_SPECS } from '../data/devicePorts';

const MM_TO_M = 0.001;

// Физическое тело устройства: настоящий RigidBody с массой из реальных
// характеристик (phys.weight), которое падает под гравитацией и
// упирается в полку снизу (Collider полки — см. ShelfMesh). Контакт
// решает Rapier, поэтому устройство реально СТОИТ на полке — не висит
// в заранее посчитанной точке, которая рассинхронизируется при любых
// изменениях сцены (exploded, будущий drag-and-drop).
//
// Внешний вид: чистый цвет корпуса устройства (spec.color). Фото товара
// сюда намеренно не идёт текстурой — aspect ratio реального фото
// никогда не совпадает с гранью бокса и даёт мутную растянутую
// картинку; живое фото — в 2D-панели деталей (DeviceDetailPanel).
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

  const heatColor = phys.heat === 'high' ? '#c1121f' : phys.heat === 'medium' ? '#e09f3e' : '#2a6b4a';

  return (
    <RigidBody
      ref={ref}
      position={dropPosition}
      colliders="cuboid"
      mass={Math.max(phys.weight, 0.1)}
      friction={0.9}
      restitution={0.02}
      linearDamping={0.6}
      angularDamping={0.95}
      type={exploded ? 'kinematicPosition' : 'dynamic'}
      userData={{ equipmentId }}
    >
      <group>
        <mesh
          castShadow
          receiveShadow
          onClick={(e) => { e.stopPropagation(); onSelect && onSelect(equipmentId); }}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
          onPointerOut={() => setHovered(false)}
        >
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial
            color={hovered || selected ? '#ffe8b0' : spec.color}
            roughness={0.55}
            metalness={0.2}
          />
        </mesh>
        <mesh position={[-(w / 2) + 0.012, -(h / 2) + 0.012, d / 2 + 0.001]}>
          <circleGeometry args={[0.006, 12]} />
          <meshBasicMaterial color={heatColor} />
        </mesh>
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
