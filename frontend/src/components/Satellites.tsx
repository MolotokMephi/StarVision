/**
 * Satellites.tsx
 * - Клиентская SGP4-пропагация через satellite.js (покадровая анимация)
 * - При orbitAltitudeKm > 0: виртуальные круговые орбиты с равномерным распределением
 * - Равномерный выбор N спутников из каталога (не просто первые N)
 * - 2 типа процедурных 3D-моделей КА: 1U CubeSat и 3U CubeSat с солнечными панелями
 * - Источники моделей: процедурные Three.js (BoxGeometry + PlaneGeometry)
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Vector3, Group } from 'three';
import { twoline2satrec, propagate } from 'satellite.js';
import { getSimTime, advanceSimTime } from '../simClock';
import type { SatellitePosition, OrbitPoint, TLEData } from '../types';

const EARTH_RADIUS = 6371.0;
const MU = 398600.4418;
const SCALE = 1 / EARTH_RADIUS;

// Цвета группировок
const CONSTELLATION_COLORS: Record<string, string> = {
  'Сфера': '#3389ff',
  'Образовательные': '#33ffaa',
  'Гонец': '#ff9933',
  'ДЗЗ': '#ff3366',
  'Научные': '#aa33ff',
  'МФТИ': '#33ffdd',
  'МГТУ им. Баумана': '#ffdd33',
};

// Какой тип модели для каждой группировки (0 = 1U, 1 = 3U)
const CONSTELLATION_MODEL_TYPE: Record<string, number> = {
  'Сфера': 1,
  'Образовательные': 0,
  'Гонец': 1,
  'ДЗЗ': 1,
  'Научные': 0,
  'МФТИ': 0,
  'МГТУ им. Баумана': 0,
};

function getColor(constellation: string): string {
  return CONSTELLATION_COLORS[constellation] || '#8ec9ff';
}

function getModelType(constellation: string): number {
  return CONSTELLATION_MODEL_TYPE[constellation] ?? 0;
}

// ── Равномерный выбор N элементов из массива ─────────────────────
function selectUniformly<T>(arr: T[], count: number): T[] {
  if (count >= arr.length) return arr;
  const step = arr.length / count;
  return Array.from({ length: count }, (_, i) => arr[Math.floor(i * step)]);
}

// ── Виртуальные круговые орбиты ────────────────────────────────────
function computeCircularOrbitECI(
  index: number,
  total: number,
  altitudeKm: number,
  simTimeSec: number,
  planes: number = 1
): { x: number; y: number; z: number } {
  const a = EARTH_RADIUS + altitudeKm;
  const n = Math.sqrt(MU / (a * a * a)); // рад/с
  const incl = (55 * Math.PI) / 180;
  const P = Math.max(1, Math.min(planes, total));
  const satsPerPlane = Math.ceil(total / P);
  const planeIdx = index % P;
  const satInPlane = Math.floor(index / P);
  const raan = (planeIdx / P) * 2 * Math.PI;
  // Walker-δ T/P/F: inter-plane phase offset for uniform coverage
  const F = P > 1 ? Math.max(1, Math.floor(P / 2)) : 0;
  const phase = (satInPlane / satsPerPlane) * 2 * Math.PI
    + (F * planeIdx / P) * (2 * Math.PI / satsPerPlane);
  const M = n * simTimeSec + phase;

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
}

// ── 3D-модель: 1U CubeSat (10×10×10 см, 2 маленькие панели) ────────
// Источник: процедурная модель Three.js (BoxGeometry + PlaneGeometry)
function CubeSat1U({ color, emissiveIntensity }: { color: string; emissiveIntensity: number }) {
  const size = 0.012;
  const panelW = 0.022;
  const panelH = 0.008;
  return (
    <group>
      {/* Корпус */}
      <mesh>
        <boxGeometry args={[size, size, size]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          metalness={0.85}
          roughness={0.25}
        />
      </mesh>
      {/* Солнечные панели (лево/право) */}
      <mesh position={[panelW / 2 + size / 2, 0, 0]}>
        <planeGeometry args={[panelW, panelH]} />
        <meshStandardMaterial
          color="#1a2a4a"
          emissive="#1133aa"
          emissiveIntensity={0.4}
          metalness={0.3}
          roughness={0.7}
          side={2}
        />
      </mesh>
      <mesh position={[-(panelW / 2 + size / 2), 0, 0]}>
        <planeGeometry args={[panelW, panelH]} />
        <meshStandardMaterial
          color="#1a2a4a"
          emissive="#1133aa"
          emissiveIntensity={0.4}
          metalness={0.3}
          roughness={0.7}
          side={2}
        />
      </mesh>
    </group>
  );
}

