import { useMemo } from 'react';
import { useStore } from '../hooks/useStore';
import type { SatelliteData, SatellitePosition } from '../types';

interface SatelliteInfoPanelProps {
  satellites: SatelliteData[];
  positions: SatellitePosition[];
}

export function SatelliteInfoPanel({ satellites, positions }: SatelliteInfoPanelProps) {
  const { selectedSatellite, selectSatellite, focusSatellite } = useStore();

  const satData = useMemo(
    () => satellites.find((s) => s.norad_id === selectedSatellite),
    [satellites, selectedSatellite]
  );

  const satPos = useMemo(
    () => positions.find((p) => p.norad_id === selectedSatellite),
    [positions, selectedSatellite]
  );

  if (!selectedSatellite || !satData) return null;

  return (
    <div
      className="glass-panel absolute top-4 right-4 w-80 p-4 animate-slide-right z-10"
      style={{ maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}
    >
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-star-400 animate-pulse-glow" />
          <h3 className="font-display font-bold text-star-100 text-sm">
            {satData.name}
          </h3>
        </div>
        <button
          onClick={() => selectSatellite(null)}
          className="text-star-500 hover:text-star-200 transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Статус */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            satData.status === 'active' ? 'bg-green-400' : 'bg-red-400'
          }`}
        />
        <span className="text-xs text-star-400 font-mono">
          {satData.status === 'active' ? 'Активен' : 'Неактивен'}
        </span>
        <span className="text-xs text-star-600 font-mono">|</span>
        <span className="text-xs text-star-400 font-mono">{satData.form_factor}</span>
        <span className="text-xs text-star-600 font-mono">|</span>
        <span className="text-xs text-star-400 font-mono">{satData.mass_kg} кг</span>
      </div>

      {/* Описание */}
      <p className="text-xs text-star-300 font-body mb-4 leading-relaxed">
        {satData.description}
      </p>

      {/* Телеметрия */}
      {satPos && (
        <div className="space-y-1 mb-4">
          <SectionTitle>Телеметрия</SectionTitle>
          <DataRow label="Высота" value={`${satPos.altitude_km.toFixed(1)} км`} />
          <DataRow label="Скорость" value={`${satPos.speed_km_s.toFixed(3)} км/с`} />
          <DataRow label="Период" value={`${satPos.period_min.toFixed(1)} мин`} />
          <DataRow label="Широта" value={`${satPos.lat.toFixed(2)}°`} />
          <DataRow label="Долгота" value={`${satPos.lon.toFixed(2)}°`} />
        </div>
      )}

      {/* ECI координаты */}
      {satPos && (
        <div className="space-y-1 mb-4">
          <SectionTitle>ECI координаты (км)</SectionTitle>
          <DataRow label="X" value={satPos.eci.x.toFixed(1)} />
          <DataRow label="Y" value={satPos.eci.y.toFixed(1)} />
          <DataRow label="Z" value={satPos.eci.z.toFixed(1)} />
        </div>
      )}

      {/* Метаданные */}
      <div className="space-y-1">
        <SectionTitle>Информация</SectionTitle>
        <DataRow label="NORAD ID" value={String(satData.norad_id)} />
        <DataRow label="Группировка" value={satData.constellation} />
        <DataRow label="Назначение" value={satData.purpose} />
        <DataRow label="Запуск" value={satData.launch_date} />
      </div>

      {/* Кнопка фокуса */}
      <button
        onClick={() => focusSatellite(selectedSatellite)}
        className="btn-star w-full mt-4 text-xs py-2"
      >
        Навести камеру
      </button>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] text-star-500 font-mono uppercase tracking-widest mb-1 pt-1 border-t border-star-900/50">
      {children}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-[11px] text-star-500 font-body">{label}</span>
      <span className="text-[11px] text-star-200 font-mono">{value}</span>
    </div>
  );
}
