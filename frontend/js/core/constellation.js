/**
 * @file constellation.js
 * @description Генератор Walker-delta созвездия и вычисление состояния КА.
 * Наземные станции российского сегмента управления.
 */

import { DEG, SCALE, R_EARTH } from './constants.js';
import {
  meanMotion,
  raanPrecessionRate,
  argPPrecessionRate,
  solveKepler,
  trueAnomaly,
  keplerToECI,
  eciToLatLon,
} from './orbitalMechanics.js';

/**
 * Наземные станции (НС) российского сегмента.
 */
export const groundStations = [
  { name: 'Москва (ЦУП)',  lat: 55.75, lon: 37.62  },
  { name: 'Красноярск',    lat: 56.01, lon: 92.85  },
  { name: 'Хабаровск',     lat: 48.48, lon: 135.08 },
  { name: 'Новосибирск',   lat: 55.03, lon: 82.92  },
  { name: 'Восточный',     lat: 51.88, lon: 128.33 },
];

/**
 * Генерация Walker-delta созвездия.
 * @param {object} cfg — конфигурация из config.js
 * @returns {Array<object>} массив спутников с начальными элементами
 */
export function generateConstellation(cfg) {
  const {
    planes,
    satsPerPlane,
    altitude,
    inclination,
    eccentricity,
  } = cfg;

  const a_km = R_EARTH + altitude;
  const n = meanMotion(a_km);
  const satellites = [];

  for (let p = 0; p < planes; p++) {
    const raan0 = (2 * Math.PI * p) / planes;

    for (let s = 0; s < satsPerPlane; s++) {
      // Фазовый сдвиг Walker-delta: f = 1 (типичное значение)
      const M0 = (2 * Math.PI * s) / satsPerPlane
                + (2 * Math.PI * p) / (planes * satsPerPlane);

      const name = `СК-${String(p + 1).padStart(2, '0')}${String(s + 1).padStart(2, '0')}`;
      satellites.push({
        id: p * satsPerPlane + s,
        name,
        plane: p,
        index: s,
        a_km,
        ecc: eccentricity,
        inc: inclination * DEG,      // рад
        raan0,                        // рад
        argp0: 0,                     // рад
        M0,                           // рад
        n,                            // рад/с
        epoch: Date.now(),            // мс
        // Скорости J2-прецессии
        raanDot: raanPrecessionRate(a_km, inclination, eccentricity),
        argpDot: argPPrecessionRate(a_km, inclination, eccentricity),
      });
    }
  }

  return satellites;
}

/**
 * Вычислить текущее состояние КА.
 * @param {object} sat  — элемент массива из generateConstellation
 * @param {number} t    — Unix timestamp, мс
 * @returns {object} позиция в Three.js координатах + орбитальные элементы
 */
export function getSatState(sat, t) {
  const dt = (t - sat.epoch) / 1000; // секунды от эпохи

  // Текущие кеплеровы элементы с J2
  const raan = sat.raan0 + sat.raanDot * dt;
  const argp = sat.argp0 + sat.argpDot * dt;
  const M = sat.M0 + sat.n * dt;

  // Решение задачи Кеплера
  const E = solveKepler(M % (2 * Math.PI), sat.ecc);
  const nu = trueAnomaly(E, sat.ecc);

  // Позиция в ECI (км)
  const eci = keplerToECI(sat.a_km, sat.ecc, sat.inc, raan, argp, nu);

  // Географические координаты (eciToLatLon работает с любыми единицами)
  const { lat, lon } = eciToLatLon(eci.x, eci.y, eci.z, t);

  // ECI → Three.js: x → x, z → y, -y → z
  return {
    x: eci.x * SCALE,
    y: eci.z * SCALE,
    z: -eci.y * SCALE,
    r: eci.r * SCALE,
    nu, raan, argp, M,
    lat, lon,
    altitude: eci.r - R_EARTH,
  };
}
