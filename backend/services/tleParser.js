/**
 * Парсер TLE (Two-Line Element Set)
 *
 * Разбирает двухстрочный формат орбитальных элементов NORAD
 * и преобразует их в кеплеровы элементы орбиты.
 *
 * Формат TLE:
 * Строка 1: номер каталога, классификация, COSPAR ID, эпоха, производные среднего движения, BSTAR
 * Строка 2: наклонение, RAAN, эксцентриситет, аргумент перигея, средняя аномалия, среднее движение
 */

// Физические константы
const MU = 398600.4418;        // Гравитационный параметр Земли, км³/с²
const R_EARTH = 6378.137;      // Экваториальный радиус Земли, км
const TWO_PI = 2 * Math.PI;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const MINUTES_PER_DAY = 1440;

/**
 * Парсит две строки TLE в объект орбитальных элементов
 *
 * @param {string} line1 — первая строка TLE
 * @param {string} line2 — вторая строка TLE
 * @returns {object} разобранные элементы
 */
function parseTLE(line1, line2) {
  // Проверка контрольных символов строк
  if (!line1 || !line2) {
    throw new Error('Обе строки TLE обязательны');
  }
  if (line1[0] !== '1' || line2[0] !== '2') {
    throw new Error('Неверный формат TLE: строки должны начинаться с "1" и "2"');
  }

  // --- Разбор строки 1 ---
  const catalogNumber = parseInt(line1.substring(2, 7).trim(), 10);
  const classification = line1.charAt(7);                              // U/C/S
  const intlDesignator = line1.substring(9, 17).trim();                // Международное обозначение (COSPAR ID)

  // Эпоха: год (2 цифры) + дробный день года
  const epochYearRaw = parseInt(line1.substring(18, 20).trim(), 10);
  const epochYear = epochYearRaw >= 57 ? 1900 + epochYearRaw : 2000 + epochYearRaw;
  const epochDay = parseFloat(line1.substring(20, 32).trim());

  // Первая производная среднего движения (ускорение), об/день²
  const meanMotionDot = parseFloat(line1.substring(33, 43).trim());

  // Вторая производная среднего движения (разбор специального формата)
  const meanMotionDDotRaw = line1.substring(44, 52).trim();
  const meanMotionDDot = parseScientificNotation(meanMotionDDotRaw);

  // Коэффициент торможения BSTAR (разбор специального формата)
  const bstarRaw = line1.substring(53, 61).trim();
  const bstar = parseScientificNotation(bstarRaw);

  // Тип эфемерид (обычно 0 — SGP4)
  const ephemerisType = parseInt(line1.charAt(62), 10) || 0;

  // Номер набора элементов
  const elementSetNumber = parseInt(line1.substring(64, 68).trim(), 10);

  // --- Разбор строки 2 ---
  const inclination = parseFloat(line2.substring(8, 16).trim());       // градусы
  const raan = parseFloat(line2.substring(17, 25).trim());             // градусы (долгота восходящего узла)
  const eccentricity = parseFloat('0.' + line2.substring(26, 33).trim()); // десятичная часть
  const argumentOfPerigee = parseFloat(line2.substring(34, 42).trim()); // градусы
  const meanAnomaly = parseFloat(line2.substring(43, 51).trim());      // градусы
  const meanMotion = parseFloat(line2.substring(52, 63).trim());       // оборотов в день
  const revolutionNumber = parseInt(line2.substring(63, 68).trim(), 10);

  // Вычисляем эпоху как объект Date
  const epochDate = epochToDate(epochYear, epochDay);

  return {
    catalogNumber,
    classification,
    intlDesignator,
    epochYear,
    epochDay,
    epochDate,
    meanMotionDot,
    meanMotionDDot,
    bstar,
    ephemerisType,
    elementSetNumber,
    inclination,          // градусы
    raan,                 // градусы
    eccentricity,
    argumentOfPerigee,    // градусы
    meanAnomaly,          // градусы
    meanMotion,           // оборотов в день
    revolutionNumber
  };
}

/**
 * Преобразует разобранный TLE в кеплеровы элементы орбиты
 *
 * @param {object} tle — результат parseTLE()
 * @returns {object} кеплеровы элементы с физическими величинами
 */
