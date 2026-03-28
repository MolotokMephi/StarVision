/**
 * @file satellites.js
 * @description Рендеринг спутников — 3U CubeSat мешей, орбитальных линий,
 * конусов покрытия. Обновление позиций каждый кадр.
 */

import { SCALE, DEG, R_EARTH } from '../core/constants.js';
import { getSatState } from '../core/constellation.js';
import { coverageAngle, meanMotion, solveKepler, trueAnomaly, keplerToECI } from '../core/orbitalMechanics.js';

let satMeshes = [];
let orbitLines = [];
let coverageCones = [];

/**
 * Пересоздать все меши спутников, орбит и конусов покрытия.
 * @param {THREE.Scene} scene
 * @param {Array<object>} satellites
 * @param {object} config
 */
export function rebuildSatellites(scene, satellites, config) {
  // Удалить старые
  satMeshes.forEach(m => scene.remove(m));
  orbitLines.forEach(l => scene.remove(l));
  coverageCones.forEach(c => scene.remove(c));
  satMeshes = [];
  orbitLines = [];
  coverageCones = [];

  const bodyGeo = new THREE.BoxGeometry(0.012, 0.012, 0.032);
  const panelGeo = new THREE.PlaneGeometry(0.025, 0.012);

  satellites.forEach((sat, idx) => {
    const hue = (sat.plane / config.planes);
    const color = new THREE.Color().setHSL(hue, 0.8, 0.6);

    // Корпус 3U CubeSat
    const body = new THREE.Mesh(bodyGeo, new THREE.MeshPhongMaterial({
      color: 0x888888, emissive: color.clone().multiplyScalar(0.2), shininess: 80
    }));

    // Солнечные панели
    const pm = new THREE.MeshPhongMaterial({
      color: 0x1a237e, emissive: 0x0d47a1, emissiveIntensity: 0.15, side: THREE.DoubleSide
    });
    const pL = new THREE.Mesh(panelGeo, pm);
    pL.position.set(-0.019, 0, 0);
    pL.rotation.y = Math.PI / 2;
    body.add(pL);
    const pR = new THREE.Mesh(panelGeo, pm);
    pR.position.set(0.019, 0, 0);
    pR.rotation.y = Math.PI / 2;
    body.add(pR);

    // Индикатор цвета плоскости
    body.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.004, 6, 6),
      new THREE.MeshBasicMaterial({ color })
    ));

    body.userData = { satIndex: idx };
    scene.add(body);
    satMeshes.push(body);

    // Орбитальная линия (один полный виток)
    const pts = [];
    const T = (2 * Math.PI) / sat.n;
    for (let i = 0; i <= 200; i++) {
      const dt = (i / 200) * T;
      const M = (sat.M0 + sat.n * dt) % (2 * Math.PI);
      const E = solveKepler(M, sat.ecc);
      const nu = trueAnomaly(E, sat.ecc);
      const eci = keplerToECI(sat.a_km, sat.ecc, sat.inc, sat.raan0, sat.argp0, nu);
      pts.push(new THREE.Vector3(eci.x * SCALE, eci.z * SCALE, -eci.y * SCALE));
    }
    const ol = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.18 })
    );
    scene.add(ol);
    orbitLines.push(ol);

    // Конус покрытия
    const lam = coverageAngle(config.altitude, 10);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(Math.sin(lam), 1 - Math.cos(lam), 32, 1, true),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false
      })
    );
    cone.visible = false;
    scene.add(cone);
    coverageCones.push(cone);
  });
}

/**
 * Обновить позиции спутников каждый кадр.
 * @param {Array} satellites
 * @param {number} simTime — Unix timestamp, мс
 * @param {object} displayState — {selectedSatIndex, showCoverage}
 */
export function updateSatellitePositions(satellites, simTime, displayState) {
  satellites.forEach((sat, i) => {
    if (i >= satMeshes.length) return;
    const st = getSatState(sat, simTime);
    satMeshes[i].position.set(st.x, st.y, st.z);
    satMeshes[i].lookAt(0, 0, 0);
    satMeshes[i].scale.setScalar(i === displayState.selectedSatIndex ? 2 : 1);

    if (i < coverageCones.length && displayState.showCoverage) {
      const dir = new THREE.Vector3(st.x, st.y, st.z).normalize();
      coverageCones[i].position.copy(dir.clone().multiplyScalar(1.001));
      coverageCones[i].lookAt(0, 0, 0);
      coverageCones[i].rotateX(Math.PI);
    }
  });
}

export function getSatMeshes() { return satMeshes; }
export function getOrbitLines() { return orbitLines; }
export function getCoverageCones() { return coverageCones; }
