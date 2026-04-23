/**
 * CoverageZones.tsx
 * Satellite-to-Earth coverage cones.
 *
 * For every active satellite we render a translucent cone whose apex
 * is the satellite and whose base is the horizon circle projected onto
 * Earth's surface. The cone volume is the set of sight-lines from the
 * satellite down to every point on the ground it can see at ≥ 0°
 * elevation (angular radius from Earth center: θ = arccos(R_E / r)).
 *
 * A brighter line loop outlines the base ring on the surface.
 *
 * Toggle architecture:
 *   The outer component subscribes to `showCoverage` and returns null
 *   when the toggle is off. That unmounts the inner component, drops
 *   its pool, disposes all GPU resources, and cancels useFrame — no
 *   stuck state, no StrictMode ghosts, no wasted work. Flipping the
 *   toggle back on remounts a fresh inner component that updates on
 *   the very next frame.
 */
import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry, Float32BufferAttribute,
  Group, Mesh, MeshBasicMaterial,
  LineLoop, LineBasicMaterial,
  DoubleSide,
} from 'three';
import { twoline2satrec, propagate } from 'satellite.js';
import { getSimTime } from '../simClock';
import { useStore } from '../hooks/useStore';
import { CONSTELLATION_COLORS, CONSTELLATION_NAMES } from '../constants';
import { selectRealSatellites } from '../selection';
import type { TLEData } from '../types';

// ── Constants ─────────────────────────────────────────────────────────
const R_E      = 6371.0;         // Earth radius (km)
const MU       = 398600.4418;    // GM (km³/s²)
const SCALE    = 1 / R_E;        // km → scene units (Earth radius = 1)
const SURF     = 1.001;          // Tiny offset to avoid z-fighting with Earth
const SEG      = 64;              // Base ring / cone segments
const MAX_SATS = 15;              // Pool size (matches max satelliteCount)

function getColor(constellation: string): string {
  return CONSTELLATION_COLORS[constellation] ?? '#8ec9ff';
}

// ── Virtual Walker orbit — ECI position (km), matches Satellites.tsx ──
function virtualECI(
  i: number, total: number, altKm: number, tSec: number, planes: number,
): { x: number; y: number; z: number } {
  const a    = R_E + altKm;
  const n    = Math.sqrt(MU / (a * a * a));
  const incl = (55 * Math.PI) / 180;
  const P    = Math.max(1, Math.min(planes, total));
  const spp  = Math.ceil(total / P);
  const pi   = i % P;
  const si   = Math.floor(i / P);
  const raan = (pi / P) * 2 * Math.PI;
  const F    = P > 1 ? Math.max(1, Math.floor(P / 2)) : 0;
  const phase = (si / spp) * 2 * Math.PI
    + (F * pi / P) * (2 * Math.PI / spp);
  const M    = n * tSec + phase;
  const xOrb = a * Math.cos(M);
  const yOrb = a * Math.sin(M);
  const cosR = Math.cos(raan), sinR = Math.sin(raan);
  const cosI = Math.cos(incl), sinI = Math.sin(incl);
  return {
    x: xOrb * cosR - yOrb * cosI * sinR,
    y: xOrb * sinR + yOrb * cosI * cosR,
    z: yOrb * sinI,
  };
}

// ── Orthonormal basis (v, w) perpendicular to unit vector u ───────────
function perpBasis(ux: number, uy: number, uz: number) {
  let vx: number, vy: number, vz: number;
  if (Math.abs(ux) < 0.9) { vx = 0;   vy =  uz; vz = -uy; }
  else                     { vx = -uz; vy =  0;  vz =  ux; }
  const L = Math.sqrt(vx * vx + vy * vy + vz * vz);
  vx /= L; vy /= L; vz /= L;
  return {
    vx, vy, vz,
    wx: uy * vz - uz * vy,
    wy: uz * vx - ux * vz,
    wz: ux * vy - uy * vx,
  };
}

// Reusable scratch buffer for base ring points (scene coords, Y-up).
// Filled by writeBase() and read by writeCone() within the same frame.
const baseRing = new Float32Array(SEG * 3);