function tleToKeplerian(tle) {
  // Среднее движение в рад/с
  const meanMotionRadSec = (tle.meanMotion * TWO_PI) / 86400;

  // Большая полуось из третьего закона Кеплера: a = (μ / n²)^(1/3)
  const semiMajorAxis = Math.pow(MU / (meanMotionRadSec * meanMotionRadSec), 1 / 3);

  // Высота перигея и апогея
  const perigeeAltitude = semiMajorAxis * (1 - tle.eccentricity) - R_EARTH;
  const apogeeAltitude = semiMajorAxis * (1 + tle.eccentricity) - R_EARTH;

  // Период обращения в секундах
  const period = TWO_PI / meanMotionRadSec;

  // Углы в радианах
  const inclinationRad = tle.inclination * DEG_TO_RAD;
  const raanRad = tle.raan * DEG_TO_RAD;
  const argPerigeeRad = tle.argumentOfPerigee * DEG_TO_RAD;
  const meanAnomalyRad = tle.meanAnomaly * DEG_TO_RAD;

  // Скорость на круговой орбите (приближённая, для справки)
  const orbitalVelocity = Math.sqrt(MU / semiMajorAxis);

  return {
    // Исходные элементы (в угловых градусах)
    inclination: tle.inclination,
    raan: tle.raan,
    eccentricity: tle.eccentricity,
    argumentOfPerigee: tle.argumentOfPerigee,
    meanAnomaly: tle.meanAnomaly,

    // Производные величины
    semiMajorAxis,                  // км
    perigeeAltitude,                // км
    apogeeAltitude,                 // км
    period,                         // секунды
    periodMinutes: period / 60,     // минуты
    meanMotionRadSec,               // рад/с
    orbitalVelocity,                // км/с

    // Углы в радианах (для расчётов)
    inclinationRad,
    raanRad,
    argPerigeeRad,
    meanAnomalyRad,

    // Эпоха
    epoch: tle.epochDate,
    bstar: tle.bstar,

    // Тип орбиты (определяем по наклонению и высоте)
    orbitType: classifyOrbit(tle.inclination, semiMajorAxis - R_EARTH)
  };
}

/**
 * Разбирает число в специальном TLE-формате научной записи
 * Пример: " 12345-6" → 0.12345e-6
 *
 * @param {string} str — строка в формате TLE
 * @returns {number}
 */
function parseScientificNotation(str) {
  if (!str || str.trim() === '' || str.trim() === '00000-0') {
    return 0;
  }

  // Формат: знак + мантисса + знак экспоненты + экспонента
  // Пример: " 16717-4" → +0.16717 * 10^-4
  const sign = str[0] === '-' ? -1 : 1;
  const cleaned = str.replace(/^[+\- ]/, '');

  // Ищем знак экспоненты
  const expMatch = cleaned.match(/([+-])(\d)$/);
  if (expMatch) {
    const mantissa = parseFloat('0.' + cleaned.substring(0, cleaned.length - 2).trim());
    const exp = parseInt(expMatch[1] + expMatch[2], 10);
    return sign * mantissa * Math.pow(10, exp);
  }

  return sign * parseFloat('0.' + cleaned);
}

/**
 * Преобразует эпоху TLE (год + дробный день) в объект Date
 *
 * @param {number} year — полный год (например, 2024)
 * @param {number} day — дробный день года (например, 1.5 = 1 января 12:00 UTC)
 * @returns {Date}
 */
function epochToDate(year, day) {
  // 1 января указанного года
  const jan1 = new Date(Date.UTC(year, 0, 1));
  // Добавляем дни (day начинается с 1, поэтому вычитаем 1)
  const ms = jan1.getTime() + (day - 1) * 86400000;
  return new Date(ms);
}

/**
 * Классифицирует тип орбиты по наклонению и высоте
 *
 * @param {number} inclination — наклонение, градусы
 * @param {number} altitude — средняя высота, км
 * @returns {string} тип орбиты
 */
function classifyOrbit(inclination, altitude) {
  if (altitude > 35000 && altitude < 36000) return 'ГСО';           // Геостационарная
  if (inclination > 96 && inclination < 100) return 'ССО';          // Солнечно-синхронная
  if (inclination > 50 && inclination < 55) return 'НОО-средняя';   // НОО (типа МКС)
  if (inclination > 80 && inclination < 100) return 'полярная';     // Полярная
  if (altitude < 2000) return 'НОО';                                 // Низкая околоземная
  if (altitude < 35000) return 'СОО';                                // Средняя околоземная
  return 'прочая';
}

module.exports = {
  parseTLE,
  tleToKeplerian,
  parseScientificNotation,
  epochToDate,
  classifyOrbit
};
