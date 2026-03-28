/**
 * @file telemetry.js
 * @description Отображение телеметрии группировки и выбранного КА, обновление часов.
 */

import { R_EARTH, RAD } from '../core/constants.js';
import {
  orbitalPeriod,
  orbitalVelocity,
  estimateCoverage,
  pathLossCalc,
} from '../core/orbitalMechanics.js';

/** Установить innerHTML элемента по id */
function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * Обновить телеметрию группировки.
 * @param {object} config — конфигурация Walker-delta
 */
export function updateTelemetry(config) {
  const a_km = R_EARTH + config.altitude;
  const T = orbitalPeriod(a_km);
  const V = orbitalVelocity(a_km);
  const cov = estimateCoverage(config.planes, config.satsPerPlane, config.altitude, config.inclination);

  setText('totalSats', String(config.planes * config.satsPerPlane));
  setHtml('periodVal', (T / 60).toFixed(1) + '<span class="telem-unit">мин</span>');
  setHtml('velocityVal', (V / 1000).toFixed(2) + '<span class="telem-unit">км/с</span>');
  setHtml('coverageVal', (cov * 100).toFixed(1) + '<span class="telem-unit">%</span>');
  setHtml('minAltVal', (a_km * (1 - config.eccentricity) - R_EARTH).toFixed(1) + '<span class="telem-unit">км</span>');
  setHtml('maxAltVal', (a_km * (1 + config.eccentricity) - R_EARTH).toFixed(1) + '<span class="telem-unit">км</span>');

  // Бюджет радиолинии (UHF 437 МГц)
  // pathLossCalc ожидает метры и Гц
  const pl = pathLossCalc(config.altitude * 1000, 437e6);
  setText('pathLoss', pl.toFixed(1) + ' дБ');
  // SNR = Ptx(dBW) + Gtx(dBi) - FSPL + G/T - k - 10log10(BW)
  const snr = (10 * Math.log10(1) + 2.1 - pl + 10 + 228.6 - 10 * Math.log10(290) - 10 * Math.log10(9600));
  setText('snrVal', snr.toFixed(1) + ' дБ');

  setText('activeSatsBadge', `${config.planes * config.satsPerPlane}/${config.planes * config.satsPerPlane}`);
}

/**
 * Обновить телеметрию выбранного КА.
 * @param {object} sat — объект спутника
 * @param {object} state — текущее состояние {nu, raan, argp, lat, lon, altitude}
 * @param {object} config — конфигурация
 */
export function updateSelectedSatTelemetry(sat, state, config) {
  const a_km = R_EARTH + config.altitude;
  const T = orbitalPeriod(a_km);
  const V = orbitalVelocity(a_km);

  setText('selSMA', a_km.toFixed(1) + ' км');
  setText('selAlt', state.altitude.toFixed(1) + ' км');
  setText('selInc', (sat.inc * RAD).toFixed(2) + '°');
  setText('selRAAN', ((state.raan * RAD % 360 + 360) % 360).toFixed(2) + '°');
  setText('selArgP', ((state.argp * RAD % 360 + 360) % 360).toFixed(2) + '°');
  setText('selTA', ((state.nu * RAD + 360) % 360).toFixed(2) + '°');
  setText('selVel', (V / 1000).toFixed(3) + ' км/с');
  setText('selPeriod', (T / 60).toFixed(1) + ' мин');
  setText('selLat', state.lat.toFixed(3) + '°');
  setText('selLon', state.lon.toFixed(3) + '°');
}

/**
 * Обновить часы UTC и МСК.
 * @param {number} simTime — Unix timestamp, мс
 */
export function updateClocks(simTime) {
  const d = new Date(simTime);
  setText('utcTime', d.toISOString().substr(11, 8));
  setText('mskTime', new Date(d.getTime() + 3 * 3600000).toISOString().substr(11, 8));
  setText('epochTime', d.toISOString().substr(0, 10));
}
