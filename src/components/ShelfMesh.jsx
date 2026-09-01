import React from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';

const MM_TO_M = 0.001;

// Полка CLD-сэндвич как ФИКСИРОВАННОЕ физическое тело (type="fixed"),
// с которым сталкиваются падающие RigidBody устройств. Именно контакт
// с этим коллайдером определяет, где реально "стоит" устройство — а не
// заранее посчитанный Y, который рассинхронизируется при любых
// изменениях сцены.
export default function ShelfMesh({ width, depth, thickness, position, materialColor = '#C9A876', xray = false }) {
  const w = width * MM_TO_M;
  const d = depth * MM_TO_M;
  const t = thickness * MM_TO_M;
  const dampingT = t * 0.25;
  const coreT = t - dampingT;

  // position.y — АБСОЛЮТНЫЙ НИЗ полки (низ демпфирующего слоя). Верх
  // жёсткого core-слоя (== верх коллайдера == поверхность, на которую
  // реально опираются устройства) оказывается ровно в position.y + t,
  // что совпадает с shelfTopY, который считает CabinetView3D. Раньше
  // коллайдер был центрирован НА position.y (а не строился от него
  // вверх), из-за чего верх коллайдера был на t/2 (2см) ниже ожидаемого
  // и все устройства физически "проседали" на эту величину сквозь свою
  // расчётную позицию.
  return (
    <RigidBody type="fixed" position={position} colliders={false}>
      <CuboidCollider args={[w / 2, coreT / 2, d / 2]} position={[0, dampingT + coreT / 2, 0]} />
      <mesh position={[0, dampingT + coreT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, coreT, d]} />
        <meshStandardMaterial color={materialColor} roughness={0.75} transparent={xray} opacity={xray ? 0.35 : 1} />
      </mesh>
      <mesh position={[0, dampingT / 2, 0]}>
        <boxGeometry args={[w, dampingT, d]} />
        <meshStandardMaterial color="#2B2B2B" roughness={0.9} transparent={xray} opacity={xray ? 0.35 : 1} />
      </mesh>
    </RigidBody>
  );
}
