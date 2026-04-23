import { useEffect, useMemo, useCallback, useRef } from 'react';
import { Scene3D } from './components/Scene3D';
import { ControlPanel } from './components/ControlPanel';
import { SatelliteInfoPanel } from './components/SatelliteInfoPanel';
import { StarAIChat } from './components/StarAIChat';
import { Header } from './components/Header';
import { ErrorBanner } from './components/ErrorBanner';
import { useStore } from './hooks/useStore';
import {
  fetchSatellites, fetchPositions, fetchOrbitPath, fetchTLE, fetchHealth,
  ApiError,
} from './services/api';
import { getSimTime } from './simClock';
import { selectRealSatellites } from './selection';
import { formatBackendError } from './errors';
import type { BackendHealth } from './types';

const HEALTH_POLL_MS = 20_000;

export default function App() {
  const {
    satellites, setSatellites,
    positions, setPositions,
    orbitPaths, setOrbitPath,
    tleData, setTleData,
    timeSpeed,
    selectedSatellite,
    activeLinksCount,
    satelliteCount,
    orbitAltitudeKm,
    activeConstellations,
    tleSource,
    setHealth,
    setUserError,
    lang,
  } = useStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load satellite list (once)
  useEffect(() => {
    fetchSatellites()
      .then((res) => setSatellites(res.satellites))
      .catch((err: ApiError) => {
        console.error('Satellite fetch error:', err);
        setUserError(
          lang === 'en'
            ? `Catalog fetch failed: ${err.detail || err.message}`
            : `Не удалось загрузить каталог: ${err.detail || err.message}`,
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load TLE for client-side SGP4 (respects selected source)
  useEffect(() => {
    fetchTLE(tleSource)
      .then((res) => {
        setTleData(res.tle_data, res.meta);
        if (res.meta?.fallback) {
          const reason = formatBackendError(res.meta.error, lang)
            || (lang === 'en' ? 'CelesTrak unavailable' : 'CelesTrak недоступен');
          setUserError(
            lang === 'en' ? `TLE fallback: ${reason}` : `TLE-запаска: ${reason}`,
          );
        }
      })
      .catch((err: ApiError) => {
        console.error('TLE fetch error:', err);
        setUserError(
          lang === 'en'
            ? `TLE fetch failed: ${err.detail || err.message}`
            : `Не удалось загрузить TLE: ${err.detail || err.message}`,
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tleSource]);

  // Health polling: drives the real ONLINE / DEGRADED / OFFLINE indicator.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const h = await fetchHealth();
        if (cancelled) return;
        const health: BackendHealth = {
          status: h.status,
          reasons: h.reasons,
          timestamp: h.timestamp,
          checked_at: Date.now(),
          error: null,
        };
        setHealth(health);
      } catch (err) {
        if (cancelled) return;
        setHealth({
          status: 'offline',
          reasons: ['unreachable'],
          timestamp: null,
          checked_at: Date.now(),
          error: (err as Error)?.message || 'unreachable',
        });
      }
    };
    run();
    const id = setInterval(run, HEALTH_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [setHealth]);

  // Load positions (periodic — fallback for info panel)
  // Use simulated time to stay in sync with the 3D scene
  const loadPositions = useCallback(async () => {
    try {
      const simTimestamp = new Date(getSimTime()).toISOString();
      const res = await fetchPositions(simTimestamp, tleSource);
      setPositions(res.positions);
    } catch (err) {
      // Position polling failures are not fatal (client-side SGP4 keeps
      // running) but must not be silent — surface once.
      console.error('Position fetch error:', err);
      const msg = (err as ApiError)?.detail || (err as Error)?.message || 'unknown';
      setUserError(
        lang === 'en'
          ? `Position poll failed: ${msg}`
          : `Опрос позиций не удался: ${msg}`,
      );
    }
  }, [tleSource, setPositions, setUserError, lang]);

  useEffect(() => {
    loadPositions();
    // Slow polling — client-side SGP4 provides smooth animation
    // Minimum interval increased to reduce backend load
    const ms = Math.max(5000, 10000 / timeSpeed);
    intervalRef.current = setInterval(loadPositions, ms);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timeSpeed, loadPositions]);

  // Load orbit when a satellite is selected (skip virtual NORAD 90000+).
  // Archival satellites are rejected by the backend (409) — show the user
  // why instead of silently dropping the request.
  useEffect(() => {
    if (!selectedSatellite || selectedSatellite >= 90000) return;
    if (orbitPaths[selectedSatellite]) return;
    const sat = satellites.find((s) => s.norad_id === selectedSatellite);
    if (sat && sat.operational === false) return;
    fetchOrbitPath(selectedSatellite, 180, 60, tleSource)
      .then((res) => setOrbitPath(res.norad_id, res.path))
      .catch((err: ApiError) => {
        console.error('Orbit fetch error:', err);
        if (err.status !== 409) {
          setUserError(
            lang === 'en'
              ? `Orbit fetch failed: ${err.detail || err.message}`
              : `Ошибка загрузки орбиты: ${err.detail || err.message}`,
          );
        }
      });
  }, [selectedSatellite, tleSource, satellites, orbitPaths, setOrbitPath, setUserError, lang]);

  // Preload orbits for all operational satellites (batches of 4 to reduce load)
  useEffect(() => {
    if (satellites.length === 0) return;
    let cancelled = false;
    const operational = satellites.filter((s) => s.operational);
    const loadBatched = async () => {
      const batchSize = 4;
      for (let i = 0; i < operational.length; i += batchSize) {
        if (cancelled) return;
        const batch = operational.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map((sat) =>
            fetchOrbitPath(sat.norad_id, 120, 60, tleSource)
              .then((res) => setOrbitPath(res.norad_id, res.path))
          )
        );
      }
    };
    loadBatched();
    return () => { cancelled = true; };
  }, [satellites, tleSource, setOrbitPath]);

  // Map norad_id → constellation
  const satelliteConstellations = useMemo(() => {
    const map: Record<number, string> = {};
    satellites.forEach((s) => (map[s.norad_id] = s.constellation));
    return map;
  }, [satellites]);

  // Operational positions only — backend already filters archival sats
  // out, but we guard locally so the counters never claim a deorbited
  // spacecraft is "live".
  const operationalPositions = useMemo(() => {
    const ok = new Set(satellites.filter((s) => s.operational).map((s) => s.norad_id));
    return positions.filter((p) => ok.has(p.norad_id));
  }, [positions, satellites]);

  // Unified selection — the same function Satellites/ISL/Coverage use.
  // `displayedCount` = what the scene actually renders. `activeCount` =
  // operational spacecraft within that set. They are equal by construction
  // now (archival sats are filtered upstream), but we keep both so the
  // header can distinguish "11/14" (virtual-mode subsample) from
  // "14/14" (all operational shown).
  const displayedCount = useMemo(() => {
    if (orbitAltitudeKm > 0) {
      return satelliteCount; // virtual mode: exactly what we render
    }
    return selectRealSatellites(
      operationalPositions,
      satelliteCount,
      activeConstellations,
      satelliteConstellations,
    ).length;
  }, [orbitAltitudeKm, satelliteCount, activeConstellations, operationalPositions, satelliteConstellations]);

  return (
    <div className="relative w-full h-full">
      {/* 3D Canvas */}
      <Scene3D
        positions={operationalPositions}
        tleData={tleData}
        orbitPaths={orbitPaths}
        satelliteConstellations={satelliteConstellations}
      />

      {/* Header */}
      <Header
        satelliteCount={displayedCount}
        activeCount={displayedCount}
        timeSpeed={timeSpeed}
        activeLinksCount={activeLinksCount}
      />

      {/* Error banner */}
      <ErrorBanner />

      {/* UI Panels */}
      <ControlPanel />
      <SatelliteInfoPanel satellites={satellites} positions={operationalPositions} />
      <StarAIChat />

    </div>
  );
}
