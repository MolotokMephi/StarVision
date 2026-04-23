import { describe, it, expect } from 'vitest';
import { selectRealSatellites, selectUniformly } from '../selection';

describe('selectUniformly', () => {
  it('returns the whole array when count >= length', () => {
    expect(selectUniformly([1, 2, 3], 5)).toEqual([1, 2, 3]);
  });

  it('subsamples deterministically', () => {
    const arr = Array.from({ length: 10 }, (_, i) => i);
    const out = selectUniformly(arr, 5);
    expect(out).toHaveLength(5);
    expect(out).toEqual([0, 2, 4, 6, 8]);
  });
});

describe('selectRealSatellites', () => {
  const items = [
    { norad_id: 1, constellation: 'A' },
    { norad_id: 2, constellation: 'A' },
    { norad_id: 3, constellation: 'B' },
    { norad_id: 4, constellation: 'C' },
  ];

  it('filters by active constellation via explicit field', () => {
    const out = selectRealSatellites(items, 10, ['A'], {});
    expect(out.map((i) => i.norad_id)).toEqual([1, 2]);
  });

  it('falls back to id→constellation map when field missing', () => {
    const it2 = [{ norad_id: 1 }, { norad_id: 2 }];
    const map = { 1: 'A', 2: 'B' };
    const out = selectRealSatellites(it2, 10, ['B'], map);
    expect(out.map((i) => i.norad_id)).toEqual([2]);
  });

  it('caps output at satelliteCount and samples uniformly', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      norad_id: 1000 + i,
      constellation: 'A',
    }));
    const out = selectRealSatellites(many, 4, ['A'], {});
    expect(out).toHaveLength(4);
  });

  it('returns empty when no constellation matches', () => {
    const out = selectRealSatellites(items, 10, ['Z'], {});
    expect(out).toEqual([]);
  });
});
