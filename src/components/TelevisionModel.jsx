import { RoundedBox, Html, MeshReflectorMaterial } from '@react-three/drei';
import { televisionBox, televisionEnvelope, televisionObstacles } from '../data/television';

export default function TelevisionModel({ project, dimensions, roomReflection = false }) {
  if (!project.television) return null;
  const tv = project.television, box = televisionBox(project), screen = televisionEnvelope(tv);
  return <group>
    <RoundedBox args={box.size.map(v => v / 1000)} radius={0.006} smoothness={3} position={box.center.map(v => v / 1000)} castShadow receiveShadow>
      <meshStandardMaterial color="#171b20" metalness={0.65} roughness={0.3} />
    </RoundedBox>
    <mesh position={[box.center[0] / 1000, box.center[1] / 1000, (box.center[2] + screen.depth / 2 + 0.5) / 1000]}>
      <planeGeometry args={[screen.screenWidth / 1000, screen.screenHeight / 1000]} />
      {roomReflection ? <MeshReflectorMaterial resolution={512} blur={[140,40]} mixBlur={.4} mixStrength={.7} color="#161d24" metalness={.75} roughness={.24} mirror={.22} /> : <meshPhysicalMaterial color="#121d2a" metalness={0.18} roughness={0.13} clearcoat={1} clearcoatRoughness={0.09} envMapIntensity={1.1} />}
    </mesh>
    {televisionObstacles(project).slice(1).map(part => <RoundedBox key={part.id} args={part.size.map(v => v / 1000)} radius={0.003} smoothness={2} position={part.center.map(v => v / 1000)} castShadow receiveShadow><meshStandardMaterial color="#252a30" metalness={0.7} roughness={0.28} /></RoundedBox>)}
    <mesh position={[(box.center[0] + screen.width / 2 - 25) / 1000, (box.center[1] - screen.height / 2 + 6) / 1000, (box.center[2] + screen.depth / 2 + 1) / 1000]}><sphereGeometry args={[0.0018, 8, 8]} /><meshStandardMaterial color="#9fa7ae" emissive="#75849b" emissiveIntensity={0.3} /></mesh>
    {dimensions && <Html position={[tv.x / 1000, (box.center[1] + screen.height / 2 + 40) / 1000, tv.z / 1000]} center><span className="cad-dimension">{tv.diagonal}″ · 16:9 · модель ТВ не выбрана</span></Html>}
  </group>;
}
