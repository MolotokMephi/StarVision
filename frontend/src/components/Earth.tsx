import { useRef, Suspense, Component, ErrorInfo, ReactNode } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, Mesh, BackSide } from 'three';
import { getSimTime } from '../simClock';

// Scale: 1 unit = 1 Earth radius
const EARTH_SEGMENTS = 48;

// Earth rotation speed: 360° per 86164 sec (sidereal day)
export const EARTH_ROTATION_SPEED = (2 * Math.PI) / 86164;

// NASA Blue Marble — April 2004, resolution 2048×1024
// Source: NASA Earth Observatory / EOSDIS
const EARTH_TEXTURE_URL =
  '/textures/earth.jpg';

// ── ErrorBoundary for texture loading errors ─────────────────────
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

// ── Earth with texture ─────────────────────────────────────────────
function EarthWithTexture() {
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
      {/* Earth with Blue Marble texture */}
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

      {/* Atmosphere — outer glow */}
      <mesh ref={atmosphereRef} scale={1.015}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshPhongMaterial
          color="#6aadee"
          transparent
          opacity={0.14}
          side={BackSide}
        />
      </mesh>

      {/* Outer glow */}
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

// ── Fallback Earth (no texture, colored shader) ─────────────────
function EarthFallback() {
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

// ── Public component with Suspense fallback and ErrorBoundary ────
export function Earth() {
  const fallback = <EarthFallback />;
  return (
    <TextureErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <EarthWithTexture />
      </Suspense>
    </TextureErrorBoundary>
  );
}
