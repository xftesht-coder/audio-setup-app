import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier';
import ShelfMesh from './ShelfMesh';
import EquipmentBox from './EquipmentBox';
import PhysicalCable from './PhysicalCable';
import ShelfValidator from './ShelfValidator';
import { useCabinetStore } from '../stores/useCabinetStore';
import { MAIN_RACK, EQUIPMENT_PHYSICAL, RACK_CABLES, MATERIALS } from '../data/cabinetSpecs';
import { getPortLocalAnchor } from '../data/portGeometry';

const MM_TO_M = 0.001;

// Считает ЦЕЛЕВУЮ (не обязательную) позицию каждого яруса и точку сброса
// (drop position) для каждого устройства — несколько сантиметров НАД
// расчётной высотой полки. RigidBody падает под гравитацией и физически
// упирается в Collider полки (см. ShelfMesh) — реальная итоговая Y
// определяется контактом, а не этим расчётом. Расчёт здесь только даёт
// (а) X-позицию на полке (из брифа v2, MAIN_RACK.tiers[].items[].x)
// и (б) стартовую высоту сброса, чтобы устройство упало на СВОЮ полку,
// а не на соседнюю.
function computeShelfPositions() {
  let y = (MAIN_RACK.legHeight + MAIN_RACK.plinthHeight) * MM_TO_M;
  const shelves = [];
  const drops = []; // { equipmentId, position: [x,y,z] }

  MAIN_RACK.tiers.forEach((tier) => {
    const shelfTopY = y + MAIN_RACK.shelfThickness * MM_TO_M;
    shelves.push({ tierId: tier.id, y });

    tier.items.forEach(({ equipmentId, x }) => {
      const phys = EQUIPMENT_PHYSICAL[equipmentId];
      const centerX = (x - MAIN_RACK.innerWidth / 2) * MM_TO_M;
      // Сброс СОВСЕМ немного (1см) выше расчётного положения на СВОЕЙ
      // полке — не «с большим запасом сверху». С реальными (тесными)
      // зазорами из брифа (40мм на некоторых ярусах) высокий сброс
      // спавнил устройство уже ВНУТРИ полки следующего яруса, и Rapier
      // «решал» это неверно — устройство проваливалось или зависало.
      const restY = shelfTopY + phys.dims.h * MM_TO_M / 2;
      const dropY = restY + 0.01;
      drops.push({ equipmentId, position: [centerX, dropY, 0] });
    });

    const tierHeight = Math.max(...tier.items.map(({ equipmentId }) => EQUIPMENT_PHYSICAL[equipmentId].dims.h), 0);
    y = shelfTopY + tierHeight * MM_TO_M + tier.clearanceAbove * MM_TO_M;
  });
  shelves.push({ tierId: 'top_cap', y });

  return { shelves, drops, totalHeight: y + MAIN_RACK.shelfThickness * MM_TO_M };
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
    <RigidBody key={i} type="fixed" position={p} colliders={false}>
      <CuboidCollider args={[0.012, legHeight / 2, 0.012]} />
      <mesh castShadow>
        <cylinderGeometry args={[0.012, 0.012, legHeight, 12]} />
        <meshStandardMaterial color="#8A8D91" metalness={0.8} roughness={0.35} />
      </mesh>
    </RigidBody>
  ));
}

function Floor() {
  return (
    <RigidBody type="fixed" position={[0, -0.01, 0]} colliders={false}>
      <CuboidCollider args={[1.5, 0.01, 1.5]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3, 3]} />
        <shadowMaterial opacity={0.25} />
      </mesh>
    </RigidBody>
  );
}

/**
 * CabinetView3D — центральная 3D-сцена тумбы.
 *
 * Подписывается на Zustand store (useCabinetStore) вместо собственного
 * локального состояния для xray/exploded/selected — так UI в CabinetPanel
 * и 3D синхронизированы через один источник правды, а MaterialPicker
 * live-меняет цвет деревянных частей тумбы без перезагрузки.
 */
