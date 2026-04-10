import { describe, it, expect, beforeEach } from 'vitest';
import { getSimTime, advanceSimTime, resetSimTime } from '../simClock';

describe('simClock', () => {
  beforeEach(() => {
    resetSimTime();
  });

  it('returns a numeric timestamp', () => {
    const t = getSimTime();
    expect(typeof t).toBe('number');
    expect(t).toBeGreaterThan(0);
  });

  it('advances time by delta', () => {
    const before = getSimTime();
    advanceSimTime(5000);
    const after = getSimTime();
    expect(after - before).toBe(5000);
  });

  it('advances time cumulatively', () => {
    const before = getSimTime();
    advanceSimTime(1000);
    advanceSimTime(2000);
    const after = getSimTime();
    expect(after - before).toBe(3000);
  });

  it('resets to current time', () => {
    advanceSimTime(999999999);
    const beforeReset = getSimTime();
    resetSimTime();
    const afterReset = getSimTime();
    // After reset, time should be close to Date.now() (within 100ms)
    expect(Math.abs(afterReset - Date.now())).toBeLessThan(100);
    // And much less than the pre-reset value
    expect(afterReset).toBeLessThan(beforeReset);
  });
});
