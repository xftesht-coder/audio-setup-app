import { useEffect, useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import { CanvasTexture, SRGBColorSpace } from 'three';
import useWoodTexture from './useWoodTexture';

function useFaceTexture(id, ratio) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.max(160, Math.round(1024 / ratio));
    const c = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const silver = id === 'a90' || id === 'phono' || id === 'dac_fiio';
    c.fillStyle = silver ? '#bfc1bf' : id === 'arcam' ? '#3c3f40' : '#202222';
    c.fillRect(0, 0, w, h);
    c.fillStyle = silver ? '#313536' : '#e5e5df';
    c.font = '500 23px sans-serif';
    c.fillText({ arcam: 'ARCAM', a90: 'TOPPING', phono: 'SCHIIT', dac_fiio: 'SCHIIT', streamer_wiim: 'WiiM' }[id], 25, 33);
    if (id === 'dac_fiio') {
      c.fillStyle = '#333b3a'; c.font = '22px sans-serif';
      c.fillText('BIFROST 3', w * 0.72, h * 0.58);
      for (let i = 0; i < 4; i += 1) {
        c.fillStyle = i === 0 ? '#fff8dc' : '#69706d';
        c.beginPath(); c.arc(w * (0.23 + i * 0.07), h * 0.58, 4, 0, Math.PI * 2); c.fill();
      }
    } else if (id === 'arcam') {
      c.fillStyle = '#101619'; c.fillRect(w * 0.32, h * 0.22, w * 0.44, h * 0.45);
      c.fillStyle = '#a7d4d8'; c.font = '25px monospace'; c.fillText('SA10    28', w * 0.43, h * 0.52);
      for (let i = 0; i < 7; i += 1) { c.fillStyle = '#b3b4af'; c.fillRect(w * (0.34 + i * 0.054), h * 0.79, 44, 8); }
    } else if (id === 'a90') {
      c.fillStyle = '#edf7f5'; c.font = '55px monospace'; c.fillText('38', w * 0.18, h * 0.72);
    } else if (id === 'phono') {
      c.fillStyle = '#626765'; c.font = '19px sans-serif'; c.fillText('SKOLL', w * 0.72, h * 0.53);
      for (let i = 0; i < 5; i += 1) { c.beginPath(); c.arc(w * (0.2 + i * 0.085), h * 0.6, 4, 0, Math.PI * 2); c.fill(); }
    } else {
      c.fillStyle = '#b7c5bf'; c.font = '28px sans-serif'; c.fillText('−      ▷      +', w * 0.34, h * 0.66);
    }
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  }, [id, ratio]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function Feet({ w, h, d }) {
  return [-1, 1].flatMap(x => [-1, 1].map(z => (
    <mesh key={`${x}:${z}`} position={[x * (w / 2 - 0.023), -h / 2 + 0.005, z * (d / 2 - 0.023)]} castShadow>
      <cylinderGeometry args={[0.012, 0.014, 0.01, 20]} />
      <meshStandardMaterial color="#171a1b" roughness={0.78} />
    </mesh>
  )));
}

function Knob({ position, radius = 0.012, color = '#a7aaa8' }) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[radius, radius, 0.008, 32]} />
      <meshStandardMaterial color={color} metalness={0.82} roughness={0.3} />
    </mesh>
  );
}

