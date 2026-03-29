import { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera } from '@react-three/drei';
import { Earth } from './Earth';
import { Satellites } from './Satellites';
import { useStore } from '../hooks/useStore';
import type { SatellitePosition, OrbitPoint } from '../types';

// ── Сетка координат (экватор + меридианы) ───────────────────────────
function CoordinateGrid() {
  const points = useMemo(() => {
    const lines: [number, number, number][][] = [];

    // Экватор
    const equator: [number, number, number][] = [];
    for (let i = 0; i <= 360; i += 2) {
      const rad = (i * Math.PI) / 180;
      equator.push([Math.cos(rad) * 1.002, 0, Math.sin(rad) * 1.002]);
    }
    lines.push(equator);

    // Несколько кругов широты
    for (const latDeg of [30, 60, -30, -60]) {
      const circle: [number, number, number][] = [];
      const latRad = (latDeg * Math.PI) / 180;
      const r = Math.cos(latRad) * 1.002;
      const y = Math.sin(latRad) * 1.002;
      for (let i = 0; i <= 360; i += 4) {
        const lonRad = (i * Math.PI) / 180;
        circle.push([r * Math.cos(lonRad), y, r * Math.sin(lonRad)]);
      }
      lines.push(circle);
    }

    return lines;
  }, []);

  return (
    <group>
      {points.map((line, idx) => {
        const positions = new Float32Array(line.length * 3);
        line.forEach((p, i) => {
          positions[i * 3] = p[0];
          positions[i * 3 + 1] = p[1];
          positions[i * 3 + 2] = p[2];
        });
        return (
          <line key={idx}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                array={positions}
                count={line.length}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#3389ff" transparent opacity={0.08} />
          </line>
        );
      })}
    </group>
  );
}

// ── Основная 3D-сцена ───────────────────────────────────────────────
interface SceneContentProps {
  positions: SatellitePosition[];
  orbitPaths: Record<number, OrbitPoint[]>;
  satelliteConstellations: Record<number, string>;
}

function SceneContent({ positions, orbitPaths, satelliteConstellations }: SceneContentProps) {
  const {
    timeSpeed,
    showOrbits,
    showLabels,
    selectedSatellite,
    highlightedConstellation,
    activeConstellations,
    satelliteCount,
    selectSatellite,
  } = useStore();

  return (
    <>
      {/* Камера */}
      <PerspectiveCamera makeDefault position={[0, 2, 4]} fov={50} near={0.01} far={1000} />
      <OrbitControls
        enablePan={false}
        minDistance={1.5}
        maxDistance={20}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        enableDamping
        dampingFactor={0.05}
      />

      {/* Освещение */}
      <ambientLight intensity={0.15} color="#8ec9ff" />
      <directionalLight position={[5, 3, 5]} intensity={1.2} color="#ffffff" />
      <directionalLight position={[-3, -1, -3]} intensity={0.3} color="#3389ff" />
      <pointLight position={[0, 0, 0]} intensity={0.1} color="#3389ff" distance={10} />

      {/* Звёзды */}
      <Stars radius={100} depth={80} count={4000} factor={3} saturation={0.1} fade speed={0.5} />

      {/* Земля */}
      <Earth timeSpeed={timeSpeed} />

      {/* Координатная сетка */}
      <CoordinateGrid />

      {/* Спутники */}
      <Satellites
        positions={positions}
        orbitPaths={orbitPaths}
        selectedSatellite={selectedSatellite}
        highlightedConstellation={highlightedConstellation}
        activeConstellations={activeConstellations}
        showOrbits={showOrbits}
        showLabels={showLabels}
        onSelectSatellite={selectSatellite}
        satelliteConstellations={satelliteConstellations}
        satelliteCount={satelliteCount}
      />
    </>
  );
}

// ── Экспортируемый Canvas ───────────────────────────────────────────
interface Scene3DProps {
  positions: SatellitePosition[];
  orbitPaths: Record<number, OrbitPoint[]>;
  satelliteConstellations: Record<number, string>;
}

export function Scene3D({ positions, orbitPaths, satelliteConstellations }: Scene3DProps) {
  return (
    <div className="absolute inset-0">
      <Canvas
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#030712' }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <SceneContent
            positions={positions}
            orbitPaths={orbitPaths}
            satelliteConstellations={satelliteConstellations}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
