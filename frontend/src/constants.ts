/**
 * constants.ts — Shared constants for constellation data.
 * Single source of truth used by Satellites, ISL, CoverageZones, ControlPanel, etc.
 */

export const CONSTELLATION_COLORS: Record<string, string> = {
  'УниверСат': '#3389ff',
  'МГТУ Баумана': '#33ffaa',
  'SPUTNIX': '#ff9933',
  'Геоскан': '#ff3366',
  'НИИЯФ МГУ': '#aa33ff',
  'Space-Pi': '#ffdd33',
};

export const CONSTELLATION_NAMES = Object.keys(CONSTELLATION_COLORS);

// Model type per constellation (0 = 1U/1.5U, 1 = 3U/6U)
export const CONSTELLATION_MODEL_TYPE: Record<string, number> = {
  'УниверСат': 1,
  'МГТУ Баумана': 0,
  'SPUTNIX': 1,
  'Геоскан': 1,
  'НИИЯФ МГУ': 1,
  'Space-Pi': 0,
};
