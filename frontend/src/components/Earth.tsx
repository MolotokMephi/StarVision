import { useRef, Suspense } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, Mesh, BackSide } from 'three';

// Масштаб: 1 unit = 1 радиус Земли
const EARTH_SEGMENTS = 64;

// Скорость вращения Земли: 360° за 86164 сек (звёздные сутки)
const EARTH_ROTATION_SPEED = (2 * Math.PI) / 86164;

// NASA Blue Marble — апрель 2004, разрешение 2048×1024
// Источник: NASA Earth Observatory / EOSDIS
const EARTH_TEXTURE_URL =
  'https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74393/world.200412.3x2048x1024.jpg';

interface EarthProps {
  timeSpeed: number;
}

// ── Земля с текстурой ──────────────────────────────────────────────
function EarthWithTexture({ timeSpeed }: EarthProps) {
  const meshRef = useRef<Mesh>(null);
  const atmosphereRef = useRef<Mesh>(null);
  const texture = useLoader(TextureLoader, EARTH_TEXTURE_URL);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += EARTH_ROTATION_SPEED * delta * timeSpeed;
    }
    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.y += EARTH_ROTATION_SPEED * delta * timeSpeed * 1.02;
    }
  });

  return (
    <group>
      {/* Земля с Blue Marble текстурой */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, EARTH_SEGMENTS, EARTH_SEGMENTS]} />
        <meshPhongMaterial
          map={texture}
          emissive="#112244"
          emissiveIntensity={0.05}
          shininess={15}
          specular="#224466"
        />
      </mesh>

      {/* Атмосфера — внешнее свечение */}
      <mesh ref={atmosphereRef} scale={1.015}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshPhongMaterial
          color="#5599dd"
          transparent
          opacity={0.1}
          side={BackSide}
        />
      </mesh>

      {/* Внешнее свечение (glow) */}
      <mesh scale={1.06}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#3389ff"
          transparent
          opacity={0.04}
          side={BackSide}
        />
      </mesh>
    </group>
  );
}

// ── Запасная Земля (без текстуры, цветной шейдер) ────────────────
function EarthFallback({ timeSpeed }: EarthProps) {
  const meshRef = useRef<Mesh>(null);
  const atmosphereRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += EARTH_ROTATION_SPEED * delta * timeSpeed;
    }
    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.y += EARTH_ROTATION_SPEED * delta * timeSpeed * 1.02;
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, EARTH_SEGMENTS, EARTH_SEGMENTS]} />
        <meshPhongMaterial
          color="#4488cc"
          emissive="#112244"
          emissiveIntensity={0.15}
          shininess={25}
          specular="#335577"
        />
      </mesh>
      <mesh ref={atmosphereRef} scale={1.015}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshPhongMaterial
          color="#5599dd"
          transparent
          opacity={0.12}
          side={BackSide}
        />
      </mesh>
      <mesh scale={1.06}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#3389ff"
          transparent
          opacity={0.04}
          side={BackSide}
        />
      </mesh>
    </group>
  );
}

// ── Публичный компонент с Suspense-fallback ───────────────────────
export function Earth({ timeSpeed }: EarthProps) {
  return (
    <Suspense fallback={<EarthFallback timeSpeed={timeSpeed} />}>
      <EarthWithTexture timeSpeed={timeSpeed} />
    </Suspense>
  );
}
