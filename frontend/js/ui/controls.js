/**
 * @file controls.js
 * @description Управление слайдерами, кнопками скорости и переключателями.
 */

let currentSpeed = 10;

/**
 * Инициализация кнопок управления.
 * @param {object} callbacks
 */
export function initControls(callbacks) {
  // Кнопки скорости
  document.querySelectorAll('.speed-btn, [data-speed]').forEach(btn => {
    btn.addEventListener('click', () => {
      const spd = parseFloat(btn.dataset.speed || btn.textContent.replace('×', ''));
      if (!isNaN(spd) && callbacks.onSpeedChange) callbacks.onSpeedChange(spd);
    });
  });

  // Пауза
  const pauseBtn = document.getElementById('btnPause');
  if (pauseBtn) pauseBtn.addEventListener('click', () => callbacks.onPause?.());

  // Тогглы
  document.getElementById('btnOrbits')?.addEventListener('click', () => callbacks.onToggleOrbits?.());
  document.getElementById('btnCoverage')?.addEventListener('click', () => callbacks.onToggleCoverage?.());
  document.getElementById('btnGS')?.addEventListener('click', () => callbacks.onToggleGS?.());
  document.getElementById('btnReset')?.addEventListener('click', () => callbacks.onResetView?.());
}

/**
 * Привязка слайдеров к конфигурации.
 * Слайдеры в HTML имеют id: planesSlider, satsPerPlaneSlider, altitudeSlider и т.д.
 * Значения отображаются в: planesVal, satsPerPlaneVal, altitudeVal и т.д.
 */
export function bindSliders(config, onConfigChange) {
  const defs = [
    { slider: 'planesSlider', val: 'planesVal', prop: 'planes', fmt: v => v },
    { slider: 'satsPerPlaneSlider', val: 'satsPerPlaneVal', prop: 'satsPerPlane', fmt: v => v },
    { slider: 'altitudeSlider', val: 'altitudeVal', prop: 'altitude', fmt: v => v + ' км' },
    { slider: 'inclinationSlider', val: 'inclinationVal', prop: 'inclination', fmt: v => v + '°' },
    { slider: 'eccentricitySlider', val: 'eccentricityVal', prop: 'eccentricity', fmt: v => parseFloat(v).toFixed(3) },
    { slider: 'solarPowerSlider', val: 'solarPowerVal', prop: 'solarPower', fmt: v => parseFloat(v).toFixed(1) + ' Вт' },
    { slider: 'payloadPowerSlider', val: 'payloadPowerVal', prop: 'payloadPower', fmt: v => parseFloat(v).toFixed(1) + ' Вт' },
  ];

  defs.forEach(({ slider, val, prop, fmt }) => {
    const el = document.getElementById(slider);
    if (!el) return;
    el.addEventListener('input', function () {
      const v = parseFloat(this.value);
      config[prop] = v;
      const valEl = document.getElementById(val);
      if (valEl) valEl.textContent = fmt(v);
      onConfigChange(prop, v);
    });
  });
}

/** Установить скорость симуляции */
export function setSpeed(speed) {
  currentSpeed = speed;
  const ind = document.getElementById('speedIndicator');
  if (ind) ind.textContent = '×' + speed;

  document.querySelectorAll('.speed-btn, [data-speed]').forEach(btn => {
    const s = parseFloat(btn.dataset.speed || btn.textContent.replace('×', ''));
    btn.classList.toggle('active', s === speed);
  });
}