// Compute horizon ring points on Earth surface for a satellite at
// ECI (ex, ey, ez). Returns false if the satellite is too low for a
// meaningful horizon (inside or near the atmosphere).
function writeBase(ex: number, ey: number, ez: number): boolean {
  const r = Math.sqrt(ex * ex + ey * ey + ez * ez);
  if (r < R_E + 50) return false;

  const ct = R_E / r;                                 // cos(θ)
  const st = Math.sqrt(Math.max(0, 1 - ct * ct));     // sin(θ)
  const ux = ex / r, uy = ey / r, uz = ez / r;
  const { vx, vy, vz, wx, wy, wz } = perpBasis(ux, uy, uz);

  for (let i = 0; i < SEG; i++) {
    const phi = (i / SEG) * 2 * Math.PI;
    const cp  = Math.cos(phi), sp = Math.sin(phi);
    // Point on unit sphere at angular offset θ from u, phase φ around u.
    const rx  = ct * ux + st * (cp * vx + sp * wx);
    const ry  = ct * uy + st * (cp * vy + sp * wy);
    const rz  = ct * uz + st * (cp * vz + sp * wz);
    // ECI (x, y, z) → scene Y-up: (x, z, -y), scaled to Earth-surface radius.
    baseRing[i * 3]     =  rx * SURF;
    baseRing[i * 3 + 1] =  rz * SURF;
    baseRing[i * 3 + 2] = -ry * SURF;
  }
  return true;
}

// Write SEG triangles that span (apex, base[i], base[i+1]) for the
// translucent cone body. Call writeBase() first — this reads baseRing.
function writeCone(buf: Float32Array, ex: number, ey: number, ez: number) {
  // Apex = satellite position (ECI → Y-up scene coords)
  const sx =  ex * SCALE;
  const sy =  ez * SCALE;
  const sz = -ey * SCALE;

  let idx = 0;
  for (let i = 0; i < SEG; i++) {
    const a = i * 3;
    const b = ((i + 1) % SEG) * 3;
    // Apex
    buf[idx++] = sx;             buf[idx++] = sy;             buf[idx++] = sz;
    // Base i
    buf[idx++] = baseRing[a];    buf[idx++] = baseRing[a + 1]; buf[idx++] = baseRing[a + 2];
    // Base i+1
    buf[idx++] = baseRing[b];    buf[idx++] = baseRing[b + 1]; buf[idx++] = baseRing[b + 2];
  }
}

// Copy the already-computed base ring to a per-satellite ring buffer.
function writeRing(buf: Float32Array) {
  buf.set(baseRing);
}

// ── Pool entry ────────────────────────────────────────────────────────
type PoolEntry = {
  coneMesh: Mesh;
  coneMat:  MeshBasicMaterial;
  coneGeo:  BufferGeometry;
  coneBuf:  Float32Array;
  coneAttr: Float32BufferAttribute;

  ringLine: LineLoop;
  ringMat:  LineBasicMaterial;
  ringGeo:  BufferGeometry;
  ringBuf:  Float32Array;
  ringAttr: Float32BufferAttribute;
};

// ── Props ─────────────────────────────────────────────────────────────
export interface CoverageZonesProps {
  tleData: TLEData[];
  satelliteConstellations: Record<number, string>;
}

// Outer gate: subscribes to `showCoverage` and unmounts the inner tree
// when the toggle is off. This is the single source of truth for
// visibility — no stuck state, no lingering meshes.
export function CoverageZones(props: CoverageZonesProps) {
  const showCoverage = useStore((s) => s.showCoverage);
  if (!showCoverage) return null;
  return <CoverageZonesInner {...props} />;
}

