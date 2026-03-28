/**
 * @file groundStations.js
 * @description Рендеринг наземных станций (НС) на поверхности Земли.
 * Станции добавляются как дочерние объекты earthMesh,
 * чтобы автоматически вращаться вместе с Землёй.
 */

import { DEG } from '../core/constants.js';

/** @type {Array<THREE.Mesh>} массив мешей станций */
let stationMeshes = [];

/**
 * Создать маркеры наземных станций как дочерние объекты earthMesh.
 *
 * ВАЖНО: Станции — children earthMesh, поэтому они наследуют
 * вращение Земли. Ручной поворот по GMST не нужен.
 *
 * @param {THREE.Mesh} earthMesh — меш Земли
 * @param {Array<{name:string, lat:number, lon:number}>} stations
 * @returns {Array<THREE.Mesh>}
 */
export function createGroundStations(earthMesh, stations) {
  // Очистить предыдущие маркеры
  stationMeshes.forEach(m => earthMesh.remove(m));
  stationMeshes = [];

  const geo = new THREE.SphereGeometry(0.008, 8, 8);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
  });

  for (const gs of stations) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.stationName = gs.name;

    // Географические координаты → позиция на единичной сфере
    const phi   = (90 - gs.lat) * DEG;
    const theta = (gs.lon + 180) * DEG;

    mesh.position.set(
      1.003 * Math.sin(phi) * Math.sin(theta),
      1.003 * Math.cos(phi),
      1.003 * Math.sin(phi) * Math.cos(theta)
    );

    // Добавляем как child earthMesh — наследует вращение
    earthMesh.add(mesh);
    stationMeshes.push(mesh);
  }

  return stationMeshes;
}

/**
 * Переключить видимость наземных станций.
 * @param {boolean} show
 */
export function toggleGSVisibility(show) {
  stationMeshes.forEach(m => { m.visible = show; });
}

/**
 * Получить массив мешей станций (для raycasting и т.п.).
 * @returns {Array<THREE.Mesh>}
 */
export function getStationMeshes() {
  return stationMeshes;
}
