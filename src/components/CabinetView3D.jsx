import React, { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, CatmullRomLine } from '@react-three/drei';
import * as THREE from 'three';
import EquipmentBox from './EquipmentBox';
import ShelfMesh from './ShelfMesh';
import { MAIN_RACK, EQUIPMENT_PHYSICAL, RACK_CABLES } from '../data/cabinetSpecs';

const MM_TO_M = 0.001;

// Рассчитывает Y-координату (низ полки) каждого яруса снизу вверх,
// возвращает также абсолютную Y верхней грани техники на ярусе (для кабелей).
function computeLayout() {
  let y = (MAIN_RACK.legHeight + MAIN_RACK.plinthHeight) * MM_TO_M; // низ первого яруса
  const layout = [];
  MAIN_RACK.tiers.forEach((tier) => {
    const shelfTopY = y + MAIN_RACK.shelfThickness * MM_TO_M;
    const itemPositions = tier.items.map(({ equipmentId, x }) => {
      const phys = EQUIPMENT_PHYSICAL[equipmentId];
      const h = phys.dims.h * MM_TO_M;
      const centerY = shelfTopY + h / 2;
      // x: 0 в центре MAIN_RACK.innerWidth, конвертируем из мм-офсета в метры относительно центра
      const centerX = (x - MAIN_RACK.innerWidth / 2) * MM_TO_M;
      return { equipmentId, position: [centerX, centerY, 0], topY: centerY + h / 2 };
    });
    layout.push({
      tierId: tier.id,
      shelfY: y,
      items: itemPositions,
    });
    const tierHeight = Math.max(
      ...tier.items.map(({ equipmentId }) => EQUIPMENT_PHYSICAL[equipmentId].dims.h),
      0
    );
    y = shelfTopY + tierHeight * MM_TO_M + tier.clearanceAbove * MM_TO_M;
  });
  // финальная (верхняя) полка-крышка
  layout.push({ tierId: 'top_cap', shelfY: y, items: [] });
  return { layout, totalHeight: y + MAIN_RACK.shelfThickness * MM_TO_M };
}

function Legs() {
  const legHeight = MAIN_RACK.legHeight * MM_TO_M;
  const halfW = (MAIN_RACK.innerWidth * MM_TO_M) / 2 - 0.02;
  const halfD = (MAIN_RACK.shelfDepth * MM_TO_M) / 2 - 0.02;
  const positions = [
    [-halfW, legHeight / 2, -halfD],
    [halfW, legHeight / 2, -halfD],
    [-halfW, legHeight / 2, halfD],
    [halfW, legHeight / 2, halfD],
  ];
  return positions.map((p, i) => (
    <mesh key={i} position={p} castShadow>
      <cylinderGeometry args={[0.012, 0.012, legHeight, 12]} />
      <meshStandardMaterial color="#8A8D91" metalness={0.8} roughness={0.35} />
    </mesh>
  ));
}

function Cables({ layout, xray }) {
  const posByEquip = useMemo(() => {
    const m = {};
    layout.forEach((tier) => tier.items.forEach((it) => { m[it.equipmentId] = it.position; }));
    return m;
  }, [layout]);

  if (xray) return null;

  return RACK_CABLES.map((cable) => {
    const from = posByEquip[cable.from];
    const to = posByEquip[cable.to];
    if (!from || !to) return null;
    const midY = Math.min(from[1], to[1]) - 0.06; // провисание вниз к задней стенке
    const points = [
      new THREE.Vector3(from[0], from[1] - 0.02, from[2] + 0.05),
      new THREE.Vector3((from[0] + to[0]) / 2, midY, 0.15),
      new THREE.Vector3(to[0], to[1] - 0.02, to[2] + 0.05),
    ];
    return (
      <CatmullRomLine key={cable.id} points={points} color="#1a1a1a" lineWidth={2} />
    );
  });
}

export default function CabinetView3D({ xray, exploded, selected, onSelect }) {
  const { layout, totalHeight } = useMemo(() => computeLayout(), []);

  return (
    <div className="bg-card border border-rule rounded-lg" style={{ height: 560 }}>
      <Canvas shadows camera={{ position: [1.6, 1.1, 1.8], fov: 40 }}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[2, 3, 2]} intensity={1.1} castShadow />
        <Suspense fallback={null}>
          <Environment preset="apartment" />
          <group>
            <Legs />
            {layout.map((tier) => (
              <ShelfMesh
                key={tier.tierId}
                width={MAIN_RACK.innerWidth}
                depth={MAIN_RACK.shelfDepth}
                thickness={MAIN_RACK.shelfThickness}
                y={tier.shelfY}
                xray={xray}
              />
            ))}
            {layout.flatMap((tier) =>
              tier.items.map((item) => (
                <EquipmentBox
                  key={item.equipmentId}
                  equipmentId={item.equipmentId}
                  position={item.position}
                  exploded={exploded}
                  selected={selected === item.equipmentId}
                  onSelect={onSelect}
                />
              ))
            )}
            <Cables layout={layout} xray={xray} />
          </group>
          {/* пол для тени и масштаба */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[3, 3]} />
            <shadowMaterial opacity={0.25} />
          </mesh>
        </Suspense>
        <OrbitControls target={[0, totalHeight / 2, 0]} minDistance={0.8} maxDistance={5} />
      </Canvas>
    </div>
  );
}
