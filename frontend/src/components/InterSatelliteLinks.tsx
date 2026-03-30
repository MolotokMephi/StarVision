/**
 * InterSatelliteLinks.tsx
 * Визуализация межспутниковых линий связи (ISL).
 * - Оптимизация: переиспользование геометрий вместо пересоздания каждый кадр
 * - Тултип с расстоянием при наведении на линию (Raycaster + Html)
 * - Поддержка орбитальных плоскостей для виртуальных орбит
 */

import { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  BufferGeometry, LineBasicMaterial, Float32BufferAttribute,
  Group, Line, Vector2, Vector3, Raycaster,
} from 'three';
import { twoline2satrec, propagate } from 'satellite.js';
import { getSimTime } from '../simClock';
import { useStore } from '../hooks/useStore';
import type { TLEData } from '../types';

const EARTH_RADIUS = 6371.0;
const MU = 398600.4418;
const SCALE = 1 / EARTH_RADIUS;

// ── Утилита: виртуальные круговые орбиты с поддержкой плоскостей ────
function computeVirtualPositions(
  count: number,
  altitudeKm: number,
  simTimeMs: number,
  planes: number
): Array<{ x: number; y: number; z: number }> {
  const a = EARTH_RADIUS + altitudeKm;
  const n = Math.sqrt(MU / (a * a * a));
  const incl = (55 * Math.PI) / 180;
  const t = simTimeMs / 1000;
  const P = Math.max(1, Math.min(planes, count));
  const satsPerPlane = Math.ceil(count / P);

  return Array.from({ length: count }, (_, i) => {
    const planeIdx = i % P;
    const satInPlane = Math.floor(i / P);
    const raan = (planeIdx / P) * 2 * Math.PI;
    const phase = (satInPlane / satsPerPlane) * 2 * Math.PI;
    const M = n * t + phase;
    const xOrb = a * Math.cos(M);
    const yOrb = a * Math.sin(M);
    const xInc = xOrb;
    const yInc = yOrb * Math.cos(incl);
    const zInc = yOrb * Math.sin(incl);
    const cosR = Math.cos(raan);
    const sinR = Math.sin(raan);
    return {
      x: xInc * cosR - yInc * sinR,
      y: xInc * sinR + yInc * cosR,
      z: zInc,
    };
  });
}

// ── LOS-проверка: пересекает ли отрезок AB поверхность Земли ────────
function hasLineOfSight(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const lenSq = dx * dx + dy * dy + dz * dz;
  if (lenSq === 0) return true;
  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy + az * dz) / lenSq));
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  const closestZ = az + t * dz;
  const distSq = closestX * closestX + closestY * closestY + closestZ * closestZ;
  return distSq >= EARTH_RADIUS * EARTH_RADIUS;
}

// ── Переиспользуемые материалы ──────────────────────────────────────
const GREEN_MAT = new LineBasicMaterial({ color: '#00ff88', transparent: true, opacity: 0.85 });
const RED_MAT = new LineBasicMaterial({ color: '#ff3344', transparent: true, opacity: 0.4 });
const HOVER_MAT = new LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 1.0, linewidth: 2 });

// ── Пул линий для переиспользования ─────────────────────────────────
const MAX_LINES = 200;

function createLinePool(): Line[] {
  const pool: Line[] = [];
  for (let i = 0; i < MAX_LINES; i++) {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(6), 3));
    const line = new Line(geo, GREEN_MAT);
    line.visible = false;
    line.frustumCulled = false;
    pool.push(line);
  }
  return pool;
}

// ── Основной компонент ──────────────────────────────────────────────
interface InterSatelliteLinksProps {
  tleData: TLEData[];
  satelliteConstellations: Record<number, string>;
}

