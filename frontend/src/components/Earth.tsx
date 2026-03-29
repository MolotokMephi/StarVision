import { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, Mesh, SphereGeometry, MeshPhongMaterial, AdditiveBlending, BackSide } from 'three';

// Масштаб: 1 unit = 1 радиус Земли
const EARTH_SEGMENTS = 64;

// Скорость вращения Земли: 360° за 86164 сек (звёздные сутки)
const EARTH_ROTATION_SPEED = (2 * Math.PI) / 86164;

interface EarthProps {
  timeSpeed: number;
}

export function Earth({ timeSpeed }: EarthProps) {
  const meshRef = useRef<Mesh>(null);
  const atmosphereRef = useRef<Mesh>(null);

  // Синхронизация с реальным вращением
  useFrame((_, delta) => {
    if (meshRef.current) {
      // Начальное вращение: текущий GMST
      meshRef.current.rotation.y += EARTH_ROTATION_SPEED * delta * timeSpeed;
    }
    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.y += EARTH_ROTATION_SPEED * delta * timeSpeed * 1.02;
    }
  });

  return (
    <group>
      {/* Земля */}
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

      {/* Атмосфера — внешнее свечение */}
      <mesh ref={atmosphereRef} scale={1.015}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshPhongMaterial
          color="#5599dd"
          transparent
          opacity={0.12}
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
