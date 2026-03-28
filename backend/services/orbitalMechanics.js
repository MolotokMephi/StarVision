/**
 * Модуль орбитальной механики (серверная часть)
 *
 * SGP4-совместимая пропагация орбит, преобразования координат
 * (ECI → ECEF → LLA) и расчёт наземной трассы.
 *
 * Примечание: полная реализация SGP4 требует значительного объёма кода.
 * Здесь представлена упрощённая модель с заглушками для интеграции
 * полноценной библиотеки (например, satellite.js).
 */

// ========================================================
//  Физические константы
// ========================================================

/** Гравитационный параметр Земли, км³/с² */
const MU = 398600.4418;

/** Вторая зональная гармоника гравитационного поля (сжатие Земли) */
const J2 = 1.08263e-3;

/** Экваториальный радиус Земли, км */
const R_EARTH = 6378.137;

/** Полярный радиус Земли, км */
const R_POLAR = 6356.752;

/** Угловая скорость вращения Земли, рад/с */
const OMEGA_EARTH = 7.2921151467e-5;

/** Два пи */
const TWO_PI = 2 * Math.PI;

/** Градусы в радианы */
const DEG_TO_RAD = Math.PI / 180;

/** Радианы в градусы */
const RAD_TO_DEG = 180 / Math.PI;

/** Минут в сутках */
const MINUTES_PER_DAY = 1440;

/** Секунд в сутках */
const SECONDS_PER_DAY = 86400;

// ========================================================
//  SGP4-совместимая пропагация (упрощённая модель)
// ========================================================

/**
 * Упрощённая пропагация орбиты по кеплеровым элементам
 *
 * TODO: заменить на полноценную реализацию SGP4, учитывающую:
 *   - Влияние J2 (сжатие Земли) на RAAN и аргумент перигея
 *   - Атмосферное торможение (BSTAR)
 *   - Лунно-солнечные возмущения
 *   - Резонансные эффекты
 *
 * @param {object} keplerianElements — кеплеровы элементы (из tleToKeplerian)
 * @param {number} minutesSinceEpoch — время с эпохи TLE, минуты
 * @returns {object} позиция в ECI: {x, y, z} в км и скорость {vx, vy, vz} в км/с
 */
function propagate(keplerianElements, minutesSinceEpoch) {
  const {
    semiMajorAxis: a,
    eccentricity: e,
    inclinationRad: i,
    raanRad: Omega0,
    argPerigeeRad: omega0,
    meanAnomalyRad: M0,
    meanMotionRadSec: n
  } = keplerianElements;

  const t = minutesSinceEpoch * 60; // переводим в секунды

  // --- Учёт J2-возмущений (прецессия узлов и перигея) ---
  const p = a * (1 - e * e);
  const cosI = Math.cos(i);
  const sinI = Math.sin(i);

  // Скорость прецессии RAAN (долгота восходящего узла), рад/с
  const OmegaDot = -1.5 * n * J2 * (R_EARTH / p) ** 2 * cosI;

  // Скорость прецессии аргумента перигея, рад/с
  const omegaDot = 0.75 * n * J2 * (R_EARTH / p) ** 2 * (5 * cosI * cosI - 1);

  // Текущие значения с учётом прецессии
  const Omega = Omega0 + OmegaDot * t;
  const omega = omega0 + omegaDot * t;

  // Средняя аномалия в текущий момент
  const M = M0 + n * t;

  // --- Решение уравнения Кеплера (итерационный метод Ньютона) ---
  const E = solveKepler(M, e);

  // Истинная аномалия
  const sinNu = (Math.sqrt(1 - e * e) * Math.sin(E)) / (1 - e * Math.cos(E));
  const cosNu = (Math.cos(E) - e) / (1 - e * Math.cos(E));
  const nu = Math.atan2(sinNu, cosNu);

  // Расстояние от центра Земли
  const r = a * (1 - e * Math.cos(E));

  // Аргумент широты
  const u = omega + nu;

  // --- Позиция в ECI (Earth-Centered Inertial) ---
  const cosOmega = Math.cos(Omega);
  const sinOmega = Math.sin(Omega);
  const cosU = Math.cos(u);
  const sinU = Math.sin(u);

  const x = r * (cosOmega * cosU - sinOmega * sinU * cosI);
  const y = r * (sinOmega * cosU + cosOmega * sinU * cosI);
  const z = r * (sinU * sinI);

  // --- Скорость в ECI (упрощённо, без J2-коррекций скорости) ---
  const pParam = a * (1 - e * e);
  const hMag = Math.sqrt(MU * pParam);
  const rDot = (hMag / pParam) * e * Math.sin(nu);
  const ruDot = hMag / r;

  const vx = rDot * (cosOmega * cosU - sinOmega * sinU * cosI)
           - ruDot * (cosOmega * sinU + sinOmega * cosU * cosI);
  const vy = rDot * (sinOmega * cosU + cosOmega * sinU * cosI)
           - ruDot * (sinOmega * sinU - cosOmega * cosU * cosI);
  const vz = rDot * sinU * sinI + ruDot * cosU * sinI;

  return {
    position: { x, y, z },       // км, ECI
    velocity: { vx, vy, vz }     // км/с, ECI
  };
}

