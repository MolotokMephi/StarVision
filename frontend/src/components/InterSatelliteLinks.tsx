/**
 * InterSatelliteLinks.tsx
 * Визуализация межспутниковых линий связи (ISL).
 * На каждом кадре вычисляет расстояния между парами активных спутников,
 * рисует зелёные линии для пар в пределах commRangeKm и красный пунктир — для остальных.
 */

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, LineBasicMaterial, Float32BufferAttribute, Group, Line } from 'three';
import { twoline2satrec, propagate } from 'satellite.js';
import { getSimTime } from '../simClock';
import { useStore } from '../hooks/useStore';
import type { TLEData } from '../types';

const EARTH_RADIUS = 6371.0;
const MU = 398600.4418;
const SCALE = 1 / EARTH_RADIUS;

// ── Утилита: генерация виртуальных круговых орбит ─────────────────────
function computeVirtualPositions(
  count: number,
  altitudeKm: number,
  simTimeMs: number
): Array<{ x: number; y: number; z: number }> {
  const a = EARTH_RADIUS + altitudeKm;
  const n = Math.sqrt(MU / (a * a * a)); // рад/с
  const incl = (55 * Math.PI) / 180;
  const t = simTimeMs / 1000;

  return Array.from({ length: count }, (_, i) => {
    const raan = (i / count) * 2 * Math.PI;
    const phase = (i / count) * 2 * Math.PI;
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

// ── LOS-проверка: пересекает ли отрезок AB поверхность Земли ─────────
function hasLineOfSight(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number
): boolean {
  // Проверяем минимальное расстояние от центра Земли до прямой AB
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

// ── Вспомогательная: обновить буфер геометрии ─────────────────────────
function updateLineGeometry(
  geo: BufferGeometry,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number
) {
  const positions = new Float32Array([ax, ay, az, bx, by, bz]);
  if (geo.attributes.position) {
    const attr = geo.attributes.position as { array: Float32Array; needsUpdate: boolean };
    attr.array.set(positions);
    attr.needsUpdate = true;
  } else {
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  }
}

// ── Основной компонент ────────────────────────────────────────────────
interface InterSatelliteLinksProps {
  tleData: TLEData[];
  satelliteConstellations: Record<number, string>;
}

const GREEN_MAT = new LineBasicMaterial({ color: '#00ff88', transparent: true, opacity: 0.85 });
const RED_MAT = new LineBasicMaterial({ color: '#ff3344', transparent: true, opacity: 0.4 });

export function InterSatelliteLinks({ tleData, satelliteConstellations }: InterSatelliteLinksProps) {
  const {
    showLinks,
    commRangeKm,
    satelliteCount,
    activeConstellations,
    orbitAltitudeKm,
    setActiveLinksCount,
  } = useStore();

  const groupRef = useRef<Group>(null);
  const prevLinksRef = useRef(0);

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
    if (!groupRef.current) return;

    const simTime = getSimTime();

    // Очищаем предыдущие линии
    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0]);
    }

    if (!showLinks) {
      if (prevLinksRef.current !== 0) {
        prevLinksRef.current = 0;
        setActiveLinksCount(0);
      }
      return;
    }

    // Получаем текущие позиции
    let eciPositions: Array<{ norad_id: number; x: number; y: number; z: number }> = [];

    if (orbitAltitudeKm > 0) {
      // Режим виртуальных круговых орбит
      const virt = computeVirtualPositions(satelliteCount, orbitAltitudeKm, simTime);
      eciPositions = virt.map((p, i) => ({ norad_id: 90000 + i, ...p }));
    } else if (satrecsRef.current.length > 0) {
      // Клиентская SGP4-пропагация
      const now = new Date(simTime);
      const filtered = satrecsRef.current.filter(({ norad_id, constellation }) => {
        const c = constellation || satelliteConstellations[norad_id];
        return activeConstellations.includes(c);
      });

      // Равномерный выбор N спутников
      const step = Math.max(1, filtered.length / satelliteCount);
      const selected = Array.from({ length: Math.min(satelliteCount, filtered.length) }, (_, i) =>
        filtered[Math.floor(i * step)]
      );

      for (const { norad_id, satrec } of selected) {
        const pv = propagate(satrec, now);
        if (!pv.position || typeof pv.position === 'boolean') continue;
        const pos = pv.position as { x: number; y: number; z: number };
        eciPositions.push({ norad_id, x: pos.x, y: pos.y, z: pos.z });
      }
    }

    if (eciPositions.length < 2) return;

    let activeCount = 0;

    // Перебираем все пары
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

        // Three.js: Y-up, ECI→Scene: (x, z, -y)
        const ax3 = a.x * SCALE;
        const ay3 = a.z * SCALE;
        const az3 = -a.y * SCALE;
        const bx3 = b.x * SCALE;
        const by3 = b.z * SCALE;
        const bz3 = -b.y * SCALE;

        if (connected) {
          activeCount++;
          const geo = new BufferGeometry();
          updateLineGeometry(geo, ax3, ay3, az3, bx3, by3, bz3);
          const line = new Line(geo, GREEN_MAT);
          groupRef.current.add(line);
        }
        // Рисуем красный пунктир только для "почти в зоне" (dist <= commRangeKm * 1.5)
        else if (dist <= commRangeKm * 1.5 && los) {
          const geo = new BufferGeometry();
          updateLineGeometry(geo, ax3, ay3, az3, bx3, by3, bz3);
          const line = new Line(geo, RED_MAT);
          groupRef.current.add(line);
        }
      }
    }

    if (prevLinksRef.current !== activeCount) {
      prevLinksRef.current = activeCount;
      setActiveLinksCount(activeCount);
    }
  });

  return <group ref={groupRef} />;
}
