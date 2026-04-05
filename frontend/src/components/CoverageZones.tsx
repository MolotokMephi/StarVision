/**
 * CoverageZones.tsx
 * Ground coverage footprint for each active satellite.
 *
 * The footprint is the horizon circle on Earth's surface —
 * the set of points visible from the satellite at 0° elevation.
 * Angular radius from Earth center: θ = arccos(R_E / r)
 *
 * Rendering: per-satellite filled disk (triangle fan) + ring outline.
 * Uses the same object-pool + imperative update pattern as ISL links.
 */

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry, Float32BufferAttribute,
  Group, Mesh, MeshBasicMaterial, Line, LineBasicMaterial, DoubleSide,
} from 'three';
import { twoline2satrec, propagate } from 'satellite.js';
import { getSimTime } from '../simClock';
import { useStore } from '../hooks/useStore';
import type { TLEData } from '../types';

// ── Constants ─────────────────────────────────────────────────────────
const R_E      = 6371.0;          // Earth radius (km)
const MU       = 398600.4418;     // GM (km³/s²)
const SURF     = 1.008;           // Scene-unit radius above Earth surface (enough to avoid z-fighting)
const SEG      = 64;              // Polygon resolution (ring segments)
const MAX_SATS = 15;              // Pool size (max satellites)
const THROTTLE = 3;               // Update every N frames

const CONSTELLATION_COLORS: Record<string, string> = {
  'УниверСат':   '#3389ff',
  'МГТУ Баумана': '#33ffaa',
  'SPUTNIX':     '#ff9933',
  'Геоскан':     '#ff3366',
  'НИИЯФ МГУ':   '#aa33ff',
  'Space-Pi':    '#ffdd33',
};

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

// ── Write triangle-fan fill (SEG × 3 verts × 3 floats) ───────────────
// Returns false when satellite is too close to Earth to draw.
function writeFill(buf: Float32Array, ex: number, ey: number, ez: number): boolean {
  const r = Math.sqrt(ex * ex + ey * ey + ez * ez);
  if (r < R_E + 50) return false;

  const ct = R_E / r;                           // cos(θ)
  const st = Math.sqrt(Math.max(0, 1 - ct * ct)); // sin(θ)
  const ux = ex / r, uy = ey / r, uz = ez / r;
  const { vx, vy, vz, wx, wy, wz } = perpBasis(ux, uy, uz);

  // Sub-satellite point in scene coords (ECI→Three.js Y-up)
  const cx =  ux * SURF;
  const cy =  uz * SURF;   // ECI z → scene Y
  const cz = -uy * SURF;   // ECI -y → scene Z

  let idx = 0;
  for (let i = 0; i < SEG; i++) {
    const phi0 = (i       / SEG) * 2 * Math.PI;
    const phi1 = ((i + 1) / SEG) * 2 * Math.PI;
    const c0 = Math.cos(phi0), s0 = Math.sin(phi0);
    const c1 = Math.cos(phi1), s1 = Math.sin(phi1);

    // ECI unit vectors of ring points
    const r0x = ct * ux + st * (c0 * vx + s0 * wx);
    const r0y = ct * uy + st * (c0 * vy + s0 * wy);
    const r0z = ct * uz + st * (c0 * vz + s0 * wz);
    const r1x = ct * ux + st * (c1 * vx + s1 * wx);
    const r1y = ct * uy + st * (c1 * vy + s1 * wy);
    const r1z = ct * uz + st * (c1 * vz + s1 * wz);

    // Center vertex
    buf[idx++] = cx;  buf[idx++] = cy;  buf[idx++] = cz;
    // Ring vertex 0 (ECI→scene)
    buf[idx++] =  r0x * SURF; buf[idx++] =  r0z * SURF; buf[idx++] = -r0y * SURF;
    // Ring vertex 1
    buf[idx++] =  r1x * SURF; buf[idx++] =  r1z * SURF; buf[idx++] = -r1y * SURF;
  }
  return true;
}