export function InterSatelliteLinks({ tleData, satelliteConstellations }: InterSatelliteLinksProps) {
  const {
    showLinks,
    commRangeKm,
    satelliteCount,
    activeConstellations,
    orbitAltitudeKm,
    orbitalPlanes,
    setActiveLinksCount,
  } = useStore();

  const groupRef = useRef<Group>(null);
  const prevLinksRef = useRef(0);
  const linePoolRef = useRef<Line[]>([]);
  const poolInitializedRef = useRef(false);

  // Tooltip state
  const [tooltip, setTooltip] = useState<{ position: Vector3; distance: number } | null>(null);
  const hoveredIdxRef = useRef(-1);
  const linkMetaRef = useRef<Array<{ mx: number; my: number; mz: number; distance: number }>>([]);

  // Raycaster
  const raycasterRef = useRef(new Raycaster());
  const pointerRef = useRef(new Vector2(-999, -999));
  const { camera, gl } = useThree();
  const frameCountRef = useRef(0);

  // Инициализация пула линий
  useEffect(() => {
    if (!groupRef.current || poolInitializedRef.current) return;
    const pool = createLinePool();
    pool.forEach((line) => groupRef.current!.add(line));
    linePoolRef.current = pool;
    poolInitializedRef.current = true;
  }, []);

  // Трекинг указателя мыши
  useEffect(() => {
    const el = gl.domElement;
    const handleMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      pointerRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    const handleLeave = () => {
      pointerRef.current.set(-999, -999);
    };
    el.addEventListener('pointermove', handleMove);
    el.addEventListener('pointerleave', handleLeave);
    return () => {
      el.removeEventListener('pointermove', handleMove);
      el.removeEventListener('pointerleave', handleLeave);
    };
  }, [gl]);

  // Предварительно создаём satrec-объекты из TLE
  const satrecsRef = useRef<Array<{
    norad_id: number;
    name: string;
    constellation: string;
    satrec: ReturnType<typeof twoline2satrec>;
  }>>([]);

  useEffect(() => {
    if (tleData.length > 0) {
      satrecsRef.current = tleData.map((tle) => ({
        norad_id: tle.norad_id,
        name: tle.name,
        constellation: tle.constellation,
        satrec: twoline2satrec(tle.tle_line1, tle.tle_line2),
      }));
    }
  }, [tleData]);

  useFrame(() => {
    if (!groupRef.current || linePoolRef.current.length === 0) return;

    const pool = linePoolRef.current;
    frameCountRef.current++;
    const simTime = getSimTime();

    // Скрываем все линии
    for (let i = 0; i < pool.length; i++) {
      pool[i].visible = false;
    }

    if (!showLinks) {
      if (prevLinksRef.current !== 0) {
        prevLinksRef.current = 0;
        setActiveLinksCount(0);
      }
      linkMetaRef.current = [];
      if (hoveredIdxRef.current !== -1) {
        hoveredIdxRef.current = -1;
        setTooltip(null);
      }
      return;
    }

    // Получаем текущие позиции
    let eciPositions: Array<{ norad_id: number; x: number; y: number; z: number }> = [];

    if (orbitAltitudeKm > 0) {
      const virt = computeVirtualPositions(satelliteCount, orbitAltitudeKm, simTime, orbitalPlanes);
      eciPositions = virt.map((p, i) => ({ norad_id: 90000 + i, ...p }));
    } else if (satrecsRef.current.length > 0) {
      const now = new Date(simTime);
      const filtered = satrecsRef.current.filter(({ norad_id, constellation }) => {
        const c = constellation || satelliteConstellations[norad_id];
        return activeConstellations.includes(c);
      });

      const step = Math.max(1, filtered.length / satelliteCount);
      const selected = Array.from(
        { length: Math.min(satelliteCount, filtered.length) },
        (_, i) => filtered[Math.floor(i * step)]
      );

      for (const { norad_id, satrec } of selected) {
        const pv = propagate(satrec, now);
        if (!pv.position || typeof pv.position === 'boolean') continue;
        const pos = pv.position as { x: number; y: number; z: number };
        eciPositions.push({ norad_id, x: pos.x, y: pos.y, z: pos.z });
      }
    }

    if (eciPositions.length < 2) {
      linkMetaRef.current = [];
      return;
    }

    let activeCount = 0;
    let lineIdx = 0;
    const meta: Array<{ mx: number; my: number; mz: number; distance: number }> = [];

    for (let i = 0; i < eciPositions.length; i++) {
      for (let j = i + 1; j < eciPositions.length; j++) {
        const a = eciPositions[i];
        const b = eciPositions[j];

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const los = hasLineOfSight(a.x, a.y, a.z, b.x, b.y, b.z);
        const connected = dist <= commRangeKm && los;
        const nearEdge = !connected && dist <= commRangeKm * 1.5 && los;

        if ((connected || nearEdge) && lineIdx < pool.length) {
          const ax3 = a.x * SCALE;
          const ay3 = a.z * SCALE;
          const az3 = -a.y * SCALE;
          const bx3 = b.x * SCALE;
          const by3 = b.z * SCALE;
          const bz3 = -b.y * SCALE;

          const line = pool[lineIdx];
          const posAttr = line.geometry.attributes.position as Float32BufferAttribute;
          const arr = posAttr.array as Float32Array;
          arr[0] = ax3; arr[1] = ay3; arr[2] = az3;
          arr[3] = bx3; arr[4] = by3; arr[5] = bz3;
          posAttr.needsUpdate = true;
          line.geometry.computeBoundingSphere();

          line.material = connected ? GREEN_MAT : RED_MAT;
          line.visible = true;
          line.userData.linkIndex = lineIdx;
          line.userData.distance = dist;

          if (connected) activeCount++;

          meta.push({
            mx: (ax3 + bx3) / 2,
            my: (ay3 + by3) / 2,
            mz: (az3 + bz3) / 2,
            distance: dist,
          });

          lineIdx++;
        } else if (connected) {
          activeCount++;
        }
      }
    }

    linkMetaRef.current = meta;

    if (prevLinksRef.current !== activeCount) {
      prevLinksRef.current = activeCount;
      setActiveLinksCount(activeCount);
    }

    // Raycasting для тултипа (каждый 3-й кадр для производительности)
    if (frameCountRef.current % 3 === 0) {
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      raycasterRef.current.params.Line = { threshold: 0.03 };

      const visibleLines = pool.filter((l) => l.visible);
      const intersects = raycasterRef.current.intersectObjects(visibleLines, false);

      let newIdx = -1;
      if (intersects.length > 0) {
        const hit = intersects[0];
        const idx = hit.object.userData?.linkIndex;
        if (idx !== undefined && meta[idx]) {
          newIdx = idx;
          // Подсветка линии
          (hit.object as Line).material = HOVER_MAT;
        }
      }

      if (newIdx !== hoveredIdxRef.current) {
        hoveredIdxRef.current = newIdx;
        if (newIdx >= 0 && meta[newIdx]) {
          const m = meta[newIdx];
          setTooltip({ position: new Vector3(m.mx, m.my, m.mz), distance: m.distance });
        } else {
          setTooltip(null);
        }
      }
    }
  });

  return (
    <>
      <group ref={groupRef} />
      {tooltip && (
        <Html
          position={[tooltip.position.x, tooltip.position.y, tooltip.position.z]}
          center
          style={{ pointerEvents: 'none' }}
          zIndexRange={[100, 0]}
        >
          <div
            style={{
              background: 'rgba(8, 16, 40, 0.85)',
              border: '1px solid rgba(100, 170, 255, 0.4)',
              borderRadius: '8px',
              padding: '6px 10px',
              color: '#d9ecff',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4), 0 0 8px rgba(80,150,255,0.15)',
            }}
          >
            <span style={{ color: '#00ff88', marginRight: '4px' }}>●</span>
            {tooltip.distance.toFixed(1)} км
          </div>
        </Html>
      )}
    </>
  );
}
