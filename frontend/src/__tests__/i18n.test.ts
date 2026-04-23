import { describe, it, expect } from 'vitest';
import {
  translations,
  t,
  tConstellation,
  getInternalConstellationName,
  CONSTELLATION_KEYS,
} from '../i18n';
import type { Lang, TranslationKey } from '../i18n';

describe('i18n', () => {
  describe('translations object', () => {
    it('every key has both ru and en', () => {
      for (const value of Object.values(translations)) {
        expect(value).toHaveProperty('ru', expect.any(String));
        expect(value).toHaveProperty('en', expect.any(String));
      }
    });

    it('no empty translations', () => {
      for (const value of Object.values(translations)) {
        expect(value.ru.length).toBeGreaterThan(0);
        expect(value.en.length).toBeGreaterThan(0);
      }
    });
  });

  describe('t() function', () => {
    it('returns Russian translation', () => {
      expect(t('control.title', 'ru')).toBe('Управление');
    });

    it('returns English translation', () => {
      expect(t('control.title', 'en')).toBe('Controls');
    });

    it('returns key for unknown key', () => {
      expect(t('nonexistent.key' as TranslationKey, 'ru')).toBe('nonexistent.key');
    });
  });

  describe('tConstellation()', () => {
    it('translates Russian constellation names to English', () => {
      expect(tConstellation('УниверСат', 'en')).toBe('UniverSat');
      expect(tConstellation('МГТУ Баумана', 'en')).toBe('Bauman MSTU');
    });

    it('keeps Russian names in Russian mode', () => {
      expect(tConstellation('УниверСат', 'ru')).toBe('УниверСат');
    });

    it('returns original name for unknown constellation', () => {
      expect(tConstellation('Unknown', 'en')).toBe('Unknown');
    });
  });

  describe('CONSTELLATION_KEYS', () => {
    it('has 6 entries', () => {
      expect(Object.keys(CONSTELLATION_KEYS)).toHaveLength(6);
    });

    it('all values are valid translation keys', () => {
      for (const key of Object.values(CONSTELLATION_KEYS)) {
        expect(translations).toHaveProperty(key);
      }
    });
  });

  describe('getInternalConstellationName()', () => {
    it('maps English display name to internal name', () => {
      expect(getInternalConstellationName('UniverSat', 'en')).toBe('УниверСат');
      expect(getInternalConstellationName('Bauman MSTU', 'en')).toBe('МГТУ Баумана');
    });

    it('maps Russian display name to internal name', () => {
      expect(getInternalConstellationName('УниверСат', 'ru')).toBe('УниверСат');
    });

    it('returns input if not found', () => {
      expect(getInternalConstellationName('Unknown', 'en')).toBe('Unknown');
    });
  });
});
