import { useEffect, useMemo, useCallback, useRef } from 'react';
import { Scene3D } from './components/Scene3D';
import { ControlPanel } from './components/ControlPanel';
import { SatelliteInfoPanel } from './components/SatelliteInfoPanel';
import { StarAIChat } from './components/StarAIChat';
import { Header } from './components/Header';
import { useStore } from './hooks/useStore';
import { fetchSatellites, fetchPositions, fetchOrbitPath, fetchTLE } from './services/api';

export default function App() {
  const {
    satellites, setSatellites,
    positions, setPositions,
    orbitPaths, setOrbitPath,
    tleData, setTleData,
    timeSpeed,
    selectedSatellite,
    activeLinksCount,
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
  const loadPositions = useCallback(async () => {
    try {
      const res = await fetchPositions();
      setPositions(res.positions);
    } catch (err) {
      console.error('Position fetch error:', err);
    }
  }, []);

  useEffect(() => {
    loadPositions();
    // Медленный поллинг — клиентская SGP4 даёт плавную анимацию
    const ms = Math.max(2000, 5000 / timeSpeed);
    intervalRef.current = setInterval(loadPositions, ms);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timeSpeed, loadPositions]);

  // Загрузка орбит при выборе спутника
  useEffect(() => {
    if (selectedSatellite && !orbitPaths[selectedSatellite]) {
      fetchOrbitPath(selectedSatellite, 180, 60)
        .then((res) => setOrbitPath(res.norad_id, res.path))
        .catch(console.error);
    }
  }, [selectedSatellite]);

  // Предзагрузка орбит для всех спутников
  useEffect(() => {
    if (satellites.length > 0) {
      satellites.forEach((sat, i) => {
        setTimeout(() => {
          if (!orbitPaths[sat.norad_id]) {
            fetchOrbitPath(sat.norad_id, 120, 60)
              .then((res) => setOrbitPath(res.norad_id, res.path))
              .catch(console.error);
          }
        }, i * 200);
      });
    }
  }, [satellites]);

  // Маппинг norad_id → constellation
  const satelliteConstellations = useMemo(() => {
    const map: Record<number, string> = {};
    satellites.forEach((s) => (map[s.norad_id] = s.constellation));
    return map;
  }, [satellites]);

  const activeCount = positions.filter(p => {
    const sat = satellites.find(s => s.norad_id === p.norad_id);
    return sat?.status === 'active';
  }).length;

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
        satelliteCount={satellites.length}
        activeCount={activeCount}
        timeSpeed={timeSpeed}
        activeLinksCount={activeLinksCount}
      />

      {/* UI Panels */}
      <ControlPanel />
      <SatelliteInfoPanel satellites={satellites} positions={positions} />
      <StarAIChat />

      {/* Bottom info */}
      <div
        className="absolute bottom-4 left-4 z-10 text-[9px] text-star-700 font-mono animate-fade-in"
        style={{ animationDelay: '1s', animationFillMode: 'both' }}
      >
        StarGrid v1.1 · НЦКК · React Three Fiber · satellite.js · SGP4 · FastAPI
      </div>
    </div>
  );
}
