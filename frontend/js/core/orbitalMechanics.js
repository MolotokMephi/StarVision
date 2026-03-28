/**
 * @file orbitalMechanics.js
 * @description Модуль орбитальной механики — кеплерово движение, J2-возмущения,
 * преобразование координат, модели покрытия и энергетики.
 */

import { MU, R_EARTH, R_EARTH_M, J2, DEG, RAD } from './constants.js';

/* ------------------------------------------------------------------ */
/*  Основные орбитальные параметры                                     */
/* ------------------------------------------------------------------ */

/** Орбитальный период, с  @param {number} a_km — большая полуось, км */
export function orbitalPeriod(a_km) {
  const a = a_km * 1000;
  return 2 * Math.PI * Math.sqrt((a * a * a) / MU);
}

/** Орбитальная скорость, м/с */
export function orbitalVelocity(a_km) {
  return Math.sqrt(MU / (a_km * 1000));
}

/** Среднее движение, рад/с */
export function meanMotion(a_km) {
  return (2 * Math.PI) / orbitalPeriod(a_km);
}

/* ------------------------------------------------------------------ */
/*  J2-возмущения (вековые)                                            */
/* ------------------------------------------------------------------ */

/**
 * Скорость прецессии RAAN (Ω̇), рад/с.
 * Формула: -3/2 * n * J2 * (Re/a)^2 * cos(i) / (1-e²)²
 */
export function raanPrecessionRate(a_km, inc, ecc) {
  const a = a_km * 1000;
  const n = meanMotion(a_km);
  const cosi = Math.cos(inc * DEG);
  const p = (1 - ecc * ecc);
  return (-1.5 * n * J2 * (R_EARTH_M / a) ** 2 * cosi) / (p * p);
}

/**
 * Скорость прецессии аргумента перигея (ω̇), рад/с.
 */
export function argPPrecessionRate(a_km, inc, ecc) {
  const a = a_km * 1000;
  const n = meanMotion(a_km);
  const sini = Math.sin(inc * DEG);
  const p = (1 - ecc * ecc);
  return (1.5 * n * J2 * (R_EARTH_M / a) ** 2 * (2 - 2.5 * sini * sini)) / (p * p);
}

/* ------------------------------------------------------------------ */
/*  Решение задачи Кеплера                                             */
/* ------------------------------------------------------------------ */

/**
 * Решение уравнения Кеплера методом Ньютона.
 * @param {number} M — средняя аномалия, рад
 * @param {number} e — эксцентриситет
 * @returns {number} E — эксцентрическая аномалия, рад
 */
export function solveKepler(M, e) {
  let E = M;
  for (let i = 0; i < 50; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

/** Истинная аномалия из эксцентрической */
export function trueAnomaly(E, e) {
  return 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2)
  );
}

/* ------------------------------------------------------------------ */
/*  Преобразование координат                                           */
/* ------------------------------------------------------------------ */

/**
 * Кеплеровы элементы → ECI (м).
 * @returns {{ x: number, y: number, z: number, r: number }}
 */
export function keplerToECI(a, e, inc, raan, argp, nu) {
  const p = a * (1 - e * e);
  const r = p / (1 + e * Math.cos(nu));

  // Координаты в орбитальной плоскости
  const xOrb = r * Math.cos(nu);
  const yOrb = r * Math.sin(nu);

  const ci = Math.cos(inc);
  const si = Math.sin(inc);
  const cO = Math.cos(raan);
  const sO = Math.sin(raan);
  const cw = Math.cos(argp);
  const sw = Math.sin(argp);

  const x = (cO * cw - sO * sw * ci) * xOrb + (-cO * sw - sO * cw * ci) * yOrb;
  const y = (sO * cw + cO * sw * ci) * xOrb + (-sO * sw + cO * cw * ci) * yOrb;
  const z = (sw * si) * xOrb + (cw * si) * yOrb;

  return { x, y, z, r };
}

/**
 * Угол вращения Земли (GMST), рад.
 * Формула IAU: θ = 2π(0.7790572732640 + 1.00273781191135448 · du)
 * @param {number} t — Unix timestamp, мс
 */
export function earthRotationAngle(t) {
  const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  const du = (t - J2000) / 86400000; // дни от J2000.0
  const angle = 2 * Math.PI * (0.7790572732640 + 1.00273781191135448 * du);
  return angle % (2 * Math.PI);
}

/**
 * ECI → географические координаты (широта/долгота).
 * @param {number} t — Unix timestamp, мс
 * @returns {{ lat: number, lon: number }} градусы
 */
export function eciToLatLon(x, y, z, t) {
  const r = Math.sqrt(x * x + y * y + z * z);
  const lat = Math.asin(z / r) * RAD;
  const gmst = earthRotationAngle(t);
  let lon = (Math.atan2(y, x) - gmst) * RAD;
  lon = ((lon + 540) % 360) - 180;
  return { lat, lon };
}

/* ------------------------------------------------------------------ */
/*  Модели радиолиний и покрытия                                       */
/* ------------------------------------------------------------------ */

/** Потери в свободном пространстве, дБ. @param d м, @param f Гц */
export function pathLossCalc(d, f) {
  return 20 * Math.log10(d) + 20 * Math.log10(f) - 147.55;
}

/** Угол покрытия на поверхности, рад. @param alt км, @param minEl градусы */
export function coverageAngle(alt, minEl = 10) {
  const re = R_EARTH;
  const sinRho = re / (re + alt);
  const eta = Math.acos(sinRho * Math.cos(minEl * DEG));
  return Math.PI / 2 - minEl * DEG - eta;
}

/**
 * Оценка покрытия по модели Пуассона (доля поверхности).
 */
export function estimateCoverage(planes, spp, alt, inc) {
  const nSat = planes * spp;
  const lambda = coverageAngle(alt);
  const capArea = 2 * Math.PI * (1 - Math.cos(lambda));
  const density = nSat * capArea / (4 * Math.PI);
  return 1 - Math.exp(-density);
}

/** Доля орбиты в тени Земли (приближение цилиндрической тени). */
export function shadowFraction(a) {
  const sinBeta = R_EARTH / a;
  return Math.asin(sinBeta) / Math.PI;
}
