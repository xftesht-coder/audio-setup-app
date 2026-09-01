import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RigidBody, CapsuleCollider, useSphericalJoint } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getCableStyle } from '../data/cableStyles';

const SEGMENTS = 6;

// Один физический сегмент верёвки — маленькая динамическая капсула.
// Соседние сегменты соединены useSphericalJoint (шаровой шарнир,
// свободное вращение, фиксированное расстояние между анкорами) — это
// и есть настоящая цепная провисающая линия под гравитацией, а не
// нарисованная кривая с одной произвольной точкой прогиба.
const RopeSegment = React.forwardRef(function RopeSegment({ position, radius, length }, ref) {
  return (
    <RigidBody
      ref={ref}
      position={position}
      colliders={false}
      mass={0.015}
      linearDamping={0.85}
      angularDamping={0.9}
      ccd
    >
      <CapsuleCollider args={[length / 2, radius]} />
      <mesh castShadow>
        <capsuleGeometry args={[radius, length, 4, 8]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
      </mesh>
    </RigidBody>
  );
});

function JointBetween({ a, b, anchorA, anchorB }) {
  useSphericalJoint(a, b, [anchorA, anchorB]);
  return null;
}

// Один физический кабель между реальными портами двух устройств.
// fromBody/toBody — RigidBody API-рефы устройств (из EquipmentBox).
// fromWorld/toWorld — мировые координаты порта в момент монтажа (для
// начальной раскладки сегментов). fromLocal/toLocal — те же порты, но
// в локальных координатах тела (для joint-анкора) — берутся из
// portGeometry.getPortLocalAnchor, а не из центра бокса.
//
// ДВУХФАЗНЫЙ монтаж джойнтов: на первом коммите рефы RopeSegment ещё
// null (React крепит ref ПОСЛЕ коммита поддерева). useSphericalJoint
// вызванный с a/b, чей .current===null, бросает исключение внутри
// r3f/rapier — Canvas глушит его через свой error boundary без единой
// строчки в консоли, откатывая ВЕСЬ <group> целиком. Именно так все 36
// капсул стабильно не крепили рефы: не потому что не рождались, а
// потому что JointBetween рядом с ними в том же рендере валил всё
// поддерево до commit. Решение — рендерить RopeSegment'ы, ждать кадр
// (эффект после коммита, когда рефы гарантированно прикреплены), и
// только тогда добавлять JointBetween в отдельном ре-рендере.
export default function PhysicalCable({ cable, fromBody, toBody, fromWorld, toLocal, toWorld, fromLocal, xray }) {
  const segRefs = useRef(Array.from({ length: SEGMENTS }, () => React.createRef()));
  const [ready, setReady] = useState(false);
  const [segmentsMounted, setSegmentsMounted] = useState(false);
  const style = getCableStyle(cable.type);
  const radius = Math.max(style.width, 2) * 0.0015;
  const segLength = Math.max(cable.length / SEGMENTS, 0.02);

  const initialPositions = useMemo(() => {
    if (!fromWorld || !toWorld) return [];
    const from = new THREE.Vector3(...fromWorld);
    const to = new THREE.Vector3(...toWorld);
    return Array.from({ length: SEGMENTS }, (_, i) => {
      const t = (i + 0.5) / SEGMENTS;
      return from.clone().lerp(to, t).toArray();
    });
  }, [fromWorld, toWorld]);

  // .current на реф-объекте меняется МУТАЦИЕЙ, минуя React state — сам
  // по себе он НЕ триггерит ре-рендер PhysicalCable. Если этот компонент
  // рендерится только один раз (родитель CabinetView3D тоже не всегда
  // ре-рендерится после того как rapier крепит рефы), fromBody.current
  // навсегда остаётся тем, что было на момент единственного рендера —
  // то есть null, даже когда тело физически давно существует. useFrame
  // (вызывается r3f на КАЖДЫЙ кадр рендер-цикла Canvas, независимо от
  // React state) — надёжный способ дождаться готовности рефов и явно
  // triggернуть один React re-render через setState, когда они готовы.
  useFrame(() => {
    if (!ready && fromBody?.current && toBody?.current) {
      setReady(true);
    }
  });

  const canRender = !xray && ready && initialPositions.length > 0;

  useEffect(() => {
    if (canRender) setSegmentsMounted(true);
  }, [canRender]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__cableSegmentRefs = window.__cableSegmentRefs || {};
      window.__cableSegmentRefs[cable.id] = segRefs.current;
      return () => { delete window.__cableSegmentRefs[cable.id]; };
    }
  }, [cable.id]);

  if (!canRender) return null;

  return (
    <group>
      {initialPositions.map((pos, i) => (
        <RopeSegment key={i} ref={segRefs.current[i]} position={pos} radius={radius} length={segLength} />
      ))}
      {segmentsMounted && (
        <>
          <JointBetween a={fromBody} b={segRefs.current[0]} anchorA={fromLocal} anchorB={[0, -segLength / 2, 0]} />
          {segRefs.current.slice(0, -1).map((_, i) => (
            <JointBetween
              key={i}
              a={segRefs.current[i]}
              b={segRefs.current[i + 1]}
              anchorA={[0, segLength / 2, 0]}
              anchorB={[0, -segLength / 2, 0]}
            />
          ))}
          <JointBetween
            a={segRefs.current[SEGMENTS - 1]}
            b={toBody}
            anchorA={[0, segLength / 2, 0]}
            anchorB={toLocal}
          />
        </>
      )}
    </group>
  );
}