export default function CabinetView3D() {
  const { xray, exploded, selected, onSelect, materialId } = useCabinetStore();
  const { shelves, drops, totalHeight } = useMemo(() => computeShelfPositions(), []);
  const bodyRefs = useRef({}); // equipmentId -> RigidBody API ref
  const [bodiesReady, setBodiesReady] = useState(false);

  // RigidBody рефы крепятся ПОСЛЕ первого коммита (стандартное поведение
  // React ref attach). Без этого триггера кабели молча не рендерились бы
  // на первом кадре, потому что bodyRefs.current[id].current был бы null
  // в момент, когда PhysicalCable впервые проверяет готовность тел.
  useEffect(() => {
    setBodiesReady(true);
  }, []);

  // Теоретическая центральная Y для каждого юнита, чтобы ShelfValidator
  // сравнивал с реальной осевшей world-Y (см. ShelfValidator.jsx).
  // НЕ dropY (start+0.01): сравниваем с истинной точкой покоя restY —
  // иначе все юниты "опрокидываются" на 1см выше из-за стартового
  // приподнятого спавна, и валидатор ложно помечает их как settling.
  const expectedYByUnit = useMemo(() => {
    const map = {};
    drops.forEach((d) => {
      const phys = EQUIPMENT_PHYSICAL[d.equipmentId];
      if (phys) {
        map[d.equipmentId] = d.position[1] - 0.01; // обратный dropY -> restY
      }
    });
    return map;
  }, [drops]);

  const matColor = useMemo(() => MATERIALS[materialId]?.color ?? MATERIALS.alder.color, [materialId]);

  return (
    <div className="bg-card border border-rule rounded-lg" style={{ height: 560 }}>
      <Canvas shadows camera={{ position: [1.6, 1.1, 1.8], fov: 40 }}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[2, 3, 2]} intensity={1.1} castShadow />
        <Suspense fallback={null}>
          <Environment preset="apartment" />
          <Physics gravity={[0, -9.81, 0]} colliders={false}>
            <ShelfValidator bodyRefs={bodyRefs} expectedYByUnit={expectedYByUnit} />
            <Floor />
            <Legs />
            {shelves.map((s) => (
              <ShelfMesh
                key={s.tierId}
                width={MAIN_RACK.innerWidth}
                depth={MAIN_RACK.shelfDepth}
                thickness={MAIN_RACK.shelfThickness}
                position={[0, s.y, 0]}
                materialColor={matColor}
                xray={xray}
              />
            ))}
            {drops.map(({ equipmentId, position }) => {
              if (!bodyRefs.current[equipmentId]) bodyRefs.current[equipmentId] = React.createRef();
              return (
                <EquipmentBox
                  key={equipmentId}
                  ref={bodyRefs.current[equipmentId]}
                  equipmentId={equipmentId}
                  dropPosition={position}
                  exploded={exploded}
                  selected={selected === equipmentId}
                  onSelect={onSelect}
                />
              );
            })}
            {!xray && bodiesReady && RACK_CABLES.map((cable) => {
              const fromBody = bodyRefs.current[cable.from];
              const toBody = bodyRefs.current[cable.to];
              const fromDrop = drops.find((d) => d.equipmentId === cable.from);
              const toDrop = drops.find((d) => d.equipmentId === cable.to);
              if (!fromBody || !toBody || !fromDrop || !toDrop) return null;
              const fromLocal = getPortLocalAnchor(cable.from, cable.fromPort);
              const toLocal = getPortLocalAnchor(cable.to, cable.toPort);
              const fromWorld = [
                fromDrop.position[0] + fromLocal[0],
                fromDrop.position[1] + fromLocal[1],
                fromDrop.position[2] + fromLocal[2],
              ];
              const toWorld = [
                toDrop.position[0] + toLocal[0],
                toDrop.position[1] + toLocal[1],
                toDrop.position[2] + toLocal[2],
              ];
              return (
                <PhysicalCable
                  key={cable.id}
                  cable={cable}
                  fromBody={fromBody}
                  toBody={toBody}
                  fromLocal={fromLocal}
                  toLocal={toLocal}
                  fromWorld={fromWorld}
                  toWorld={toWorld}
                  xray={xray}
                />
              );
            })}
          </Physics>
        </Suspense>
        <OrbitControls target={[0, totalHeight / 2, 0]} minDistance={0.8} maxDistance={5} />
      </Canvas>
    </div>
  );
}