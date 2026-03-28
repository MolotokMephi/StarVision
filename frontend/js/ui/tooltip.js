/**
 * @file tooltip.js
 * @description Тултип при наведении на спутник в 3D-сцене.
 */

/**
 * Показать тултип рядом с курсором.
 * @param {MouseEvent} event
 * @param {object} sat
 * @param {object} state — {altitude, lat, lon}
 */
export function showTooltip(event, sat, state) {
  const tt = document.getElementById('tooltip');
  if (!tt) return;

  const name = sat.name || `СК-${String(sat.plane + 1).padStart(2, '0')}${String(sat.index + 1).padStart(2, '0')}`;

  document.getElementById('tooltipName').textContent = name;
  document.getElementById('tooltipContent').innerHTML =
    `Плоскость: ${sat.plane + 1} | №${sat.index + 1}<br>` +
    `Высота: ${state.altitude.toFixed(1)} км<br>` +
    `Шир: ${state.lat.toFixed(2)}° Дол: ${state.lon.toFixed(2)}°`;

  tt.style.display = 'block';
  tt.style.left = (event.clientX + 15) + 'px';
  tt.style.top = (event.clientY - 10) + 'px';
}

/** Скрыть тултип */
export function hideTooltip() {
  const tt = document.getElementById('tooltip');
  if (tt) tt.style.display = 'none';
}