/**
 * Решение уравнения Кеплера методом Ньютона
 * M = E - e * sin(E)
 *
 * @param {number} M — средняя аномалия, рад
 * @param {number} e — эксцентриситет
 * @param {number} tolerance — точность, рад (по умолчанию 1e-10)
 * @returns {number} эксцентрическая аномалия E, рад
 */
function solveKepler(M, e, tolerance = 1e-10) {
  // Начальное приближение
  let E = M;
  if (e > 0.8) {
    E = Math.PI; // для высокоэксцентрических орбит
  }

  const maxIterations = 50;
  for (let iter = 0; iter < maxIterations; iter++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < tolerance) break;
  }

  return E;
}

// ========================================================
//  Преобразования координат
// ========================================================

/**
 * Преобразование из ECI (Earth-Centered Inertial) в ECEF (Earth-Centered Earth-Fixed)
 *
 * Учитывает вращение Земли с момента эпохи.
 *
 * @param {object} eciPos — позиция в ECI: {x, y, z} в км
 * @param {number} gmst — Гринвичское звёздное время, рад
 * @returns {object} позиция в ECEF: {x, y, z} в км
 */
function eciToEcef(eciPos, gmst) {
  const cosG = Math.cos(gmst);
  const sinG = Math.sin(gmst);

  return {
    x:  eciPos.x * cosG + eciPos.y * sinG,
    y: -eciPos.x * sinG + eciPos.y * cosG,
    z:  eciPos.z
  };
}

/**
 * Преобразование из ECEF в геодезические координаты (LLA)
 * Алгоритм Боумана (Bowring) для итеративного вычисления широты
 *
 * @param {object} ecefPos — позиция в ECEF: {x, y, z} в км
 * @returns {object} {lat, lon, alt} — широта (°), долгота (°), высота (км)
 */
function ecefToLLA(ecefPos) {
  const { x, y, z } = ecefPos;

  const a = R_EARTH;
  const b = R_POLAR;
  const e2 = 1 - (b * b) / (a * a);       // квадрат эксцентриситета эллипсоида
  const ep2 = (a * a) / (b * b) - 1;       // квадрат второго эксцентриситета

  const p = Math.sqrt(x * x + y * y);
  const lon = Math.atan2(y, x);

  // Итеративное вычисление широты (метод Боумана)
  let lat = Math.atan2(z, p * (1 - e2));  // начальное приближение
  for (let iter = 0; iter < 10; iter++) {
    const sinLat = Math.sin(lat);
    const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);
    lat = Math.atan2(z + e2 * N * sinLat, p);
  }

  // Высота над эллипсоидом
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const alt = (cosLat !== 0)
    ? p / cosLat - N
    : Math.abs(z) - b;

  return {
    lat: lat * RAD_TO_DEG,
    lon: lon * RAD_TO_DEG,
    alt  // км
  };
}

/**
 * Полное преобразование ECI → ECEF → LLA
 *
 * @param {object} eciPos — позиция в ECI: {x, y, z}
 * @param {Date} date — момент времени (для расчёта GMST)
 * @returns {object} {lat, lon, alt, ecef}
 */
function eciToLLA(eciPos, date) {
  const gmst = calculateGMST(date);
  const ecef = eciToEcef(eciPos, gmst);
  const lla = ecefToLLA(ecef);

  return {
    ...lla,
    ecef
  };
}

