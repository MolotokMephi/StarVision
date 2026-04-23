/**
 * selection.ts — Single source of truth for which satellites are on-screen.
 *
 * Satellites.tsx, InterSatelliteLinks.tsx and CoverageZones.tsx previously
 * each picked a subset with subtly different filtering semantics. When the
 * `satelliteCount` slider, active-constellation toggles or the deorbited
 * catalog entry changed, those views could drift out of sync — the ISL
 * counter would reference a different set of satellites than the markers,
 * coverage zones would appear for missing sats, etc.
 *
 * Use `selectRealSatellites` everywhere to guarantee the same selection.
 */

export interface HasConstellation {
  constellation: string;
}

export interface HasNoradAndConstellation {
  norad_id: number;
}

/**
 * Uniform sub-sampling that preserves the original ordering. For count >=
 * array length returns the input. Never produces duplicates.
 */
export function selectUniformly<T>(arr: T[], count: number): T[] {
  if (count >= arr.length) return arr.slice();
  const step = arr.length / count;
  const out: T[] = new Array(count);
  for (let i = 0; i < count; i++) out[i] = arr[Math.floor(i * step)];
  return out;
}

/**
 * Filter by active constellation (via an id→constellation map), then
 * uniformly downsample to `satelliteCount` items. The same function
 * is called by every view that renders the real-TLE (non-virtual) mode.
 */
export function selectRealSatellites<T extends { norad_id: number; constellation?: string }>(
  items: T[],
  satelliteCount: number,
  activeConstellations: string[],
  constellationById: Record<number, string>,
): T[] {
  const filtered = items.filter((item) => {
    const c = item.constellation || constellationById[item.norad_id];
    return c ? activeConstellations.includes(c) : false;
  });
  return selectUniformly(filtered, satelliteCount);
}
