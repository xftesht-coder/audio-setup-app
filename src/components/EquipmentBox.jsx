import React, { useState } from 'react';
import { useTexture, Html } from '@react-three/drei';
import { EQUIPMENT_PHYSICAL } from '../data/cabinetSpecs';
import { DEVICE_SPECS } from '../data/devicePorts';

const MM_TO_M = 0.001;

// Простой прямоугольный корпус с текстурой фото на верхней/передней грани.
// Координаты: x — вправо, y — вверх, z — от передней грани стойки в глубину.
export default function EquipmentBox({ equipmentId, position, exploded = false, onSelect, selected }) {
  const [hovered, setHovered] = useState(false);
  const phys = EQUIPMENT_PHYSICAL[equipmentId];
  const spec = DEVICE_SPECS[equipmentId];
  if (!phys || !spec) return null;

  const w = phys.dims.w * MM_TO_M;
  const h = phys.dims.h * MM_TO_M;
  const d = phys.dims.d * MM_TO_M;

  let texture = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    texture = useTexture(phys.photo);
  } catch (e) {
    texture = null;
  }

  const yOffset = exploded ? 0.4 : 0;

  const heatColor = phys.heat === 'high' ? '#c1121f' : phys.heat === 'medium' ? '#e09f3e' : '#2a6b4a';

  return (
    <group position={[position[0], position[1] + yOffset, position[2]]}>
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
          map={texture || undefined}
          roughness={0.6}
          metalness={0.15}
        />
      </mesh>
      {/* индикатор теплового класса на передней грани */}
      <mesh position={[-(w / 2) + 0.01, -(h / 2) + 0.01, d / 2 + 0.001]}>
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
  );
}
