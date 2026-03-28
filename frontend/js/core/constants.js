/**
 * @file constants.js
 * @description Физические и графические константы проекта StarVision.
 * Источники: ГОСТ Р 25645.166-2004, NASA GSFC, IAU 2000/2006.
 */

// Гравитационный параметр Земли, м³/с²
export const MU = 3.986004418e14;

// Средний радиус Земли
export const R_EARTH = 6371.0;          // км
export const R_EARTH_M = 6371000.0;     // м

// Коэффициент J2 геоида
export const J2 = 1.08263e-3;

// Преобразование углов
export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

// Масштаб сцены: 1 единица Three.js = 1 радиус Земли
export const SCALE = 1 / R_EARTH;

// Угловая скорость вращения Земли, рад/с
export const EARTH_ROTATION_RATE = 7.2921150e-5;

// Смещение текстуры для совмещения координат
export const TEXTURE_OFFSET = -Math.PI / 2;

// URL текстур Земли
export const TEX = {
  day: 'https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg',
  night: 'https://unpkg.com/three-globe@2.31.1/example/img/earth-night.jpg',
  bump: 'https://unpkg.com/three-globe@2.31.1/example/img/earth-topology.png',
};
