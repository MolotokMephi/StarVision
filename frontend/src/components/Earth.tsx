import { useRef, Suspense, Component, ErrorInfo, ReactNode } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, Mesh, BackSide } from 'three';
import { getSimTime } from '../simClock';

// Масштаб: 1 unit = 1 радиус Земли
const EARTH_SEGMENTS = 48;

// Скорость вращения Земли: 360° за 86164 сек (звёздные сутки)
export const EARTH_ROTATION_SPEED = (2 * Math.PI) / 86164;

// NASA Blue Marble — апрель 2004, разрешение 2048×1024
// Источник: NASA Earth Observatory / EOSDIS
const EARTH_TEXTURE_URL =
  '/textures/earth.jpg';

interface EarthProps {
  timeSpeed: number;
}

// ── ErrorBoundary для обработки ошибок загрузки текстуры ──────────
interface EBProps { fallback: ReactNode; children: ReactNode; }
interface EBState { hasError: boolean; }
class TextureErrorBoundary extends Component<EBProps, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError(_: Error): EBState { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('Earth texture load failed, using fallback:', error.message, info);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// ── Земля с текстурой ──────────────────────────────────────────────
function EarthWithTexture({ timeSpeed: _timeSpeed }: EarthProps) {
  const meshRef = useRef<Mesh>(null);
  const atmosphereRef = useRef<Mesh>(null);
  const texture = useLoader(TextureLoader, EARTH_TEXTURE_URL);

  useFrame(() => {
    const simTimeSec = getSimTime() / 1000;
    if (meshRef.current) {
      meshRef.current.rotation.y = EARTH_ROTATION_SPEED * simTimeSec;
    }
    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.y = EARTH_ROTATION_SPEED * simTimeSec * 1.02;
    }
  });

  return (
    <group>
      {/* Земля с Blue Marble текстурой */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, EARTH_SEGMENTS, EARTH_SEGMENTS]} />
        <meshPhongMaterial
          map={texture}
          emissive="#1a3355"
          emissiveIntensity={0.15}
          shininess={25}
          specular="#446688"
        />
      </mesh>

      {/* Атмосфера — внешнее свечение */}
      <mesh ref={atmosphereRef} scale={1.015}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshPhongMaterial
          color="#6aadee"
          transparent
          opacity={0.14}
          side={BackSide}
        />
      </mesh>

      {/* Внешнее свечение (glow) */}
      <mesh scale={1.05}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#4499ff"
          transparent
          opacity={0.07}
          side={BackSide}
        />
      </mesh>
    </group>
  );
}

// ── Запасная Земля (без текстуры, цветной шейдер) ────────────────
function EarthFallback({ timeSpeed: _timeSpeed }: EarthProps) {
  const meshRef = useRef<Mesh>(null);
  const atmosphereRef = useRef<Mesh>(null);

  useFrame(() => {
    const simTimeSec = getSimTime() / 1000;
    if (meshRef.current) {
      meshRef.current.rotation.y = EARTH_ROTATION_SPEED * simTimeSec;
    }
    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.y = EARTH_ROTATION_SPEED * simTimeSec * 1.02;
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
        <sphereGeometry args={[1, 32, 32]} />
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

// ── Публичный компонент с Suspense-fallback и ErrorBoundary ──────
export function Earth({ timeSpeed }: EarthProps) {
  const fallback = <EarthFallback timeSpeed={timeSpeed} />;
  return (
    <TextureErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <EarthWithTexture timeSpeed={timeSpeed} />
      </Suspense>
    </TextureErrorBoundary>
  );
}
