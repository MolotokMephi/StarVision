/**
 * @file coverageMap.js
 * @description 2D-карта покрытия на canvas (Plate Carrée проекция).
 */

import { getSatState } from '../core/constellation.js';
import { coverageAngle } from '../core/orbitalMechanics.js';
import { RAD } from '../core/constants.js';

/**
 * Отрисовка 2D-карты покрытия.
 * @param {Array} satellites
 * @param {number} simTime — мс
 * @param {object} config
 * @param {Array} groundStations
 */
export function drawCoverageMap(satellites, simTime, config, groundStations) {
  const c = document.getElementById('coverageMap');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width = c.offsetWidth * 2;
  const H = c.height = c.offsetHeight * 2;

  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, W, H);

  // Сетка
  ctx.strokeStyle = 'rgba(56,189,248,0.08)';
  ctx.lineWidth = 0.5;
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * W;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let lat = -90; lat <= 90; lat += 30) {
    const y = ((90 - lat) / 180) * H;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  const ca = coverageAngle(config.altitude, 10) * RAD;

  // Покрытие и спутники
  satellites.forEach(sat => {
    const st = getSatState(sat, simTime);
    const cx = ((st.lon + 180) / 360) * W;
    const cy = ((90 - st.lat) / 180) * H;
    const r = (ca / 180) * H;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${(sat.plane / config.planes) * 360},80%,50%,0.12)`;
    ctx.fill();
  });

  // Наземные станции
  if (groundStations) {
    groundStations.forEach(gs => {
      const cx = ((gs.lon + 180) / 360) * W;
      const cy = ((90 - gs.lat) / 180) * H;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
    });
  }

  // Точки спутников
  satellites.forEach(sat => {
    const st = getSatState(sat, simTime);
    ctx.beginPath();
    ctx.arc(
      ((st.lon + 180) / 360) * W,
      ((90 - st.lat) / 180) * H,
      2.5, 0, Math.PI * 2
    );
    ctx.fillStyle = `hsl(${(sat.plane / config.planes) * 360},80%,60%)`;
    ctx.fill();
  });
}
