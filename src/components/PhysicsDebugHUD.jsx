import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

// Диагностический HUD: печатает в window.__physicsDebug текущую world-Y
// каждого физического тела устройства раз в кадр, чтобы можно было
// проверить headless-скриптом, реально ли Rapier двигает тела и оседают
// ли они (Y должен монотонно уменьшаться и затем стабилизироваться).
export default function PhysicsDebugHUD({ bodyRefs, cableCount }) {
  const frame = useRef(0);
  useFrame(() => {
    frame.current += 1;
    if (frame.current % 15 !== 0) return; // не на каждом кадре — не забивать
    const snap = {};
    Object.entries(bodyRefs.current).forEach(([id, ref]) => {
      if (ref?.current) {
        const t = ref.current.translation();
        snap[id] = [Number(t.x.toFixed(4)), Number(t.y.toFixed(4)), Number(t.z.toFixed(4))];
      }
    });
    if (typeof window !== 'undefined') {
      window.__physicsDebug = snap;
      window.__cableCount = cableCount;
    }
  });
  return null;
}
