import { useMemo } from 'react';
import { useStore } from '../hooks/useStore';
import { t, tConstellation } from '../i18n';
import type { SatelliteData, SatellitePosition } from '../types';

interface SatelliteInfoPanelProps {
  satellites: SatelliteData[];
  positions: SatellitePosition[];
}

export function SatelliteInfoPanel({ satellites, positions }: SatelliteInfoPanelProps) {
  const { lang, selectedSatellite, selectSatellite, focusSatellite } = useStore();

  const satData = useMemo(
    () => satellites.find((s) => s.norad_id === selectedSatellite),
    [satellites, selectedSatellite]
  );

  const satPos = useMemo(
    () => positions.find((p) => p.norad_id === selectedSatellite),
    [positions, selectedSatellite]
  );

  if (!selectedSatellite || !satData) return null;

  const km = lang === 'ru' ? 'км' : 'km';
  const kms = lang === 'ru' ? 'км/с' : 'km/s';
  const min = lang === 'ru' ? 'мин' : 'min';
  const kg = lang === 'ru' ? 'кг' : 'kg';

  return (
    <div
      className="glass-panel absolute top-4 right-4 w-80 p-4 animate-slide-right z-10"
      style={{ maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}
    >
      {/* Header */}
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

      {/* Status */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            satData.status === 'active' ? 'bg-green-400' : 'bg-red-400'
          }`}
        />
        <span className="text-xs text-star-400 font-mono">
          {satData.status === 'active' ? t('info.active', lang) : t('info.inactive', lang)}
        </span>
        <span className="text-xs text-star-600 font-mono">|</span>
        <span className="text-xs text-star-400 font-mono">{satData.form_factor}</span>
        <span className="text-xs text-star-600 font-mono">|</span>
        <span className="text-xs text-star-400 font-mono">{satData.mass_kg} {kg}</span>
      </div>

      {/* Description */}
      <p className="text-xs text-star-300 font-body mb-4 leading-relaxed">
        {satData.description}
      </p>

      {/* Telemetry */}
      {satPos && (
        <div className="space-y-1 mb-4">
          <SectionTitle>{t('info.telemetry', lang)}</SectionTitle>
          <DataRow label={t('info.altitude', lang)} value={`${satPos.altitude_km.toFixed(1)} ${km}`} />
          <DataRow label={t('info.velocity', lang)} value={`${satPos.speed_km_s.toFixed(3)} ${kms}`} />
          <DataRow label={t('info.period', lang)} value={`${satPos.period_min.toFixed(1)} ${min}`} />
          <DataRow label={t('info.latitude', lang)} value={`${satPos.lat.toFixed(2)}°`} />
          <DataRow label={t('info.longitude', lang)} value={`${satPos.lon.toFixed(2)}°`} />
        </div>
      )}

      {/* ECI coordinates */}
      {satPos && (
        <div className="space-y-1 mb-4">
          <SectionTitle>{t('info.eciCoords', lang)}</SectionTitle>
          <DataRow label="X" value={satPos.eci.x.toFixed(1)} />
          <DataRow label="Y" value={satPos.eci.y.toFixed(1)} />
          <DataRow label="Z" value={satPos.eci.z.toFixed(1)} />
        </div>
      )}

      {/* Metadata */}
      <div className="space-y-1">
        <SectionTitle>{t('info.metadata', lang)}</SectionTitle>
        <DataRow label={t('info.noradId', lang)} value={String(satData.norad_id)} />
        <DataRow label={t('info.constellation', lang)} value={tConstellation(satData.constellation, lang)} />
        <DataRow label={t('info.purpose', lang)} value={satData.purpose} />
        <DataRow label={t('info.launch', lang)} value={satData.launch_date} />
      </div>

      {/* Focus button */}
      <button
        onClick={() => focusSatellite(selectedSatellite)}
        className="btn-star w-full mt-4 text-xs py-2"
      >
        {t('info.focusCamera', lang)}
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
