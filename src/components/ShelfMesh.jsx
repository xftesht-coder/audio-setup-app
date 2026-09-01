import React from 'react';

const MM_TO_M = 0.001;

// Полка CLD-сэндвич: тонкий видимый слой демпфирования снизу жёсткого слоя.
export default function ShelfMesh({ width, depth, thickness, y, xray = false }) {
  const w = width * MM_TO_M;
  const d = depth * MM_TO_M;
  const t = thickness * MM_TO_M;
  const dampingT = t * 0.25;
  const coreT = t - dampingT;

  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, dampingT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, coreT, d]} />
        <meshStandardMaterial color="#C9A876" roughness={0.75} transparent={xray} opacity={xray ? 0.35 : 1} />
      </mesh>
      <mesh position={[0, -coreT / 2, 0]}>
        <boxGeometry args={[w, dampingT, d]} />
        <meshStandardMaterial color="#2B2B2B" roughness={0.9} transparent={xray} opacity={xray ? 0.35 : 1} />
      </mesh>
    </group>
  );
}
