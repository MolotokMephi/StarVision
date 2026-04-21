/**
 * CoverageZones.tsx
 * Ground coverage footprint for each active satellite.
 *
 * The footprint is the horizon circle on Earth's surface —
 * the set of points visible from the satellite at 0° elevation.
 * Angular radius from Earth center: θ = arccos(R_E / r)
 *
 * Rendering: per-satellite cone (satellite→ring), filled disk on surface,
 * and ring outline.
 *
 * Architecture:
 *   The outer component is a thin gate subscribed to `showCoverage`.
 *   When the toggle is OFF it returns null — the heavy inner component
 *   (pool + useFrame) is unmounted, zero GPU/CPU cost, nothing can get
 *   stuck in an invisible state. When the toggle flips ON the inner
 *   component mounts fresh, allocates its pool, and starts rendering
 *   from the next frame. Unmount disposes all GPU resources.
 */

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry, Float32BufferAttribute,
  Group, Mesh, MeshBasicMaterial, Line, LineSegments,
  LineBasicMaterial, DoubleSide,
} from 'three';
import { twoline2satrec, propagate } from 'satellite.js';
import { getSimTime } from '../simClock';
import { useStore } from '../hooks/useStore';
import { CONSTELLATION_COLORS, CONSTELLATION_NAMES } from '../constants';
import type { TLEData } from '../types';

// ── Constants ─────────────────────────────────────────────────────────
const R_E       = 6371.0;          // Earth radius (km)
const MU        = 398600.4418;     // GM (km³/s²)
const SCALE     = 1 / R_E;         // km → scene units
const SURF      = 1.008;           // Scene-unit radius above Earth surface (avoid z-fighting)
const SEG       = 48;              // Polygon resolution (ring segments)
// Radial subdivision — required so that the flat triangles making up the
// disc stay above the Earth sphere. The chord midpoint between two
// vertices on a sphere of radius SURF separated by angle δ sits at
// SURF·cos(δ/2) from the origin. To stay above Earth (radius 1) for the
// worst-case horizon angle (θ ≈ 40.5° at altitude 2000 km), every radial
// step must be small enough that SURF·cos(step/2) > 1. N_RADIAL = 6
// gives step ≤ 6.75°, a comfortable safety margin.
const N_RADIAL  = 6;
// Triangles per disc: inner fan (SEG) + outer rings (SEG × 2 × (N_RADIAL-1))
const FILL_TRIS = SEG * (2 * N_RADIAL - 1);
const CONE_SEGS = 16;              // Number of cone wireframe lines
const MAX_SATS  = 15;              // Pool size (max satellites)
const THROTTLE  = 3;               // Update every N frames

function getColor(constellation: string): string {
  return CONSTELLATION_COLORS[constellation] ?? '#8ec9ff';
}