function Turntable({ w, h, d, selected }) {
  const grain = useWoodTexture();
  const baseY = -h / 2 + 0.01 + 0.015;
  const discY = baseY + 0.027;
  return (
    <group>
      <Feet {...{ w, h, d }} />
      <RoundedBox args={[w, 0.03, d]} radius={0.004} position={[0, baseY, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#9a6c45" map={grain} roughness={0.4} emissive={selected ? '#4e391a' : '#000'} emissiveIntensity={0.2} />
      </RoundedBox>
      <mesh position={[-0.044, discY - 0.006, 0.005]} castShadow>
        <cylinderGeometry args={[0.145, 0.145, 0.016, 64]} />
        <meshStandardMaterial color="#383b3b" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[-0.044, discY + 0.003, 0.005]}>
        <cylinderGeometry args={[0.142, 0.142, 0.002, 80]} />
        <meshStandardMaterial color="#101316" metalness={0.28} roughness={0.3} />
      </mesh>
      {[0.055, 0.066, 0.081, 0.098, 0.113, 0.13, 0.138].map(radius => (
        <mesh key={radius} position={[-0.044, discY + 0.0043, 0.005]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius, radius + 0.0004, 80]} />
          <meshStandardMaterial color="#464a4a" roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[-0.044, discY + 0.0045, 0.005]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.04, 48]} /><meshStandardMaterial color="#bc8d4c" roughness={0.85} />
      </mesh>
      <mesh position={[-0.044, discY + 0.009, 0.005]}>
        <cylinderGeometry args={[0.002, 0.002, 0.012, 12]} /><meshStandardMaterial color="#c6c5bd" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0.155, discY + 0.004, -0.095]} castShadow>
        <cylinderGeometry args={[0.018, 0.019, 0.033, 24]} /><meshStandardMaterial color="#202527" metalness={0.7} roughness={0.25} />
      </mesh>
      <group position={[0.15, discY + 0.024, -0.092]} rotation={[0, -0.23, 0]}>
        <mesh position={[0, 0, 0.087]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.003, 0.003, 0.2, 16]} /><meshStandardMaterial color="#b0b4b2" metalness={0.85} roughness={0.24} />
        </mesh>
        <mesh position={[0, -0.004, 0.183]} castShadow><boxGeometry args={[0.016, 0.011, 0.024]} /><meshStandardMaterial color="#171b1c" /></mesh>
      </group>
      {/* Transparent closed dust cover, within the documented outer envelope. */}
      <mesh position={[0, h / 2 - 0.003, 0]}>
        <boxGeometry args={[w - 0.008, 0.002, d - 0.008]} />
        <meshPhysicalMaterial color="#d9e4e4" transparent opacity={0.1} metalness={0.1} roughness={0.12} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Electronics({ equipmentId, w, h, d, selected }) {
  const faceHeight = h - 0.01;
  const map = useFaceTexture(equipmentId, w / faceHeight);
  const silver = equipmentId === 'a90' || equipmentId === 'phono' || equipmentId === 'dac_fiio';
  const color = silver ? '#a5a8a7' : equipmentId === 'arcam' ? '#363b3e' : '#202426';
  return (
    <group>
      <Feet {...{ w, h, d }} />
      <RoundedBox args={[w, faceHeight, d]} radius={0.004} smoothness={3} position={[0, 0.005, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} metalness={silver ? 0.65 : 0.35} roughness={0.4} emissive={selected ? '#5b4421' : '#000'} emissiveIntensity={0.24} />
      </RoundedBox>
      <mesh position={[0, 0.005, d / 2 + 0.0005]}>
        <planeGeometry args={[w - 0.007, faceHeight - 0.005]} />
        <meshStandardMaterial map={map} metalness={silver ? 0.35 : 0.1} roughness={0.48} emissive="#ffffff" emissiveMap={map} emissiveIntensity={0.1} />
      </mesh>
      {equipmentId === 'arcam' && <><Knob position={[-w * 0.35, 0.002, d / 2 + 0.005]} radius={0.022} /><Knob position={[w * 0.41, 0.002, d / 2 + 0.005]} radius={0.01} /></>}
      {equipmentId === 'a90' && <><Knob position={[w * 0.37, 0.004, d / 2 + 0.005]} radius={0.014} /><Knob position={[-w * 0.015, 0.003, d / 2 + 0.003]} radius={0.009} color="#161a1c" /></>}
      {equipmentId === 'dac_fiio' && <Knob position={[-w * 0.37, 0.002, d / 2 + 0.003]} radius={0.004} />}
      {equipmentId === 'arcam' && Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[0, h / 2 + 0.0002, -d * 0.28 + i * d * 0.045]}>
          <boxGeometry args={[w * 0.62, 0.0005, 0.0018]} /><meshStandardMaterial color="#111516" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function RusichA2({ w, h, d, selected }) {
  const topMark = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = Math.max(160, Math.round(canvas.width * d / w));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#c9c9c6'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#181a1a'; ctx.font = 'italic 700 62px Georgia'; ctx.fillText('Rusich', 36, 76);
    ctx.font = '600 34px sans-serif'; ctx.fillText('ALEPH PASS A2', 235, 74);
    ctx.textAlign = 'center'; ctx.font = '600 25px sans-serif'; ctx.fillText('POWER AMPLIFIER · CLASS A', canvas.width / 2, 119);
    ctx.textAlign = 'right'; ctx.fillText('DUAL MONO', canvas.width - 28, 119);
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.anisotropy = 4;
    return texture;
  }, [w, d]);
  useEffect(() => () => topMark.dispose(), [topMark]);
  return <group>
    <Feet w={w} h={h} d={d} />
    <RoundedBox args={[w - 0.002, h - 0.006, d - 0.002]} radius={0.006} smoothness={3} position={[0, 0.002, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#bfc1bf" metalness={0.48} roughness={0.45} emissive={selected ? '#5b4421' : '#000'} emissiveIntensity={0.18} />
    </RoundedBox>
    <mesh position={[0, h / 2 + 0.0007, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w - 0.008, d - 0.008]} />
      <meshStandardMaterial map={topMark} metalness={0.25} roughness={0.5} />
    </mesh>
    {/* Top indicators and power control are placed from the owner drawing. */}
    {[-1, 1].map(side => <group key={side} position={[side * w * 0.093, h / 2 + 0.0015, d * 0.1]}>
      <mesh><cylinderGeometry args={[0.003, 0.003, 0.002, 20]} /><meshStandardMaterial color="#262a29" /></mesh>
      <mesh position={[0, 0.0015, 0]}><cylinderGeometry args={[0.0017, 0.0017, 0.0012, 16]} /><meshStandardMaterial color="#cb5b4d" emissive="#7d271e" emissiveIntensity={0.35} /></mesh>
    </group>)}
    <mesh position={[0, h / 2 + 0.0015, d * 0.1]}><cylinderGeometry args={[0.008, 0.008, 0.002, 32]} /><meshStandardMaterial color="#aaa9a5" metalness={0.55} roughness={0.35} /></mesh>
    {/* The supplied sheet has no front elevation, so that face stays unlabelled. */}
    <mesh position={[0, 0.002, d / 2 + 0.0003]}>
      <planeGeometry args={[w - 0.012, h - 0.012]} />
      <meshStandardMaterial color="#202222" roughness={0.48} metalness={0.18} />
    </mesh>
  </group>;
}

export default function EquipmentModel(props) {
  if (props.equipmentId === 'rusich_a2') return <RusichA2 {...props} />;
  return props.equipmentId === 'turntable' ? <Turntable {...props} /> : <Electronics {...props} />;
}