function CoverageZonesInner({ tleData, satelliteConstellations }: CoverageZonesProps) {
  const groupRef   = useRef<Group>(null);
  const poolRef    = useRef<PoolEntry[] | null>(null);
  const satrecsRef = useRef<Record<number, ReturnType<typeof twoline2satrec>>>({});

  // Refs shadow the latest props so useFrame never reads stale closures.
  const tleRef             = useRef(tleData);             tleRef.current = tleData;
  const constellationsRef  = useRef(satelliteConstellations);
  constellationsRef.current = satelliteConstellations;

  // Rebuild satrec cache whenever TLE data changes.
  useEffect(() => {
    const map: Record<number, ReturnType<typeof twoline2satrec>> = {};
    tleData.forEach((tle) => {
      map[tle.norad_id] = twoline2satrec(tle.tle_line1, tle.tle_line2);
    });
    satrecsRef.current = map;
  }, [tleData]);

  // Allocate the pool once on mount; dispose on unmount.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const pool: PoolEntry[] = [];
    for (let i = 0; i < MAX_SATS; i++) {
      // Cone body — SEG triangles × 3 verts × 3 coords.
      const coneBuf  = new Float32Array(SEG * 3 * 3);
      const coneAttr = new Float32BufferAttribute(coneBuf, 3);
      coneAttr.setUsage(35048); // DYNAMIC_DRAW
      const coneGeo  = new BufferGeometry();
      coneGeo.setAttribute('position', coneAttr);
      const coneMat  = new MeshBasicMaterial({
        color:       '#3389ff',
        transparent: true,
        opacity:     0.14,
        side:        DoubleSide,
        depthWrite:  false,
      });
      const coneMesh = new Mesh(coneGeo, coneMat);
      coneMesh.visible       = false;
      coneMesh.frustumCulled = false;
      coneMesh.renderOrder   = 1;

      // Base ring outline on Earth surface — closed loop of SEG verts.
      const ringBuf  = new Float32Array(SEG * 3);
      const ringAttr = new Float32BufferAttribute(ringBuf, 3);
      ringAttr.setUsage(35048);
      const ringGeo  = new BufferGeometry();
      ringGeo.setAttribute('position', ringAttr);
      const ringMat  = new LineBasicMaterial({
        color:       '#3389ff',
        transparent: true,
        opacity:     0.9,
        depthWrite:  false,
      });
      const ringLine = new LineLoop(ringGeo, ringMat);
      ringLine.visible       = false;
      ringLine.frustumCulled = false;
      ringLine.renderOrder   = 2;

      group.add(coneMesh, ringLine);
      pool.push({
        coneMesh, coneMat, coneGeo, coneBuf, coneAttr,
        ringLine, ringMat, ringGeo, ringBuf, ringAttr,
      });
    }
    poolRef.current = pool;

    return () => {
      for (const p of pool) {
        group.remove(p.coneMesh, p.ringLine);
        p.coneGeo.dispose(); p.coneMat.dispose();
        p.ringGeo.dispose(); p.ringMat.dispose();
      }
      poolRef.current = null;
    };
  }, []);

  useFrame(() => {
    const pool = poolRef.current;
    if (!pool) return;

    const {
      satelliteCount,
      orbitAltitudeKm,
      orbitalPlanes,
      activeConstellations,
    } = useStore.getState();

    const curTLE = tleRef.current;
    const curCon = constellationsRef.current;

    const simTime    = getSimTime();
    const simTimeSec = simTime / 1000;
    const useVirtual = orbitAltitudeKm > 0;

    // Pick the same satellites Satellites.tsx renders via the shared
    // selection helper — zones always align with visible markers.
    const selectedTLE = useVirtual
      ? []
      : selectRealSatellites(curTLE, satelliteCount, activeConstellations, curCon);

    const virtualLimit = useVirtual ? satelliteCount : 0;
    const limit = useVirtual ? virtualLimit : selectedTLE.length;

    for (let i = 0; i < MAX_SATS; i++) {
      const p = pool[i];

      if (i >= limit) {
        p.coneMesh.visible = false;
        p.ringLine.visible = false;
        continue;
      }

      let ex: number, ey: number, ez: number;
      let color = '#8ec9ff';

      if (useVirtual) {
        const constellation = CONSTELLATION_NAMES[i % CONSTELLATION_NAMES.length];
        if (!activeConstellations.includes(constellation)) {
          p.coneMesh.visible = false; p.ringLine.visible = false;
          continue;
        }
        const eci = virtualECI(i, satelliteCount, orbitAltitudeKm, simTimeSec, orbitalPlanes);
        ex = eci.x; ey = eci.y; ez = eci.z;
        color = getColor(constellation);
      } else {
        const tle = selectedTLE[i];
        if (!tle) { p.coneMesh.visible = false; p.ringLine.visible = false; continue; }
        const satrec = satrecsRef.current[tle.norad_id];
        if (!satrec) { p.coneMesh.visible = false; p.ringLine.visible = false; continue; }
        const pv = propagate(satrec, new Date(simTime));
        if (!pv.position || typeof pv.position === 'boolean') {
          p.coneMesh.visible = false; p.ringLine.visible = false;
          continue;
        }
        const pos = pv.position as { x: number; y: number; z: number };
        ex = pos.x; ey = pos.y; ez = pos.z;
        color = getColor(curCon[tle.norad_id] ?? '');
      }

      if (!writeBase(ex, ey, ez)) {
        p.coneMesh.visible = false; p.ringLine.visible = false;
        continue;
      }

      p.coneMat.color.setStyle(color);
      p.ringMat.color.setStyle(color);

      writeCone(p.coneBuf, ex, ey, ez);
      p.coneAttr.needsUpdate = true;
      p.coneGeo.computeBoundingSphere();
      p.coneMesh.visible = true;

      writeRing(p.ringBuf);
      p.ringAttr.needsUpdate = true;
      p.ringGeo.computeBoundingSphere();
      p.ringLine.visible = true;
    }
  });

  return <group ref={groupRef} />;
}
