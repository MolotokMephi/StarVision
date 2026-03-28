/**
 * @file config.js
 * @description Реактивная конфигурация созвездия и состояния симуляции.
 * При изменении параметров диспатчится событие 'config-changed'.
 */

/** Конфигурация Walker-delta созвездия */
const config = {
  planes: 6,
  satsPerPlane: 8,
  altitude: 550,          // км
  inclination: 97.6,      // градусы (ССО)
  eccentricity: 0.001,
  solarPower: 7.0,        // Вт — солнечные панели
  payloadPower: 3.0,      // Вт — полезная нагрузка
};

/** Состояние симуляции */
const simState = {
  simTime: Date.now(),
  simSpeed: 10,
  paused: false,
};

/** Параметры отображения */
const displayState = {
  showOrbits: true,
  showCoverage: false,
  showGS: true,
  selectedSatIndex: -1,
};

/**
 * Обновить значение конфигурации и отправить событие.
 * @param {string} key   — ключ в объекте config
 * @param {*}      value — новое значение
 */
export function updateConfig(key, value) {
  if (key in config) {
    config[key] = value;
    window.dispatchEvent(
      new CustomEvent('config-changed', { detail: { key, value } })
    );
  }
}

/** @returns {Readonly<typeof config>} */
export function getConfig() {
  return { ...config };
}

/** @returns {typeof simState} */
export function getSimState() {
  return simState;
}

/** @returns {typeof displayState} */
export function getDisplayState() {
  return displayState;
}

export { config, simState, displayState };
