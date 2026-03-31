/**
 * i18n.ts — Multilingual support (Russian / English).
 * Provides translation strings and a language store.
 */

export type Lang = 'ru' | 'en';

export const translations = {
  // Header
  'header.subtitle': {
    ru: 'ЦИФРОВОЙ ДВОЙНИК ГРУППИРОВКИ',
    en: 'CONSTELLATION DIGITAL TWIN',
  },
  'header.utc': { ru: 'UTC', en: 'UTC' },
  'header.spacecraft': { ru: 'КА', en: 'S/C' },
  'header.speed': { ru: 'Скорость', en: 'Speed' },
  'header.isl': { ru: 'МСС', en: 'ISL' },
  'header.status': { ru: 'Статус', en: 'Status' },
  'header.online': { ru: 'ОНЛАЙН', en: 'ONLINE' },

  // Control Panel
  'control.title': { ru: 'Управление', en: 'Controls' },
  'control.simSpeed': { ru: 'Скорость симуляции', en: 'Simulation speed' },
  'control.satCount': { ru: 'Количество спутников', en: 'Satellite count' },
  'control.orbitAlt': { ru: 'Высота орбиты', en: 'Orbit altitude' },
  'control.realTLE': { ru: 'реальные TLE', en: 'real TLE' },
  'control.orbitalPlanes': { ru: 'Орбитальные плоскости', en: 'Orbital planes' },
  'control.commRange': { ru: 'Дальность связи', en: 'Communication range' },
  'control.orbitalTracks': { ru: 'Орбитальные треки', en: 'Orbital tracks' },
  'control.satLabels': { ru: 'Подписи спутников', en: 'Satellite labels' },
  'control.islLinks': { ru: 'Линии связи (МСС)', en: 'ISL links' },
  'control.coverageZones': { ru: 'Зоны покрытия', en: 'Coverage zones' },
  'control.constellations': { ru: 'Группировки', en: 'Constellations' },
  'control.reset': { ru: 'Сбросить вид', en: 'Reset view' },
  'control.circularOrbits': { ru: 'Круговые орбиты', en: 'Circular orbits' },
  'control.scPerPlane': { ru: 'КА/плоскость', en: 'S/C per plane' },
  'control.plane_one': { ru: 'плоскость', en: 'plane' },
  'control.plane_few': { ru: 'плоскости', en: 'planes' },
  'control.plane_many': { ru: 'плоскостей', en: 'planes' },

  // Satellite Info Panel
  'info.active': { ru: 'Активен', en: 'Active' },
  'info.inactive': { ru: 'Неактивен', en: 'Inactive' },
  'info.telemetry': { ru: 'Телеметрия', en: 'Telemetry' },
  'info.altitude': { ru: 'Высота', en: 'Altitude' },
  'info.velocity': { ru: 'Скорость', en: 'Velocity' },
  'info.period': { ru: 'Период', en: 'Period' },
  'info.latitude': { ru: 'Широта', en: 'Latitude' },
  'info.longitude': { ru: 'Долгота', en: 'Longitude' },
  'info.eciCoords': { ru: 'ECI координаты (км)', en: 'ECI coordinates (km)' },
  'info.metadata': { ru: 'Информация', en: 'Information' },
  'info.noradId': { ru: 'NORAD ID', en: 'NORAD ID' },
  'info.constellation': { ru: 'Группировка', en: 'Constellation' },
  'info.purpose': { ru: 'Назначение', en: 'Purpose' },
  'info.launch': { ru: 'Запуск', en: 'Launch' },
  'info.focusCamera': { ru: 'Навести камеру', en: 'Focus camera' },

  // StarAI Chat
  'chat.analyzing': { ru: 'Анализирую...', en: 'Analyzing...' },
  'chat.ready': { ru: 'Готов помочь', en: 'Ready to help' },
  'chat.intro': {
    ru: 'Я StarAI — интеллектуальный ассистент StarVision.',
    en: 'I am StarAI — StarVision intelligent assistant.',
  },
  'chat.introSub': {
    ru: 'Спроси о спутниках или управляй визуализацией.',
    en: 'Ask about satellites or control the visualization.',
  },
  'chat.placeholder': { ru: 'Спроси StarAI...', en: 'Ask StarAI...' },
  'chat.error': {
    ru: 'Ошибка связи с сервером. Попробуйте позже.',
    en: 'Server connection error. Please try again later.',
  },
  'chat.actionDone_one': { ru: 'действие выполнено', en: 'action executed' },
  'chat.actionDone_many': { ru: 'действий выполнено', en: 'actions executed' },
  'chat.hint1': { ru: 'Расскажи про Сферу', en: 'Tell me about Sfera' },
  'chat.hint2': { ru: 'Покажи Гонец-М', en: 'Show Gonets-M' },
  'chat.hint3': { ru: 'Ускорь время в 50 раз', en: 'Speed up time 50x' },
  'chat.hint4': { ru: 'Сколько активных связей?', en: 'How many active links?' },
  'chat.hint5': { ru: 'Покажи все орбиты', en: 'Show all orbits' },
  'chat.hint6': { ru: 'Установи 10 спутников', en: 'Set 10 satellites' },

  // ISL tooltip
  'isl.distance': { ru: 'км', en: 'km' },

  // Constellation names
  'constellation.sfera': { ru: 'Сфера', en: 'Sfera' },
  'constellation.gonets': { ru: 'Гонец', en: 'Gonets' },
  'constellation.educational': { ru: 'Образовательные', en: 'Educational' },
  'constellation.dzz': { ru: 'ДЗЗ', en: 'EO' },
  'constellation.scientific': { ru: 'Научные', en: 'Scientific' },
  'constellation.mipt': { ru: 'МФТИ', en: 'MIPT' },
  'constellation.bauman': { ru: 'МГТУ им. Баумана', en: 'Bauman MSTU' },
} as const;

export type TranslationKey = keyof typeof translations;

// Constellation key mapping (internal Russian name -> i18n key)
export const CONSTELLATION_KEYS: Record<string, string> = {
  'Сфера': 'constellation.sfera',
  'Гонец': 'constellation.gonets',
  'Образовательные': 'constellation.educational',
  'ДЗЗ': 'constellation.dzz',
  'Научные': 'constellation.scientific',
  'МФТИ': 'constellation.mipt',
  'МГТУ им. Баумана': 'constellation.bauman',
};

// Reverse mapping: get internal name from localized display name
export function getInternalConstellationName(displayName: string, lang: Lang): string {
  for (const [internal, key] of Object.entries(CONSTELLATION_KEYS)) {
    const tKey = key as TranslationKey;
    if (translations[tKey][lang] === displayName) return internal;
  }
  return displayName;
}

export function t(key: TranslationKey, lang: Lang): string {
  return translations[key]?.[lang] ?? key;
}

// Translate constellation internal name to display name
export function tConstellation(internalName: string, lang: Lang): string {
  const key = CONSTELLATION_KEYS[internalName] as TranslationKey | undefined;
  if (key && translations[key]) return translations[key][lang];
  return internalName;
}
