import { useEffect, useMemo } from 'react';
import { Shape, Path, ExtrudeGeometry } from 'three';
import { HARDWARE, postCenters, sortedShelves } from '../data/workshop';

function Ring({ outer, inner, height, position, hex = false, color = '#777c7b', ghost = false }) {
  const geometry = useMemo(() => {
    const shape = new Shape();
    if (hex) {
      for (let i = 0; i < 6; i++) { const a = Math.PI * i / 3; const x = Math.cos(a) * outer / 1000, y = Math.sin(a) * outer / 1000; if (i) shape.lineTo(x, y); else shape.moveTo(x, y); }
      shape.closePath();
    } else shape.absarc(0, 0, outer / 1000, 0, Math.PI * 2, false);
    const hole = new Path(); hole.absarc(0, 0, inner / 1000, 0, Math.PI * 2, true); shape.holes.push(hole);
    return new ExtrudeGeometry(shape, { depth: Math.max(0.001, height / 1000), bevelEnabled: false, curveSegments: 20 });
  }, [outer, inner, height, hex]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={position} rotation={[-Math.PI / 2, 0, 0]} castShadow>
    <meshStandardMaterial color={color} metalness={0.7} roughness={0.35} transparent={ghost} opacity={ghost ? 0.18 : 1} />
  </mesh>;
}

export default function RackFrame({ project, ghost, exploded }) {
  const shelves = sortedShelves(project), h = HARDWARE;
  const top = Math.max(...shelves.map(s => s.y + s.thickness)) + 23;
  return postCenters(project).map(([x, z], index) => <group key={index} position={[x / 1000, 0, z / 1000]}>
    <mesh position={[0, top / 2000, 0]} castShadow><cylinderGeometry args={[0.008, 0.008, top / 1000, 24]} /><meshStandardMaterial color="#646a69" metalness={0.75} roughness={0.35} transparent={ghost} opacity={ghost ? 0.2 : 1} /></mesh>
    <mesh position={[0, 0.013, 0]} castShadow><cylinderGeometry args={[0.03, 0.033, 0.026, 32]} /><meshStandardMaterial color="#282b2b" roughness={0.8} /></mesh>
    {shelves.map((s, i) => {
      const offset = exploded ? i * 160 : 0;
      const bottom = i ? shelves[i - 1].y + shelves[i - 1].thickness + h.washerT + h.nutH : h.footH;
      const sleeve = s.y - h.washerT - h.nutH - bottom;
      return <group key={s.id}>
        {sleeve > 0 && <Ring outer={project.postDiameter / 2} inner={14} height={sleeve} position={[0, bottom / 1000, 0]} color="#282d2e" ghost={ghost || exploded} />}
        <Ring outer={15} inner={8.5} height={3} position={[0, (s.y - 3 + offset) / 1000, 0]} />
        <Ring outer={15} inner={8.5} height={3} position={[0, (s.y + s.thickness + offset) / 1000, 0]} />
        <Ring hex outer={h.nutAF / Math.sqrt(3)} inner={7} height={h.nutH} position={[0, (s.y - 3 - h.nutH + offset) / 1000, 0]} />
        <Ring hex outer={h.nutAF / Math.sqrt(3)} inner={7} height={h.nutH} position={[0, (s.y + s.thickness + 3 + offset) / 1000, 0]} />
      </group>;
    })}
  </group>);
}
