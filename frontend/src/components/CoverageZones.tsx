/**
 * CoverageZones.tsx
 * Ground coverage footprint for each active satellite.
 *
 * The footprint is the horizon circle on Earth's surface —
 * the set of points visible from the satellite at 0° elevation.
 * Angular radius from Earth center: θ = arccos(R_E / r)
 *
 * Rendering: per-satellite cone (satellite→ring), filled disk on surface,
 * and ring outline. Uses the same object-pool + imperative update pattern
 * as ISL links.
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
const SEG       = 64;              // Polygon resolution (ring segments)
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
  // Walker-δ T/P/F: inter-plane phase offset for uniform coverage
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

  const ct = R_E / r;                           // cos(θ)
  const st = Math.sqrt(Math.max(0, 1 - ct * ct)); // sin(θ)
  const ux = ex / r, uy = ey / r, uz = ez / r;
  const basis = perpBasis(ux, uy, uz);

  return { r, ct, st, ux, uy, uz, ...basis };
}

// ── Ring point on Earth surface in scene coords ───────────────────────
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

// ── Write triangle-fan fill on Earth surface (SEG × 3 verts × 3 floats)
function writeFill(buf: Float32Array, ex: number, ey: number, ez: number): boolean {
  const h = horizonParams(ex, ey, ez);
  if (!h) return false;

  const { ct, st, ux, uy, uz, vx, vy, vz, wx, wy, wz } = h;

  // Sub-satellite point in scene coords
  const cx =  ux * SURF;
  const cy =  uz * SURF;
  const cz = -uy * SURF;

  let idx = 0;
  for (let i = 0; i < SEG; i++) {
    const phi0 = (i       / SEG) * 2 * Math.PI;
    const phi1 = ((i + 1) / SEG) * 2 * Math.PI;

    const [r0x, r0y, r0z] = ringPoint(phi0, ct, st, ux, uy, uz, vx, vy, vz, wx, wy, wz);
    const [r1x, r1y, r1z] = ringPoint(phi1, ct, st, ux, uy, uz, vx, vy, vz, wx, wy, wz);

    // Center
    buf[idx++] = cx;  buf[idx++] = cy;  buf[idx++] = cz;
    // Ring vertex 0
    buf[idx++] = r0x; buf[idx++] = r0y; buf[idx++] = r0z;
    // Ring vertex 1
    buf[idx++] = r1x; buf[idx++] = r1y; buf[idx++] = r1z;
  }
  return true;
}

// ── Write ring outline ((SEG+1) verts × 3 floats, closed loop) ───────
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

// ── Write cone wireframe lines: satellite → ring points ───────────────
// Buffer layout: CONE_SEGS line-segment pairs, each = 2 verts × 3 floats
function writeCone(buf: Float32Array, ex: number, ey: number, ez: number): boolean {
  const h = horizonParams(ex, ey, ez);
  if (!h) return false;

  const { ct, st, ux, uy, uz, vx, vy, vz, wx, wy, wz } = h;

  // Satellite position in scene coords (ECI → Three.js Y-up)
  const sx =  ex * SCALE;
  const sy =  ez * SCALE;
  const sz = -ey * SCALE;

  let idx = 0;
  for (let i = 0; i < CONE_SEGS; i++) {
    const phi = (i / CONE_SEGS) * 2 * Math.PI;
    const [rx, ry, rz] = ringPoint(phi, ct, st, ux, uy, uz, vx, vy, vz, wx, wy, wz);

    // Satellite vertex
    buf[idx++] = sx; buf[idx++] = sy; buf[idx++] = sz;
    // Ring vertex on Earth surface
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

export function CoverageZones({ tleData, satelliteConstellations }: CoverageZonesProps) {
  const groupRef    = useRef<Group>(null);
  const frameRef    = useRef(0);
  const poolRef     = useRef<PoolEntry[] | null>(null);
  const poolInitRef = useRef(false);
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

  // Allocate pool once on mount (poolInitRef guard prevents double-creation
  // in React StrictMode — same pattern as InterSatelliteLinks)
  useEffect(() => {
    const group = groupRef.current;
    if (!group || poolInitRef.current) return;

    const pool: PoolEntry[] = [];
    for (let i = 0; i < MAX_SATS; i++) {
      // ── Filled disk on Earth surface ──────────────────────────
      const fillBuf  = new Float32Array(SEG * 9);
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
        depthTest:    false,
      });
      const fillMesh = new Mesh(fillGeo, fillMat);
      fillMesh.visible       = false;
      fillMesh.renderOrder   = 1;
      fillMesh.frustumCulled = false;

      // ── Ring outline on Earth surface ─────────────────────────
      const ringBuf  = new Float32Array((SEG + 1) * 3);
      const ringAttr = new Float32BufferAttribute(ringBuf, 3);
      ringAttr.setUsage(35048);
      const ringGeo  = new BufferGeometry();
      ringGeo.setAttribute('position', ringAttr);
      const ringMat  = new LineBasicMaterial({
        color:       '#3389ff',
        transparent: true,
        opacity:     0.75,
        depthTest:   false,
      });
      const ringLine = new Line(ringGeo, ringMat);
      ringLine.visible       = false;
      ringLine.renderOrder   = 2;
      ringLine.frustumCulled = false;

      // ── Cone wireframe: satellite → ring points ───────────────
      const coneBuf  = new Float32Array(CONE_SEGS * 2 * 3);
      const coneAttr = new Float32BufferAttribute(coneBuf, 3);
      coneAttr.setUsage(35048);
      const coneGeo  = new BufferGeometry();
      coneGeo.setAttribute('position', coneAttr);
      const coneMat  = new LineBasicMaterial({
        color:       '#3389ff',
        transparent: true,
        opacity:     0.25,
        depthTest:   false,
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
    poolInitRef.current = true;
  }, []);

  useFrame(() => {
    const pool = poolRef.current;
    if (!pool) return;

    // Read state directly from the store to avoid stale closures
    const {
      showCoverage,
      satelliteCount,
      orbitAltitudeKm,
      orbitalPlanes,
      activeConstellations,
    } = useStore.getState();

    const curTleData = tleDataRef.current;
    const curConstellations = constellationsRef.current;

    // When coverage is disabled, hide everything immediately
    if (!showCoverage) {
      for (let i = 0; i < MAX_SATS; i++) {
        pool[i].fillMesh.visible = false;
        pool[i].ringLine.visible = false;
        pool[i].coneLine.visible = false;
      }
      return;
    }

    // Throttle geometry updates
    frameRef.current++;
    if (frameRef.current % THROTTLE !== 0) return;

    const simTime    = getSimTime();
    const simTimeSec = simTime / 1000;
    const useVirtual = orbitAltitudeKm > 0;

    // Filter by active constellations first, then select uniformly
    // (mirrors the logic in Satellites.tsx to keep zones aligned with satellite markers)
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

      // In virtual mode, gate only by satelliteCount (no TLE dependency);
      // in real mode, also gate by available TLE entries.
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
        // Analytical Walker orbit
        const eci = virtualECI(i, satelliteCount, orbitAltitudeKm, simTimeSec, orbitalPlanes);
        ex = eci.x; ey = eci.y; ez = eci.z;
        // Derive constellation by cycling through names (consistent with Satellites.tsx and ISL)
        const constellation = CONSTELLATION_NAMES[i % CONSTELLATION_NAMES.length];
        if (!activeConstellations.includes(constellation)) {
          p.fillMesh.visible = false; p.ringLine.visible = false; p.coneLine.visible = false; continue;
        }
        color = getColor(constellation);
      } else {
        // SGP4 propagation from TLE (already filtered by constellation above)
        const tle = selectedTLE[i];
        if (!tle) { p.fillMesh.visible = false; p.ringLine.visible = false; p.coneLine.visible = false; continue; }

        const constellation = curConstellations[tle.norad_id];

        const satrec = satrecsRef.current[tle.norad_id];
        if (!satrec) { p.fillMesh.visible = false; p.ringLine.visible = false; p.coneLine.visible = false; continue; }

        const pv = propagate(satrec, new Date(simTime));
        if (!pv.position || typeof pv.position === 'boolean') {
          p.fillMesh.visible = false; p.ringLine.visible = false; p.coneLine.visible = false; continue;
        }
        const pos = pv.position as { x: number; y: number; z: number };
        ex = pos.x; ey = pos.y; ez = pos.z;
        color = getColor(constellation ?? '');
      }

      // Update material colors
      p.fillMat.color.setStyle(color);
      p.ringMat.color.setStyle(color);
      p.coneMat.color.setStyle(color);

      // Update filled disk geometry (ground footprint)
      const fillOk = writeFill(p.fillBuf, ex, ey, ez);
      if (!fillOk) {
        p.fillMesh.visible = false; p.ringLine.visible = false; p.coneLine.visible = false; continue;
      }
      p.fillAttr.needsUpdate = true;
      p.fillGeo.setDrawRange(0, SEG * 3);
      p.fillGeo.computeBoundingSphere();
      p.fillMesh.visible = true;

      // Update ring outline geometry
      const ringOk = writeRing(p.ringBuf, ex, ey, ez);
      p.ringAttr.needsUpdate = true;
      p.ringGeo.setDrawRange(0, SEG + 1);
      p.ringGeo.computeBoundingSphere();
      p.ringLine.visible = ringOk;

      // Update cone wireframe (satellite → ring)
      const coneOk = writeCone(p.coneBuf, ex, ey, ez);
      p.coneAttr.needsUpdate = true;
      p.coneGeo.setDrawRange(0, CONE_SEGS * 2);
      p.coneGeo.computeBoundingSphere();
      p.coneLine.visible = coneOk;
    }
  });

  return <group ref={groupRef} />;
}