// ========================================================
//  Вспомогательные функции
// ========================================================

/**
 * Вычисляет Гринвичское среднее звёздное время (GMST)
 *
 * @param {Date} date — момент времени
 * @returns {number} GMST в радианах
 */
function calculateGMST(date) {
  // Юлианская дата
  const jd = dateToJulian(date);

  // Столетия от эпохи J2000.0
  const T = (jd - 2451545.0) / 36525.0;

  // GMST в секундах (формула IAU)
  let gmstSec = 67310.54841
    + (876600 * 3600 + 8640184.812866) * T
    + 0.093104 * T * T
    - 6.2e-6 * T * T * T;

  // Переводим в радианы (секунды → градусы → радианы)
  let gmst = ((gmstSec % 86400) / 86400) * TWO_PI;

  if (gmst < 0) gmst += TWO_PI;

  return gmst;
}

/**
 * Преобразует Date в юлианскую дату
 *
 * @param {Date} date
 * @returns {number} юлианская дата
 */
function dateToJulian(date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const h = date.getUTCHours();
  const min = date.getUTCMinutes();
  const sec = date.getUTCSeconds();

  const dayFraction = (h + min / 60 + sec / 3600) / 24;

  // Формула юлианской даты
  const a = Math.floor((14 - m) / 12);
  const y1 = y + 4800 - a;
  const m1 = m + 12 * a - 3;

  const jd = d + Math.floor((153 * m1 + 2) / 5)
    + 365 * y1 + Math.floor(y1 / 4)
    - Math.floor(y1 / 100) + Math.floor(y1 / 400)
    - 32045 + dayFraction - 0.5;

  return jd;
}

// ========================================================
//  Расчёт наземной трассы
// ========================================================

/**
 * Рассчитывает наземную трассу спутника (ground track)
 *
 * @param {object} keplerianElements — кеплеровы элементы орбиты
 * @param {Date} startDate — начало расчёта
 * @param {number} durationMinutes — длительность, мин (по умолчанию 1 виток)
 * @param {number} stepMinutes — шаг, мин (по умолчанию 1)
 * @returns {Array<{time, lat, lon, alt}>} массив точек наземной трассы
 */
function calculateGroundTrack(keplerianElements, startDate, durationMinutes, stepMinutes = 1) {
  // Если длительность не задана, рассчитываем один полный виток
  if (!durationMinutes) {
    durationMinutes = keplerianElements.periodMinutes || 90;
  }

  const points = [];
  const steps = Math.floor(durationMinutes / stepMinutes);

  for (let i = 0; i <= steps; i++) {
    const minutesSinceEpoch = i * stepMinutes;
    const currentDate = new Date(startDate.getTime() + minutesSinceEpoch * 60000);

    // Пропагация: получаем ECI-координаты
    const { position } = propagate(keplerianElements, minutesSinceEpoch);

    // Преобразуем в географические координаты
    const lla = eciToLLA(position, currentDate);

    points.push({
      time: currentDate.toISOString(),
      lat: lla.lat,
      lon: lla.lon,
      alt: lla.alt
    });
  }

  return points;
}

/**
 * Вычисляет период обращения по большой полуоси
 *
 * @param {number} semiMajorAxis — большая полуось, км
 * @returns {number} период в секундах
 */
function orbitalPeriod(semiMajorAxis) {
  return TWO_PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / MU);
}

/**
 * Вычисляет круговую орбитальную скорость
 *
 * @param {number} altitude — высота над поверхностью, км
 * @returns {number} скорость, км/с
 */
function circularVelocity(altitude) {
  return Math.sqrt(MU / (R_EARTH + altitude));
}

// ========================================================
//  Экспорт
// ========================================================

module.exports = {
  // Константы
  MU,
  J2,
  R_EARTH,
  R_POLAR,
  OMEGA_EARTH,
  DEG_TO_RAD,
  RAD_TO_DEG,

  // Пропагация
  propagate,
  solveKepler,

  // Преобразования координат
  eciToEcef,
  ecefToLLA,
  eciToLLA,
  calculateGMST,
  dateToJulian,

  // Наземная трасса
  calculateGroundTrack,

  // Утилиты
  orbitalPeriod,
  circularVelocity
};
