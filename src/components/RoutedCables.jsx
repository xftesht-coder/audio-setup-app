import { useMemo, useEffect } from 'react';
import { CurvePath, LineCurve3, Vector3, TubeGeometry } from 'three';
import { Line } from '@react-three/drei';

function CableTube({ route, selected, onSelect }) {
  const geometry = useMemo(() => {
    const path = new CurvePath();
    route.points.slice(1).forEach((p, i) => path.add(new LineCurve3(new Vector3(...route.points[i]).multiplyScalar(0.001), new Vector3(...p).multiplyScalar(0.001))));
    return new TubeGeometry(path, Math.min(700, Math.max(80, route.points.length)), route.cable.diameter / 2000, 8, false);
  }, [route]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const color = route.issues.length ? '#d34536' : selected ? '#e9ac3f' : route.cable.category === 'power' ? '#607c9f' : route.cable.category === 'dc' ? '#7d7768' : '#292f30';
  return <group onClick={e => { e.stopPropagation(); onSelect(); }}>
    <mesh geometry={geometry} castShadow><meshStandardMaterial color={color} roughness={0.55} /></mesh>
    {route.connectors.map(([a, b], i) => <mesh key={i} position={a.map((v, j) => (v + b[j]) / 2000)} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[route.cable.connectorDiameter / 2000, route.cable.connectorDiameter / 2000, route.cable.connectorLength / 1000, 16]} />
      <meshStandardMaterial color="#444b4c" metalness={0.65} roughness={0.3} />
    </mesh>)}
  </group>;
}

export default function RoutedCables({ project, routes, selection, select, detail }) {
  const frameZ = Math.min(...routes.flatMap(r => r.points.map(p => p[2]))) - 30;
  const frameX = project.width / 2 + 150;
  const top = Math.max(...project.shelves.map(s => s.y + s.thickness));
  return <group>
    {routes.map(r => <CableTube key={r.cable.id} route={r} selected={selection?.id === r.cable.id} onSelect={() => select({ type: 'cable', id: r.cable.id })} />)}
    {[-frameX, frameX].map(x => <mesh key={x} position={[x / 1000, top / 2000, frameZ / 1000]}><boxGeometry args={[0.018, top / 1000, 0.025]} /><meshStandardMaterial color="#3f4747" /></mesh>)}
    <mesh position={[0, 0.04, (frameZ + 110) / 1000]}><boxGeometry args={[(frameX * 2 + 40) / 1000, 0.016, 0.24]} /><meshStandardMaterial color="#4e5656" roughness={0.7} /></mesh>
    {project.shelves.map(s => <mesh key={s.id} position={[0, (s.y + s.thickness + 20) / 1000, frameZ / 1000]}><boxGeometry args={[frameX * 2 / 1000, 0.012, 0.022]} /><meshStandardMaterial color="#626b65" /></mesh>)}
    {routes.map(r => <group key={`support-${r.cable.id}`}>
      {r.supports.map((point, i) => <group key={i}>
        <mesh position={point.map(v => v / 1000)}><sphereGeometry args={[r.cable.diameter / 2000 + 0.003, 10, 6]} /><meshStandardMaterial color="#b2a98e" metalness={0.2} roughness={0.65} /></mesh>
        {(selection?.id === r.cable.id || (detail && !selection && r.cable.id === 'p_arcam')) && <>
          <Line points={[[-frameX / 1000, point[1] / 1000, frameZ / 1000], [frameX / 1000, point[1] / 1000, frameZ / 1000]]} color="#6f7975" lineWidth={2} />
          <Line points={[point.map(v => v / 1000), [point[0] / 1000, point[1] / 1000, frameZ / 1000]]} color="#8c9388" lineWidth={1} />
        </>}
      </group>)}
    </group>)}
  </group>;
}
