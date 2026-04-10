import { useEffect, useMemo, useCallback, useRef } from 'react';
import { Scene3D } from './components/Scene3D';
import { ControlPanel } from './components/ControlPanel';
import { SatelliteInfoPanel } from './components/SatelliteInfoPanel';
import { StarAIChat } from './components/StarAIChat';
import { Header } from './components/Header';
import { useStore } from './hooks/useStore';
import { fetchSatellites, fetchPositions, fetchOrbitPath, fetchTLE } from './services/api';
import { getSimTime } from './simClock';
import { CONSTELLATION_NAMES } from './constants';

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
  } = useStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load satellite list
  useEffect(() => {
    fetchSatellites()
      .then((res) => setSatellites(res.satellites))
      .catch(console.error);
  }, []);

  // Load TLE for client-side SGP4
  useEffect(() => {
    fetchTLE()
      .then((res) => setTleData(res.tle_data))
      .catch(console.error);
  }, []);

  // Load positions (periodic — fallback for info panel)
  // Use simulated time to stay in sync with the 3D scene
  const loadPositions = useCallback(async () => {
    try {
      const simTimestamp = new Date(getSimTime()).toISOString();
      const res = await fetchPositions(simTimestamp, tleSource);
      setPositions(res.positions);
    } catch (err) {
      console.error('Position fetch error:', err);
    }
  }, [tleSource]);

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

  // Load orbit when a satellite is selected (skip virtual NORAD 90000+)
  useEffect(() => {
    if (selectedSatellite && selectedSatellite < 90000 && !orbitPaths[selectedSatellite]) {
      fetchOrbitPath(selectedSatellite, 180, 60, tleSource)
        .then((res) => setOrbitPath(res.norad_id, res.path))
        .catch(console.error);
    }
  }, [selectedSatellite, tleSource]);

  // Preload orbits for all satellites (batches of 4 to reduce load)
  // Re-fetches when TLE source changes to get correct orbit paths
  useEffect(() => {
    if (satellites.length === 0) return;
    let cancelled = false;
    const loadBatched = async () => {
      const batchSize = 4;
      for (let i = 0; i < satellites.length; i += batchSize) {
        if (cancelled) return;
        const batch = satellites.slice(i, i + batchSize);
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
  }, [satellites, tleSource]);

  // Map norad_id → constellation
  const satelliteConstellations = useMemo(() => {
    const map: Record<number, string> = {};
    satellites.forEach((s) => (map[s.norad_id] = s.constellation));
    return map;
  }, [satellites]);

  // Count displayed satellites based on mode (virtual / real)
  const displayedCount = useMemo(() => {
    if (orbitAltitudeKm > 0) {
      // Virtual mode: all satelliteCount are "active", filtered by constellations
      let count = 0;
      for (let i = 0; i < satelliteCount; i++) {
        if (activeConstellations.includes(CONSTELLATION_NAMES[i % CONSTELLATION_NAMES.length])) count++;
      }
      return count;
    }
    // Real mode: filter by active constellations, then take up to satelliteCount
    const filtered = positions.filter((p) => {
      const c = satelliteConstellations[p.norad_id];
      return activeConstellations.includes(c);
    });
    return Math.min(satelliteCount, filtered.length);
  }, [orbitAltitudeKm, satelliteCount, activeConstellations, positions, satelliteConstellations]);

  const activeCount = useMemo(() => {
    if (orbitAltitudeKm > 0) return displayedCount;
    // In real mode, count active satellites among the displayed set
    const filtered = positions.filter((p) => {
      const c = satelliteConstellations[p.norad_id];
      return activeConstellations.includes(c);
    });
    const displayed = filtered.slice(0, satelliteCount);
    return displayed.filter(p => {
      const sat = satellites.find(s => s.norad_id === p.norad_id);
      return sat?.status === 'active';
    }).length;
  }, [orbitAltitudeKm, displayedCount, positions, satelliteConstellations, activeConstellations, satelliteCount, satellites]);

  return (
    <div className="relative w-full h-full">
      {/* 3D Canvas */}
      <Scene3D
        positions={positions}
        tleData={tleData}
        orbitPaths={orbitPaths}
        satelliteConstellations={satelliteConstellations}
      />

      {/* Header */}
      <Header
        satelliteCount={displayedCount}
        activeCount={activeCount}
        timeSpeed={timeSpeed}
        activeLinksCount={activeLinksCount}
      />

      {/* UI Panels */}
      <ControlPanel />
      <SatelliteInfoPanel satellites={satellites} positions={positions} />
      <StarAIChat />

    </div>
  );
}
