/**
 * simClock.ts — Shared simulation clock.
 * Single source of truth for simulation time across all 3D components.
 */

let _simTime = Date.now();

export function getSimTime(): number {
  return _simTime;
}

export function advanceSimTime(deltaMs: number): void {
  _simTime += deltaMs;
}

export function resetSimTime(): void {
  _simTime = Date.now();
}
