import { useEffect, useMemo, useCallback, useRef } from 'react';
import { Scene3D } from './components/Scene3D';
import { ControlPanel } from './components/ControlPanel';
import { SatelliteInfoPanel } from './components/SatelliteInfoPanel';
import { StarAIChat } from './components/StarAIChat';
import { Header } from './components/Header';
import { useStore } from './hooks/useStore';
import { fetchSatellites, fetchPositions, fetchOrbitPath, fetchTLE } from './services/api';
import { getSimTime } from './simClock';

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

  // Загрузка списка спутников
  useEffect(() => {
    fetchSatellites()
      .then((res) => setSatellites(res.satellites))
      .catch(console.error);
  }, []);

  // Загрузка TLE для клиентской SGP4
  useEffect(() => {
    fetchTLE()
      .then((res) => setTleData(res.tle_data))
      .catch(console.error);
  }, []);

  // Загрузка позиций (периодическая — резервная для fallback и info panel)
  // Используем симулированное время для синхронизации с 3D-сценой
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
    // Медленный поллинг — клиентская SGP4 даёт плавную анимацию
    // Увеличен минимальный интервал для снижения нагрузки на бэкенд
    const ms = Math.max(5000, 10000 / timeSpeed);
    intervalRef.current = setInterval(loadPositions, ms);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timeSpeed, loadPositions]);

  // Загрузка орбит при выборе спутника (пропускаем виртуальные NORAD 90000+)
  useEffect(() => {
    if (selectedSatellite && selectedSatellite < 90000 && !orbitPaths[selectedSatellite]) {
      fetchOrbitPath(selectedSatellite, 180, 60, tleSource)
        .then((res) => setOrbitPath(res.norad_id, res.path))
        .catch(console.error);
    }
  }, [selectedSatellite, tleSource]);

  // Предзагрузка орбит для всех спутников (батчами по 4 для снижения нагрузки)
  useEffect(() => {
    if (satellites.length === 0) return;
    let cancelled = false;
    const loadBatched = async () => {
      const toLoad = satellites.filter((s) => !orbitPaths[s.norad_id]);
      const batchSize = 4;
      for (let i = 0; i < toLoad.length; i += batchSize) {
        if (cancelled) return;
        const batch = toLoad.slice(i, i + batchSize);
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
  }, [satellites]);

  // Маппинг norad_id → constellation
  const satelliteConstellations = useMemo(() => {
    const map: Record<number, string> = {};
    satellites.forEach((s) => (map[s.norad_id] = s.constellation));
    return map;
  }, [satellites]);

  // Подсчёт отображаемых КА с учётом режима (виртуальный / реальный)
  const displayedCount = useMemo(() => {
    if (orbitAltitudeKm > 0) {
      // Virtual mode: all satelliteCount are "active", filtered by constellations
      const CONSTELLATIONS = ['УниверСат', 'МГТУ Баумана', 'SPUTNIX', 'Геоскан', 'НИИЯФ МГУ', 'Space-Pi'];
      let count = 0;
      for (let i = 0; i < satelliteCount; i++) {
        if (activeConstellations.includes(CONSTELLATIONS[i % CONSTELLATIONS.length])) count++;
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