// ── Virtual Walker orbit — ECI position (km) ──────────────────────────
function virtualECI(
  i: number, total: number, altKm: number, tSec: number, planes: number
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

// ── Build two orthonormal vectors perpendicular to unit dir (ux,uy,uz) ─
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

// ── Shared horizon parameters ─────────────────────────────────────────
function horizonParams(ex: number, ey: number, ez: number) {
  const r = Math.sqrt(ex * ex + ey * ey + ez * ez);
  if (r < R_E + 50) return null;

  const ct = R_E / r;
  const st = Math.sqrt(Math.max(0, 1 - ct * ct));
  const ux = ex / r, uy = ey / r, uz = ez / r;
  const basis = perpBasis(ux, uy, uz);

  return { r, ct, st, ux, uy, uz, ...basis };
}

// ── Point on Earth surface at angular offset θ_off (0..θ_horizon), phi ─
// Uses arbitrary θ_off so we can build concentric sub-rings between the
// nadir (θ_off=0) and the horizon (θ_off=θ, i.e. cos=ct, sin=st).
function spherePoint(
  thetaOff: number, phi: number,
  ux: number, uy: number, uz: number,
  vx: number, vy: number, vz: number,
  wx: number, wy: number, wz: number,
): [number, number, number] {
  const c = Math.cos(thetaOff), s = Math.sin(thetaOff);
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const rx = c * ux + s * (cp * vx + sp * wx);
  const ry = c * uy + s * (cp * vy + sp * wy);
  const rz = c * uz + s * (cp * vz + sp * wz);
  return [rx * SURF, rz * SURF, -ry * SURF]; // ECI → scene Y-up
}

// ── Ring point on Earth surface at horizon (θ = arccos(ct)) ───────────
function ringPoint(
  phi: number,
  ct: number, st: number,
  ux: number, uy: number, uz: number,
  vx: number, vy: number, vz: number,
  wx: number, wy: number, wz: number,
): [number, number, number] {
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const rx = ct * ux + st * (cp * vx + sp * wx);
  const ry = ct * uy + st * (cp * vy + sp * wy);
  const rz = ct * uz + st * (cp * vz + sp * wz);
  return [rx * SURF, rz * SURF, -ry * SURF]; // ECI → scene Y-up
}

// ── Write subdivided disc fill on Earth surface ───────────────────────
// Builds N_RADIAL concentric sub-rings between nadir and horizon. The
// innermost ring is a triangle fan from the nadir; subsequent rings are
// quad strips (two triangles per segment). Subdivision keeps every
// chord short enough that the flat triangles stay above Earth — without
// it, chords between nadir and horizon ring would dip to SURF·cos(θ/2)
// which is below Earth's radius 1.0 for any θ > ~14° (i.e. all LEO
// altitudes), letting Earth's depth buffer occlude most of the disc.
//
// Winding between the inner fan and the outer strips is intentionally
// not unified — the disc uses side: DoubleSide, so both faces render
// either way. If backface culling is ever enabled, the strips need to
// be flipped to match the fan.
//
// Scratch buffers held at module scope so useFrame doesn't allocate per
// call. Safe because writeFill runs serially on the main thread.
const prevRing = new Float32Array((SEG + 1) * 3);
const currRing = new Float32Array((SEG + 1) * 3);

function writeFill(buf: Float32Array, ex: number, ey: number, ez: number): boolean {
  const h = horizonParams(ex, ey, ez);
  if (!h) return false;

  const { ux, uy, uz, vx, vy, vz, wx, wy, wz } = h;
  const theta = Math.acos(h.ct);

  // Nadir (scene coords) — used by the innermost fan.
  const cx =  ux * SURF;
  const cy =  uz * SURF;
  const cz = -uy * SURF;

  let idx = 0;

  // Fill prevRing with level 1 (innermost sub-ring).
  const step = theta / N_RADIAL;
  for (let s = 0; s <= SEG; s++) {
    const phi = (s / SEG) * 2 * Math.PI;
    const [rx, ry, rz] = spherePoint(step, phi, ux, uy, uz, vx, vy, vz, wx, wy, wz);
    prevRing[s * 3]     = rx;
    prevRing[s * 3 + 1] = ry;
    prevRing[s * 3 + 2] = rz;
  }

  // Innermost triangle fan: nadir → prevRing[s] → prevRing[s+1].
  for (let s = 0; s < SEG; s++) {
    const a0 = s * 3;
    const a1 = (s + 1) * 3;
    buf[idx++] = cx;             buf[idx++] = cy;             buf[idx++] = cz;
    buf[idx++] = prevRing[a0];   buf[idx++] = prevRing[a0+1]; buf[idx++] = prevRing[a0+2];
    buf[idx++] = prevRing[a1];   buf[idx++] = prevRing[a1+1]; buf[idx++] = prevRing[a1+2];
  }

  // Outer quad strips between level k-1 and level k, for k = 2..N_RADIAL.
  for (let k = 2; k <= N_RADIAL; k++) {
    const thetaK = (k === N_RADIAL) ? theta : step * k;
    for (let s = 0; s <= SEG; s++) {
      const phi = (s / SEG) * 2 * Math.PI;
      const [rx, ry, rz] = spherePoint(thetaK, phi, ux, uy, uz, vx, vy, vz, wx, wy, wz);
      currRing[s * 3]     = rx;
      currRing[s * 3 + 1] = ry;
      currRing[s * 3 + 2] = rz;
    }

    for (let s = 0; s < SEG; s++) {
      const a0 = s * 3;
      const a1 = (s + 1) * 3;
      // Quad prev[s] → curr[s] → curr[s+1] → prev[s+1], diagonal prev[s]–curr[s+1].
      buf[idx++] = prevRing[a0];   buf[idx++] = prevRing[a0+1]; buf[idx++] = prevRing[a0+2];
      buf[idx++] = currRing[a0];   buf[idx++] = currRing[a0+1]; buf[idx++] = currRing[a0+2];
      buf[idx++] = currRing[a1];   buf[idx++] = currRing[a1+1]; buf[idx++] = currRing[a1+2];
      buf[idx++] = prevRing[a0];   buf[idx++] = prevRing[a0+1]; buf[idx++] = prevRing[a0+2];
      buf[idx++] = currRing[a1];   buf[idx++] = currRing[a1+1]; buf[idx++] = currRing[a1+2];
      buf[idx++] = prevRing[a1];   buf[idx++] = prevRing[a1+1]; buf[idx++] = prevRing[a1+2];
    }

    // Roll: curr becomes prev for next iteration.
    prevRing.set(currRing);
  }

  return true;
}

// ── Write ring outline (closed loop) ──────────────────────────────────
function writeRing(buf: Float32Array, ex: number, ey: number, ez: number): boolean {
  const h = horizonParams(ex, ey, ez);
  if (!h) return false;

  const { ct, st, ux, uy, uz, vx, vy, vz, wx, wy, wz } = h;

  for (let i = 0; i <= SEG; i++) {
    const phi = (i / SEG) * 2 * Math.PI;
    const [rx, ry, rz] = ringPoint(phi, ct, st, ux, uy, uz, vx, vy, vz, wx, wy, wz);
    buf[i * 3]     = rx;
    buf[i * 3 + 1] = ry;
    buf[i * 3 + 2] = rz;
  }
  return true;
}

// ── Write cone wireframe: satellite → ring points ─────────────────────
function writeCone(buf: Float32Array, ex: number, ey: number, ez: number): boolean {
  const h = horizonParams(ex, ey, ez);
  if (!h) return false;

  const { ct, st, ux, uy, uz, vx, vy, vz, wx, wy, wz } = h;

  // Satellite position in scene coords
  const sx =  ex * SCALE;
  const sy =  ez * SCALE;
  const sz = -ey * SCALE;

  let idx = 0;
  for (let i = 0; i < CONE_SEGS; i++) {
    const phi = (i / CONE_SEGS) * 2 * Math.PI;
    const [rx, ry, rz] = ringPoint(phi, ct, st, ux, uy, uz, vx, vy, vz, wx, wy, wz);

    buf[idx++] = sx; buf[idx++] = sy; buf[idx++] = sz;
    buf[idx++] = rx; buf[idx++] = ry; buf[idx++] = rz;
  }
  return true;
}

// ── Pool entry type ───────────────────────────────────────────────────
type PoolEntry = {
  fillGeo:  BufferGeometry;
  fillBuf:  Float32Array;
  fillAttr: Float32BufferAttribute;
  fillMesh: Mesh;
  fillMat:  MeshBasicMaterial;
  ringGeo:  BufferGeometry;
  ringBuf:  Float32Array;
  ringAttr: Float32BufferAttribute;
  ringLine: Line;
  ringMat:  LineBasicMaterial;
  coneGeo:  BufferGeometry;
  coneBuf:  Float32Array;
  coneAttr: Float32BufferAttribute;
  coneLine: LineSegments;
  coneMat:  LineBasicMaterial;
};

// ── Component ─────────────────────────────────────────────────────────
export interface CoverageZonesProps {
  tleData: TLEData[];
  satelliteConstellations: Record<number, string>;
}

// Outer gate: subscribes to showCoverage. When false we return null so
// the inner component (and its pool) unmounts completely — no chance of
// getting stuck invisible, no StrictMode ghost objects, no wasted work.
export function CoverageZones(props: CoverageZonesProps) {
  const showCoverage = useStore((s) => s.showCoverage);
  if (!showCoverage) return null;
  return <CoverageZonesInner {...props} />;
}

function CoverageZonesInner({ tleData, satelliteConstellations }: CoverageZonesProps) {
  const groupRef    = useRef<Group>(null);
  const frameRef    = useRef(0);
  const poolRef     = useRef<PoolEntry[] | null>(null);
  const satrecsRef  = useRef<Record<number, ReturnType<typeof twoline2satrec>>>({});
  const tleDataRef  = useRef(tleData);
  tleDataRef.current = tleData;
  const constellationsRef = useRef(satelliteConstellations);
  constellationsRef.current = satelliteConstellations;

  // Build satrec cache whenever TLE data changes
  useEffect(() => {
    const map: Record<number, ReturnType<typeof twoline2satrec>> = {};
    tleData.forEach((tle) => {
      map[tle.norad_id] = twoline2satrec(tle.tle_line1, tle.tle_line2);
    });
    satrecsRef.current = map;
  }, [tleData]);

  // Allocate pool once on mount, dispose on unmount.
  // Because the outer component unmounts this whole subtree when the
  // toggle goes off, cleanup here always runs on toggle-off — no stuck
  // state, no leaks.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const pool: PoolEntry[] = [];
    for (let i = 0; i < MAX_SATS; i++) {
      // Filled disk on Earth surface (FILL_TRIS triangles × 3 verts × 3 coords)
      const fillBuf  = new Float32Array(FILL_TRIS * 9);
      const fillAttr = new Float32BufferAttribute(fillBuf, 3);
      fillAttr.setUsage(35048); // DYNAMIC_DRAW
      const fillGeo  = new BufferGeometry();
      fillGeo.setAttribute('position', fillAttr);
      const fillMat  = new MeshBasicMaterial({
        color:        '#3389ff',
        transparent:  true,
        opacity:      0.18,
        side:         DoubleSide,
        depthWrite:   false,
      });
      const fillMesh = new Mesh(fillGeo, fillMat);
      fillMesh.visible       = false;
      fillMesh.renderOrder   = 1;
      fillMesh.frustumCulled = false;

      // Ring outline on Earth surface
      const ringBuf  = new Float32Array((SEG + 1) * 3);
      const ringAttr = new Float32BufferAttribute(ringBuf, 3);
      ringAttr.setUsage(35048);
      const ringGeo  = new BufferGeometry();
      ringGeo.setAttribute('position', ringAttr);
      const ringMat  = new LineBasicMaterial({
        color:       '#3389ff',
        transparent: true,
        opacity:     0.85,
        depthWrite:  false,
      });
      const ringLine = new Line(ringGeo, ringMat);
      ringLine.visible       = false;
      ringLine.renderOrder   = 2;
      ringLine.frustumCulled = false;

      // Cone wireframe: satellite → ring
      const coneBuf  = new Float32Array(CONE_SEGS * 2 * 3);
      const coneAttr = new Float32BufferAttribute(coneBuf, 3);
      coneAttr.setUsage(35048);
      const coneGeo  = new BufferGeometry();
      coneGeo.setAttribute('position', coneAttr);
      const coneMat  = new LineBasicMaterial({
        color:       '#3389ff',
        transparent: true,
        opacity:     0.35,
        depthWrite:  false,
      });
      const coneLine = new LineSegments(coneGeo, coneMat);
      coneLine.visible       = false;
      coneLine.renderOrder   = 1;
      coneLine.frustumCulled = false;

      group.add(fillMesh, ringLine, coneLine);
      pool.push({
        fillGeo, fillBuf, fillAttr, fillMesh, fillMat,
        ringGeo, ringBuf, ringAttr, ringLine, ringMat,
        coneGeo, coneBuf, coneAttr, coneLine, coneMat,
      });
    }
    poolRef.current = pool;

    return () => {
      for (const p of pool) {
        group.remove(p.fillMesh, p.ringLine, p.coneLine);
        p.fillGeo.dispose();  p.fillMat.dispose();
        p.ringGeo.dispose();  p.ringMat.dispose();
        p.coneGeo.dispose();  p.coneMat.dispose();
      }
      poolRef.current = null;
    };
  }, []);

  useFrame(() => {
    const pool = poolRef.current;
    if (!pool) return;

    // Throttle heavy geometry updates
    frameRef.current++;
    if (frameRef.current % THROTTLE !== 0) return;

    // Read live state each frame (avoids stale closures)
    const {
      satelliteCount,
      orbitAltitudeKm,
      orbitalPlanes,
      activeConstellations,
    } = useStore.getState();

    const curTleData = tleDataRef.current;
    const curConstellations = constellationsRef.current;

    const simTime    = getSimTime();
    const simTimeSec = simTime / 1000;
    const useVirtual = orbitAltitudeKm > 0;

    // Filter TLE by active constellations then pick uniformly — mirrors
    // the selection logic in Satellites.tsx so zones align with markers.
    const filteredTLE = curTleData.filter((tle) => {
      const constellation = curConstellations[tle.norad_id];
      return !constellation || activeConstellations.includes(constellation);
    });
    const step = filteredTLE.length > 0 ? filteredTLE.length / satelliteCount : 1;
    const selectedTLE = Array.from(
      { length: Math.min(satelliteCount, filteredTLE.length) },
      (_, i) => filteredTLE[Math.floor(i * step)]
    );

    for (let i = 0; i < MAX_SATS; i++) {
      const p = pool[i];

      const limit = useVirtual ? satelliteCount : Math.min(satelliteCount, selectedTLE.length);
      if (i >= limit) {
        p.fillMesh.visible = false;
        p.ringLine.visible = false;
        p.coneLine.visible = false;
        continue;
      }

      let ex: number, ey: number, ez: number;
      let color = '#8ec9ff';

      if (useVirtual) {
        const eci = virtualECI(i, satelliteCount, orbitAltitudeKm, simTimeSec, orbitalPlanes);
        ex = eci.x; ey = eci.y; ez = eci.z;
        const constellation = CONSTELLATION_NAMES[i % CONSTELLATION_NAMES.length];
        if (!activeConstellations.includes(constellation)) {
          p.fillMesh.visible = false; p.ringLine.visible = false; p.coneLine.visible = false;
          continue;
        }
        color = getColor(constellation);
      } else {
        const tle = selectedTLE[i];
        if (!tle) {
          p.fillMesh.visible = false; p.ringLine.visible = false; p.coneLine.visible = false;
          continue;
        }
        const satrec = satrecsRef.current[tle.norad_id];
        if (!satrec) {
          p.fillMesh.visible = false; p.ringLine.visible = false; p.coneLine.visible = false;
          continue;
        }
        const pv = propagate(satrec, new Date(simTime));
        if (!pv.position || typeof pv.position === 'boolean') {
          p.fillMesh.visible = false; p.ringLine.visible = false; p.coneLine.visible = false;
          continue;
        }
        const pos = pv.position as { x: number; y: number; z: number };
        ex = pos.x; ey = pos.y; ez = pos.z;
        color = getColor(curConstellations[tle.norad_id] ?? '');
      }

      p.fillMat.color.setStyle(color);
      p.ringMat.color.setStyle(color);
      p.coneMat.color.setStyle(color);

      const fillOk = writeFill(p.fillBuf, ex, ey, ez);
      if (!fillOk) {
        p.fillMesh.visible = false; p.ringLine.visible = false; p.coneLine.visible = false;
        continue;
      }
      p.fillAttr.needsUpdate = true;
      p.fillGeo.setDrawRange(0, FILL_TRIS * 3);
      p.fillGeo.computeBoundingSphere();
      p.fillMesh.visible = true;

      writeRing(p.ringBuf, ex, ey, ez);
      p.ringAttr.needsUpdate = true;
      p.ringGeo.setDrawRange(0, SEG + 1);
      p.ringGeo.computeBoundingSphere();
      p.ringLine.visible = true;

      writeCone(p.coneBuf, ex, ey, ez);
      p.coneAttr.needsUpdate = true;
      p.coneGeo.setDrawRange(0, CONE_SEGS * 2);
      p.coneGeo.computeBoundingSphere();
      p.coneLine.visible = true;
    }
  });

  return <group ref={groupRef} />;
}
