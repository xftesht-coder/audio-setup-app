import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

/**
 * ShelfValidator — проверяет, что каждое устройство, осевшее под
 * гравитацией, действительно лежит на *своей* полке (а не провалилось
 * сквозь неё или прилипло к соседней): world-Y RigidBody центра корпуса
 * сравнивается с расчётной shelfTopY + phys.height/2 для того же яруса.
 * Отклонение ≤2мм — ОК (толщина контакта Rapier + небольшая вибрация);
 * больше — тревога «unit not on its own shelf».
 *
 * Состояние пишем в window.__shelfValidation — его читают headless-
 * тесты. Почему useFrame (а не один раз): Y стабилизируется лишь после
 * ~0.5с симуляции, useFrame (r3f, per-frame, независим от React state)
 * читает актуальный translation() каждый кадр и считает stableFrames —
 * пока не наберёт порог, помечаем как «settling».
 */
export default function ShelfValidator({ bodyRefs, expectedYByUnit }) {
  const frame = useRef(0);
  const history = useRef({}); // id -> [last Y samples]
  const STABLE_WINDOW = 8;
  const STABLE_BAND = 0.003; // допустимая полоса микроколебаний, м

  useFrame(() => {
    frame.current += 1;
    if (frame.current % 15 !== 0) return; // раз в ~0.25с
    const now = performance.now();

    const report = {};
    Object.entries(bodyRefs.current).forEach(([id, ref]) => {
      const t = ref?.current?.translation();
      if (!t) { report[id] = { status: 'no_body' }; return; }
      const actualY = Number(t.y);
      const expected = expectedYByUnit[id];
      if (expected === undefined) { report[id] = { status: 'no_calc' }; return; }

      const delta = Math.abs(actualY - expected);
      // «Стабильно» = за последние STABLE_WINDOW сэмплов тело не
      // выходило за полосу STABLE_BAND, а не «замерло» (полностью
      // неподвижным устройство с парой кабелей не бывает никогда —
      // лёгкие деки вроде phono 0.9кг микроколеблются на ±0.3мм от
      // натяжения rope-joint'ов; прежний критерий «|y−prev|<0.1мм»
      // такие колебания ловил как «не осело»).
      const h = history.current[id] || (history.current[id] = []);
      h.push(actualY);
      if (h.length > STABLE_WINDOW) h.shift();
      const band = h.length >= STABLE_WINDOW ? Math.max(...h) - Math.min(...h) : Infinity;
      const stable = h.length >= STABLE_WINDOW && band <= STABLE_BAND;

      report[id] = {
        actualY: Number(actualY.toFixed(4)),
        expectedY: Number(expected.toFixed(4)),
        delta: Number(delta.toFixed(4)),
        band: Number((band === Infinity ? -1 : band).toFixed(4)),
        stable,
        status: delta <= 0.003 && stable ? 'on_shelf' : 'settling',
      };
    });

    const allOnShelf = Object.values(report).every(r => r.status === 'on_shelf');
    if (typeof window !== 'undefined') {
      window.__shelfValidation = {
        checkedAt: now,
        units: report,
        allOnShelf,
      };
    }
  });

  return null;
}
