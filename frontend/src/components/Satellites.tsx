import { useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Mesh, Vector3, Color, BufferGeometry, LineBasicMaterial, Float32BufferAttribute } from 'three';
import type { SatellitePosition, OrbitPoint } from '../types';

const EARTH_RADIUS = 6371.0;
const SCALE = 1 / EARTH_RADIUS; // ECI км → scene units

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

function getColor(constellation: string): string {
  return CONSTELLATION_COLORS[constellation] || '#8ec9ff';
}

// ── Одиночный спутник ───────────────────────────────────────────────
interface SatMarkerProps {
  position: SatellitePosition;
  isSelected: boolean;
  isHighlighted: boolean;
  showLabel: boolean;
  onClick: () => void;
  constellation: string;
}

function SatMarker({ position, isSelected, isHighlighted, showLabel, onClick, constellation }: SatMarkerProps) {
  const meshRef = useRef<Mesh>(null);
  const pos = useMemo(() => {
    return new Vector3(
      position.eci.x * SCALE,
      position.eci.z * SCALE,   // Three.js: Y вверх
      -position.eci.y * SCALE,
    );
  }, [position.eci]);

  const color = useMemo(() => getColor(constellation), [constellation]);
  const size = isSelected ? 0.025 : 0.015;
  const emissiveIntensity = isSelected ? 1.5 : isHighlighted ? 1.0 : 0.6;

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.02;
      meshRef.current.rotation.x += 0.01;
    }
  });

  return (
    <group position={pos}>
      {/* Тело спутника */}
      <mesh ref={meshRef} onClick={onClick}>
        <octahedronGeometry args={[size, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Свечение */}
      <mesh>
        <sphereGeometry args={[size * 2.5, 8, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isSelected ? 0.25 : 0.1}
        />
      </mesh>

      {/* Подпись */}
      {showLabel && (
        <Html
          position={[0, size * 4, 0]}
          center
          distanceFactor={8}
          style={{ pointerEvents: 'none' }}
        >
          <div className="sat-label" style={{ color }}>
            {position.name}
            {isSelected && (
              <div style={{ fontSize: '8px', opacity: 0.7 }}>
                {position.altitude_km.toFixed(0)} км
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
  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    const positions = new Float32Array(path.length * 3);
    path.forEach((p, i) => {
      positions[i * 3] = p.x * SCALE;
      positions[i * 3 + 1] = p.z * SCALE;     // Y-up
      positions[i * 3 + 2] = -p.y * SCALE;
    });
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return geo;
  }, [path]);

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={opacity} linewidth={1} />
    </line>
  );
}

// ── Все спутники ────────────────────────────────────────────────────
interface SatellitesProps {
  positions: SatellitePosition[];
  orbitPaths: Record<number, OrbitPoint[]>;
  selectedSatellite: number | null;
  highlightedConstellation: string | null;
  activeConstellations: string[];
  showOrbits: boolean;
  showLabels: boolean;
  onSelectSatellite: (id: number | null) => void;
  satelliteConstellations: Record<number, string>;
  satelliteCount: number;
}

export function Satellites({
  positions,
  orbitPaths,
  selectedSatellite,
  highlightedConstellation,
  activeConstellations,
  showOrbits,
  showLabels,
  onSelectSatellite,
  satelliteConstellations,
  satelliteCount,
}: SatellitesProps) {
  const filteredPositions = useMemo(
    () => positions
      .filter((p) => {
        const c = satelliteConstellations[p.norad_id];
        return activeConstellations.includes(c);
      })
      .slice(0, satelliteCount),
    [positions, activeConstellations, satelliteConstellations, satelliteCount]
  );

  return (
    <group>
      {filteredPositions.map((pos) => {
        const constellation = satelliteConstellations[pos.norad_id] || '';
        const isHighlighted = highlightedConstellation
          ? constellation === highlightedConstellation
          : true;

        return (
          <SatMarker
            key={pos.norad_id}
            position={pos}
            isSelected={selectedSatellite === pos.norad_id}
            isHighlighted={isHighlighted}
            showLabel={showLabels}
            onClick={() => onSelectSatellite(
              selectedSatellite === pos.norad_id ? null : pos.norad_id
            )}
            constellation={constellation}
          />
        );
      })}

      {/* Орбитальные треки */}
      {showOrbits &&
        Object.entries(orbitPaths).map(([id, path]) => {
          const numId = parseInt(id);
          const constellation = satelliteConstellations[numId] || '';
          if (!activeConstellations.includes(constellation)) return null;
          if (!filteredPositions.some((p) => p.norad_id === numId)) return null;
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
    </group>
  );
}