// ── 3D-модель: 3U CubeSat (10×10×30 см, 4 крупные панели) ──────────
// Источник: процедурная модель Three.js (BoxGeometry + PlaneGeometry)
function CubeSat3U({ color, emissiveIntensity }: { color: string; emissiveIntensity: number }) {
  const w = 0.010;
  const h = 0.030;
  const d = 0.010;
  const panelW = 0.028;
  const panelH = 0.024;
  return (
    <group>
      {/* Корпус 3U */}
      <mesh>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          metalness={0.85}
          roughness={0.2}
        />
      </mesh>
      {/* Солнечные панели (4 штуки: лево/право × два яруса) */}
      {[-1, 1].map((side) =>
        [-0.008, 0.008].map((offset, j) => (
          <mesh
            key={`${side}-${j}`}
            position={[side * (panelW / 2 + w / 2), offset * 2, 0]}
          >
            <planeGeometry args={[panelW, panelH]} />
            <meshStandardMaterial
              color="#0d1a3a"
              emissive="#0a2299"
              emissiveIntensity={0.45}
              metalness={0.25}
              roughness={0.65}
              side={2}
            />
          </mesh>
        ))
      )}
    </group>
  );
}

// ── Одиночный спутник ────────────────────────────────────────────────
interface SatMarkerProps {
  name: string;
  constellation: string;
  isSelected: boolean;
  isHighlighted: boolean;
  showLabel: boolean;
  onClick: () => void;
  // Если используется клиентская SGP4 — позиция обновляется в useFrame через groupRef
  initPos: Vector3;
  // Для клиентской SGP4: ссылка на функцию получения текущей ECI-позиции
  getECI?: () => { x: number; y: number; z: number } | null;
}

