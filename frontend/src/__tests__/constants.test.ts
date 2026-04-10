import { describe, it, expect } from 'vitest';
import {
  CONSTELLATION_COLORS,
  CONSTELLATION_NAMES,
  CONSTELLATION_MODEL_TYPE,
} from '../constants';

describe('constants', () => {
  describe('CONSTELLATION_COLORS', () => {
    it('has 6 constellations', () => {
      expect(Object.keys(CONSTELLATION_COLORS)).toHaveLength(6);
    });

    it('contains all expected constellations', () => {
      const expected = ['УниверСат', 'МГТУ Баумана', 'SPUTNIX', 'Геоскан', 'НИИЯФ МГУ', 'Space-Pi'];
      for (const name of expected) {
        expect(CONSTELLATION_COLORS).toHaveProperty(name);
      }
    });

    it('all colors are valid hex', () => {
      for (const color of Object.values(CONSTELLATION_COLORS)) {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });
  });

  describe('CONSTELLATION_NAMES', () => {
    it('matches CONSTELLATION_COLORS keys', () => {
      expect(CONSTELLATION_NAMES).toEqual(Object.keys(CONSTELLATION_COLORS));
    });

    it('has 6 entries', () => {
      expect(CONSTELLATION_NAMES).toHaveLength(6);
    });
  });

  describe('CONSTELLATION_MODEL_TYPE', () => {
    it('has entry for every constellation', () => {
      for (const name of CONSTELLATION_NAMES) {
        expect(CONSTELLATION_MODEL_TYPE).toHaveProperty(name);
      }
    });

    it('values are 0 or 1', () => {
      for (const val of Object.values(CONSTELLATION_MODEL_TYPE)) {
        expect([0, 1]).toContain(val);
      }
    });
  });
});