// ── Write ring outline ((SEG+1) verts × 3 floats, closed loop) ───────
function writeRing(buf: Float32Array, ex: number, ey: number, ez: number): boolean {
  const r = Math.sqrt(ex * ex + ey * ey + ez * ez);
  if (r < R_E + 50) return false;

  const ct = R_E / r;
  const st = Math.sqrt(Math.max(0, 1 - ct * ct));
  const ux = ex / r, uy = ey / r, uz = ez / r;
  const { vx, vy, vz, wx, wy, wz } = perpBasis(ux, uy, uz);

  for (let i = 0; i <= SEG; i++) {
    const phi = (i / SEG) * 2 * Math.PI;
    const cp = Math.cos(phi), sp = Math.sin(phi);
    const rx = ct * ux + st * (cp * vx + sp * wx);
    const ry = ct * uy + st * (cp * vy + sp * wy);
    const rz = ct * uz + st * (cp * vz + sp * wz);
    buf[i * 3]     =  rx * SURF;
    buf[i * 3 + 1] =  rz * SURF;
    buf[i * 3 + 2] = -ry * SURF;
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
};

// ── Component ─────────────────────────────────────────────────────────
export interface CoverageZonesProps {
  tleData: TLEData[];
  satelliteConstellations: Record<number, string>;
}

export function CoverageZones({ tleData, satelliteConstellations }: CoverageZonesProps) {
  const groupRef   = useRef<Group>(null);
  const frameRef   = useRef(0);
  const poolRef    = useRef<PoolEntry[] | null>(null);
  const satrecsRef = useRef<Record<number, ReturnType<typeof twoline2satrec>>>({});
  const tleDataRef = useRef(tleData);
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

  // Allocate pool of Three.js objects once on mount
  useEffect(() => {
    const group = groupRef.current;
    if (!group || poolRef.current) return;

    const pool: PoolEntry[] = [];
    for (let i = 0; i < MAX_SATS; i++) {
      // Filled disk: SEG triangle-fan triangles × 3 verts × 3 floats
      const fillBuf  = new Float32Array(SEG * 9);
      const fillAttr = new Float32BufferAttribute(fillBuf, 3);
      fillAttr.setUsage(35048); // DYNAMIC_DRAW
      const fillGeo  = new BufferGeometry();
      fillGeo.setAttribute('position', fillAttr);
      const fillMat  = new MeshBasicMaterial({
        color:        '#3389ff',
        transparent:  true,
        opacity:      0.08,
        side:         DoubleSide,
        depthWrite:   false,
        depthTest:    false,
      });
      const fillMesh = new Mesh(fillGeo, fillMat);
      fillMesh.visible     = false;
      fillMesh.renderOrder = 1;

      // Ring outline: SEG+1 vertices × 3 floats (closed line loop)
      const ringBuf  = new Float32Array((SEG + 1) * 3);
      const ringAttr = new Float32BufferAttribute(ringBuf, 3);
      ringAttr.setUsage(35048);
      const ringGeo  = new BufferGeometry();
      ringGeo.setAttribute('position', ringAttr);
      const ringMat  = new LineBasicMaterial({
        color:       '#3389ff',
        transparent: true,
        opacity:     0.55,
        depthTest:   false,
      });
      const ringLine = new Line(ringGeo, ringMat);
      ringLine.visible     = false;
      ringLine.renderOrder = 2;

      group.add(fillMesh, ringLine);
      pool.push({ fillGeo, fillBuf, fillAttr, fillMesh, fillMat, ringGeo, ringBuf, ringAttr, ringLine, ringMat });
    }
    poolRef.current = pool;

    return () => {
      pool.forEach((p) => {
        p.fillGeo.dispose();
        p.fillMat.dispose();
        p.ringGeo.dispose();
        p.ringMat.dispose();
      });
      poolRef.current = null;
    };
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
      }
      return;
    }

    // Throttle geometry updates
    frameRef.current++;
    if (frameRef.current % THROTTLE !== 0) return;

    const simTime    = getSimTime();
    const simTimeSec = simTime / 1000;
    const useVirtual = orbitAltitudeKm > 0;

    // Uniformly select satelliteCount entries from the catalog
    // (mirrors selectUniformly in Satellites.tsx)
    const step = curTleData.length > 0 ? curTleData.length / satelliteCount : 1;
    const selectedTLE = Array.from(
      { length: Math.min(satelliteCount, curTleData.length) },
      (_, i) => curTleData[Math.floor(i * step)]
    );

    for (let i = 0; i < MAX_SATS; i++) {
      const p = pool[i];

      if (i >= satelliteCount || i >= selectedTLE.length) {
        p.fillMesh.visible = false;
        p.ringLine.visible = false;
        continue;
      }

      let ex: number, ey: number, ez: number;
      let color = '#8ec9ff';

      if (useVirtual) {
        // Analytical Walker orbit
        const eci = virtualECI(i, satelliteCount, orbitAltitudeKm, simTimeSec, orbitalPlanes);
        ex = eci.x; ey = eci.y; ez = eci.z;
        // Derive color from corresponding catalog entry
        const tle = selectedTLE[i];
        if (tle) {
          const constellation = curConstellations[tle.norad_id];
          if (constellation && !activeConstellations.includes(constellation)) {
            p.fillMesh.visible = false; p.ringLine.visible = false; continue;
          }
          color = getColor(constellation ?? '');
        }
      } else {
        // SGP4 propagation from TLE
        const tle = selectedTLE[i];
        if (!tle) { p.fillMesh.visible = false; p.ringLine.visible = false; continue; }

        const constellation = curConstellations[tle.norad_id];
        if (constellation && !activeConstellations.includes(constellation)) {
          p.fillMesh.visible = false; p.ringLine.visible = false; continue;
        }

        const satrec = satrecsRef.current[tle.norad_id];
        if (!satrec) { p.fillMesh.visible = false; p.ringLine.visible = false; continue; }

        const pv = propagate(satrec, new Date(simTime));
        if (!pv.position || typeof pv.position === 'boolean') {
          p.fillMesh.visible = false; p.ringLine.visible = false; continue;
        }
        const pos = pv.position as { x: number; y: number; z: number };
        ex = pos.x; ey = pos.y; ez = pos.z;
        color = getColor(constellation ?? '');
      }

      // Update material colors
      p.fillMat.color.setStyle(color);
      p.ringMat.color.setStyle(color);

      // Update filled disk geometry
      const fillOk = writeFill(p.fillBuf, ex, ey, ez);
      if (!fillOk) { p.fillMesh.visible = false; p.ringLine.visible = false; continue; }
      p.fillAttr.needsUpdate = true;
      p.fillGeo.setDrawRange(0, SEG * 3);
      p.fillMesh.visible = true;

      // Update ring outline geometry
      const ringOk = writeRing(p.ringBuf, ex, ey, ez);
      p.ringAttr.needsUpdate = true;
      p.ringGeo.setDrawRange(0, SEG + 1);
      p.ringLine.visible = ringOk;
    }
  });

  return <group ref={groupRef} />;
}
