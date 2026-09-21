import { useEffect, useMemo } from 'react';
import { ExtrudeGeometry, Path, Shape } from 'three';
import { shelfHoles } from '../data/workshop';
import useWoodTexture from './useWoodTexture';

export default function ShelfMesh({ project, shelf, xray, selected, onClick }) {
  const grain = useWoodTexture();
  const geometry = useMemo(() => {
    const w = shelf.width / 1000, d = shelf.depth / 1000;
    const shape = new Shape();
    shape.moveTo(-w / 2, -d / 2); shape.lineTo(w / 2, -d / 2); shape.lineTo(w / 2, d / 2); shape.lineTo(-w / 2, d / 2); shape.closePath();
    const accepted = [];
    shelfHoles(project, shelf).forEach(h => {
      if (Math.abs(h.x) + h.diameter / 2 >= shelf.width / 2 || Math.abs(h.z) + h.diameter / 2 >= shelf.depth / 2) return;
      if (accepted.some(a => Math.hypot(a.x - h.x, a.z - h.z) <= (a.diameter + h.diameter) / 2)) return;
      const hole = new Path(); hole.absarc(h.x / 1000, -h.z / 1000, h.diameter / 2000, 0, Math.PI * 2, true);
      shape.holes.push(hole); accepted.push(h);
    });
    return new ExtrudeGeometry(shape, { depth: shelf.thickness / 1000, bevelEnabled: false, curveSegments: 32 });
  }, [project, shelf]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const colors = { walnut: '#795035', oak: '#BC9664', alder: '#C9A876' };
  return <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow onClick={onClick}>
    <meshStandardMaterial color={colors[project.material]} map={grain} roughness={0.53} transparent={xray} opacity={xray ? 0.2 : 1} emissive={selected ? '#2d573e' : '#000'} emissiveIntensity={0.18} />
  </mesh>;
}