function SatMarker({
  name,
  constellation,
  isSelected,
  isHighlighted,
  showLabel,
  onClick,
  initPos,
  getECI,
}: SatMarkerProps) {
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const labelVisible = useRef(true);

  const color = useMemo(() => getColor(constellation), [constellation]);
  const modelType = useMemo(() => getModelType(constellation), [constellation]);
  const emissiveIntensity = isSelected ? 1.8 : isHighlighted ? 1.0 : 0.6;
  const glowScale = isSelected ? 0.07 : 0.04;

  useFrame(({ camera }, delta) => {
    if (bodyRef.current) {
      bodyRef.current.rotation.y += 0.8 * delta;
    }
    if (groupRef.current && getECI) {
      const eci = getECI();
      if (eci) {
        groupRef.current.position.set(
          eci.x * SCALE,
          eci.z * SCALE,   // Three.js: Y вверх
          -eci.y * SCALE
        );
      }
    }
    // Check if satellite is behind Earth (label occlusion)
    if (groupRef.current) {
      const satPos = groupRef.current.position;
      const camPos = camera.position;
      // Direction from camera to satellite
      const dx = satPos.x - camPos.x;
      const dy = satPos.y - camPos.y;
      const dz = satPos.z - camPos.z;
      const lenSq = dx * dx + dy * dy + dz * dz;
      // Closest point on ray to Earth center (0,0,0)
      const t = Math.max(0, Math.min(1, -(camPos.x * dx + camPos.y * dy + camPos.z * dz) / lenSq));
      const cx = camPos.x + t * dx;
      const cy = camPos.y + t * dy;
      const cz = camPos.z + t * dz;
      const distToCenter = Math.sqrt(cx * cx + cy * cy + cz * cz);
      labelVisible.current = distToCenter >= 0.95; // Earth radius = 1 in scene units, slightly lenient
    }
  });

  return (
    <group ref={groupRef} position={initPos} onClick={onClick}>
      <group ref={bodyRef}>
        {modelType === 0 ? (
          <CubeSat1U color={color} emissiveIntensity={emissiveIntensity} />
        ) : (
          <CubeSat3U color={color} emissiveIntensity={emissiveIntensity} />
        )}
      </group>

      {/* Свечение вокруг КА */}
      <mesh>
        <sphereGeometry args={[glowScale, 8, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isSelected ? 0.3 : 0.12}
        />
      </mesh>

      {/* Подпись — hidden when behind Earth via manual occlusion check */}
      {showLabel && labelVisible.current && (
        <Html
          position={[0, 0.05, 0]}
          center
          distanceFactor={8}
          style={{ pointerEvents: 'none' }}
        >
          <div className="sat-label" style={{ color }}>
            {name}
            {isSelected && (
              <div style={{ fontSize: '8px', opacity: 0.7 }}>
                {constellation}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

// ── Орбитальный трек ────────────────────────────────────────────────
interface OrbitLineProps {
  path: OrbitPoint[];
  color: string;
  opacity?: number;
}

function OrbitLine({ path, color, opacity = 0.3 }: OrbitLineProps) {
  const positions = useMemo(() => {
    const arr = new Float32Array(path.length * 3);
    path.forEach((p, i) => {
      arr[i * 3] = p.x * SCALE;
      arr[i * 3 + 1] = p.z * SCALE;   // Y-up
      arr[i * 3 + 2] = -p.y * SCALE;
    });
    return arr;
  }, [path]);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={positions.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={opacity} linewidth={1} />
    </line>
  );
}

// ── Виртуальный орбитальный трек ────────────────────────────────────
function VirtualOrbitLine({
  index,
  total,
  altitudeKm,
  color,
  opacity = 0.2,
  planes = 1,
}: {
  index: number;
  total: number;
  altitudeKm: number;
  color: string;
  opacity?: number;
  planes?: number;
}) {
  const positions = useMemo(() => {
    const steps = 128;
    const arr = new Float32Array(steps * 3);
    const a = EARTH_RADIUS + altitudeKm;
    const n = Math.sqrt(MU / (a * a * a));
    const incl = (55 * Math.PI) / 180;
    const P = Math.max(1, Math.min(planes, total));
    const satsPerPlane = Math.ceil(total / P);
    const planeIdx = index % P;
    const satInPlane = Math.floor(index / P);
    const raan = (planeIdx / P) * 2 * Math.PI;
    // Walker-δ T/P/F: inter-plane phase offset
    const F = P > 1 ? Math.max(1, Math.floor(P / 2)) : 0;
    const phase = (satInPlane / satsPerPlane) * 2 * Math.PI
      + (F * planeIdx / P) * (2 * Math.PI / satsPerPlane);
    const period = (2 * Math.PI) / n;

    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * period;
      const M = n * t + phase;
      const xOrb = a * Math.cos(M);
      const yOrb = a * Math.sin(M);
      const xInc = xOrb;
      const yInc = yOrb * Math.cos(incl);
      const zInc = yOrb * Math.sin(incl);
      const cosR = Math.cos(raan);
      const sinR = Math.sin(raan);
      const x = xInc * cosR - yInc * sinR;
      const y = xInc * sinR + yInc * cosR;
      const z = zInc;
      arr[i * 3] = x * SCALE;
      arr[i * 3 + 1] = z * SCALE;
      arr[i * 3 + 2] = -y * SCALE;
    }
    return arr;
  }, [index, total, altitudeKm, planes]);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={positions.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={opacity} linewidth={1} />
    </line>
  );
}

// ── Все спутники ────────────────────────────────────────────────────
interface SatellitesProps {
  positions: SatellitePosition[];           // позиции от бэкенда (fallback)
  tleData: TLEData[];                       // TLE для клиентской SGP4
  orbitPaths: Record<number, OrbitPoint[]>;
  selectedSatellite: number | null;
  highlightedConstellation: string | null;
  activeConstellations: string[];
  showOrbits: boolean;
  showLabels: boolean;
  onSelectSatellite: (id: number | null) => void;
  satelliteConstellations: Record<number, string>;
  satelliteCount: number;
  orbitAltitudeKm: number;
  orbitalPlanes: number;
  timeSpeed: number;
}

export function Satellites({
  positions,
  tleData,
  orbitPaths,
  selectedSatellite,
  highlightedConstellation,
  activeConstellations,
  showOrbits,
  showLabels,
  onSelectSatellite,
  satelliteConstellations,
  satelliteCount,
  orbitAltitudeKm,
  orbitalPlanes,
  timeSpeed,
}: SatellitesProps) {
  // ── Клиентская SGP4: инициализируем satrec-объекты ────────────────
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

  // Advance shared simTime on each frame (single source of truth)
  useFrame((_, delta) => {
    advanceSimTime(delta * 1000 * timeSpeed);
  });

  // ── Фильтрация и выбор спутников ──────────────────────────────────

  // Режим виртуальных орбит: генерируем N виртуальных КА
  const virtualSatCount = orbitAltitudeKm > 0 ? satelliteCount : 0;

  const virtualSatItems = useMemo(() => {
    if (orbitAltitudeKm <= 0) return [];
    const allVirt = Array.from({ length: satelliteCount }, (_, i) => ({
      norad_id: 90000 + i,
      name: `VirtSat-${i + 1}`,
      constellation: Object.keys(CONSTELLATION_COLORS)[i % Object.keys(CONSTELLATION_COLORS).length],
    }));
    return allVirt.filter((sat) => activeConstellations.includes(sat.constellation));
  }, [orbitAltitudeKm, satelliteCount, activeConstellations]);

  // Режим реальных TLE: выбираем N спутников равномерно
  const filteredRealPositions = useMemo(() => {
    if (orbitAltitudeKm > 0) return [];
    const filtered = positions.filter((p) => {
      const c = satelliteConstellations[p.norad_id];
      return activeConstellations.includes(c);
    });
    return selectUniformly(filtered, satelliteCount);
  }, [positions, activeConstellations, satelliteConstellations, satelliteCount, orbitAltitudeKm]);

  // Функция: получить текущую ECI-позицию для спутника через satellite.js / virtual orbit
  function makeGetECI(noradId: number) {
    return (): { x: number; y: number; z: number } | null => {
      const simTime = getSimTime();
      // Режим виртуальный
      if (orbitAltitudeKm > 0) {
        const idx = noradId - 90000;
        const eci = computeCircularOrbitECI(idx, virtualSatCount, orbitAltitudeKm, simTime / 1000, orbitalPlanes);
        return eci;
      }
      // Режим реальных TLE через satellite.js
      const rec = satrecsRef.current.find((r) => r.norad_id === noradId);
      if (!rec) return null;
      const pv = propagate(rec.satrec, new Date(simTime));
      if (!pv.position || typeof pv.position === 'boolean') return null;
      return pv.position as { x: number; y: number; z: number };
    };
  }

  // ── Начальные позиции (для первого рендера, пока нет клиентских данных)
  function getInitialPos(noradId: number): Vector3 {
    const simTime = getSimTime();
    if (orbitAltitudeKm > 0) {
      const idx = noradId - 90000;
      const eci = computeCircularOrbitECI(idx, Math.max(virtualSatCount, 1), orbitAltitudeKm, simTime / 1000, orbitalPlanes);
      return new Vector3(eci.x * SCALE, eci.z * SCALE, -eci.y * SCALE);
    }
    const p = positions.find((pos) => pos.norad_id === noradId);
    if (p) {
      return new Vector3(p.eci.x * SCALE, p.eci.z * SCALE, -p.eci.y * SCALE);
    }
    return new Vector3(2, 0, 0);
  }

  return (
    <group>
      {/* ── Виртуальные спутники ───────────────────────────── */}
      {virtualSatItems.map((sat) => {
        const isHighlighted = highlightedConstellation
          ? sat.constellation === highlightedConstellation
          : true;
        return (
          <SatMarker
            key={sat.norad_id}
            name={sat.name}
            constellation={sat.constellation}
            isSelected={selectedSatellite === sat.norad_id}
            isHighlighted={isHighlighted}
            showLabel={showLabels}
            onClick={() => onSelectSatellite(
              selectedSatellite === sat.norad_id ? null : sat.norad_id
            )}
            initPos={getInitialPos(sat.norad_id)}
            getECI={makeGetECI(sat.norad_id)}
          />
        );
      })}

      {/* ── Реальные спутники с клиентской SGP4 ──────────── */}
      {filteredRealPositions.map((pos) => {
        const constellation = satelliteConstellations[pos.norad_id] || '';
        const isHighlighted = highlightedConstellation
          ? constellation === highlightedConstellation
          : true;
        return (
          <SatMarker
            key={pos.norad_id}
            name={pos.name}
            constellation={constellation}
            isSelected={selectedSatellite === pos.norad_id}
            isHighlighted={isHighlighted}
            showLabel={showLabels}
            onClick={() => onSelectSatellite(
              selectedSatellite === pos.norad_id ? null : pos.norad_id
            )}
            initPos={getInitialPos(pos.norad_id)}
            getECI={makeGetECI(pos.norad_id)}
          />
        );
      })}

      {/* ── Орбитальные треки (реальные TLE) ────────────── */}
      {showOrbits && orbitAltitudeKm === 0 &&
        Object.entries(orbitPaths).map(([id, path]) => {
          const numId = parseInt(id);
          const constellation = satelliteConstellations[numId] || '';
          if (!activeConstellations.includes(constellation)) return null;
          if (!filteredRealPositions.some((p) => p.norad_id === numId)) return null;
          const color = getColor(constellation);
          const isActive = selectedSatellite === numId;
          return (
            <OrbitLine
              key={id}
              path={path}
              color={color}
              opacity={isActive ? 0.6 : 0.15}
            />
          );
        })}

      {/* ── Виртуальные орбитальные треки ─────────────── */}
      {showOrbits && orbitAltitudeKm > 0 &&
        virtualSatItems.map((sat) => {
          const idx = sat.norad_id - 90000;
          const color = getColor(sat.constellation);
          const isActive = selectedSatellite === sat.norad_id;
          return (
            <VirtualOrbitLine
              key={sat.norad_id}
              index={idx}
              total={satelliteCount}
              altitudeKm={orbitAltitudeKm}
              color={color}
              opacity={isActive ? 0.6 : 0.2}
              planes={orbitalPlanes}
            />
          );
        })}
    </group>
  );
}
