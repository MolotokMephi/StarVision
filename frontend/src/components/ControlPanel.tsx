import { useStore } from '../hooks/useStore';
import { t, tConstellation } from '../i18n';

const CONSTELLATION_COLORS: Record<string, string> = {
  'Сфера': '#3389ff',
  'Образовательные': '#33ffaa',
  'Гонец': '#ff9933',
  'ДЗЗ': '#ff3366',
  'Научные': '#aa33ff',
  'МФТИ': '#33ffdd',
  'МГТУ им. Баумана': '#ffdd33',
};

const SPEED_PRESETS = [
  { label: '1×', value: 1 },
  { label: '10×', value: 10 },
  { label: '50×', value: 50 },
  { label: '100×', value: 100 },
  { label: '200×', value: 200 },
];

export function ControlPanel() {
  const {
    lang,
    timeSpeed, setTimeSpeed,
    showOrbits, setShowOrbits,
    showLabels, setShowLabels,
    showLinks, setShowLinks,
    activeConstellations, toggleConstellation,
    satelliteCount, setSatelliteCount,
    orbitAltitudeKm, setOrbitAltitudeKm,
    commRangeKm, setCommRangeKm,
    orbitalPlanes, setOrbitalPlanes,
    resetView,
  } = useStore();

  const planesWord = lang === 'ru'
    ? (orbitalPlanes === 1 ? t('control.plane_one', lang) : orbitalPlanes < 5 ? t('control.plane_few', lang) : t('control.plane_many', lang))
    : t(orbitalPlanes === 1 ? 'control.plane_one' : 'control.plane_many', lang);

  return (
    <div
      className="glass-panel absolute top-4 left-4 w-72 p-4 animate-slide-left z-10 overflow-y-auto overflow-x-hidden"
      style={{ animationDelay: '0.2s', animationFillMode: 'both', maxHeight: 'calc(100vh - 80px)' }}
    >
      {/* Title */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-star-400 animate-pulse-glow" />
        <h2 className="font-display font-bold text-star-200 text-sm tracking-wider uppercase">
          {t('control.title', lang)}
        </h2>
      </div>

      {/* Simulation speed */}
      <div className="mb-4">
        <label className="block text-xs text-star-400 font-mono mb-2">
          {t('control.simSpeed', lang)}: {timeSpeed}×
        </label>
        <div className="flex gap-1.5">
          {SPEED_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => setTimeSpeed(preset.value)}
              className={`btn-star text-xs flex-1 py-1.5 ${
                timeSpeed === preset.value ? 'active' : ''
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Satellite count */}
      <div className="mb-4">
        <label className="block text-xs text-star-400 font-mono mb-2">
          {t('control.satCount', lang)}: {satelliteCount}
        </label>
        <input
          type="range"
          min={3}
          max={15}
          step={1}
          value={satelliteCount}
          onChange={(e) => setSatelliteCount(Number(e.target.value))}
        />
        <div className="flex justify-between text-[10px] text-star-700 font-mono mt-0.5">
          <span>3</span>
          <span>15</span>
        </div>
      </div>

      {/* Orbit altitude */}
      <div className="mb-4">
        <label className="block text-xs text-star-400 font-mono mb-2">
          {t('control.orbitAlt', lang)}:{' '}
          <span className="text-star-200">
            {orbitAltitudeKm === 0
              ? t('control.realTLE', lang)
              : `${orbitAltitudeKm} ${lang === 'ru' ? 'км' : 'km'}`}
          </span>
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOrbitAltitudeKm(0)}
            className={`btn-star text-[10px] px-2 py-1 flex-shrink-0 ${orbitAltitudeKm === 0 ? 'active' : ''}`}
          >
            TLE
          </button>
          <input
            type="range"
            min={400}
            max={2000}
            step={50}
            value={orbitAltitudeKm || 400}
            onChange={(e) => setOrbitAltitudeKm(Number(e.target.value))}
            className="flex-1"
          />
        </div>
        <div className="flex justify-between text-[10px] text-star-700 font-mono mt-0.5">
          <span>400 {lang === 'ru' ? 'км' : 'km'}</span>
          <span>1200</span>
          <span>2000 {lang === 'ru' ? 'км' : 'km'}</span>
        </div>
        {orbitAltitudeKm > 0 && (
          <p className="text-[9px] text-star-600 font-mono mt-1">
            {t('control.circularOrbits', lang)}: {satelliteCount} {t('header.spacecraft', lang)}, {orbitalPlanes} {planesWord}, 55°
          </p>
        )}
      </div>

      {/* Orbital planes (virtual orbits only) */}
      {orbitAltitudeKm > 0 && (
        <div className="mb-4">
          <label className="block text-xs text-star-400 font-mono mb-2">
            {t('control.orbitalPlanes', lang)}: <span className="text-star-200">{orbitalPlanes}</span>
          </label>
          <input
            type="range"
            min={1}
            max={7}
            step={1}
            value={orbitalPlanes}
            onChange={(e) => setOrbitalPlanes(Number(e.target.value))}
          />
          <div className="flex justify-between text-[10px] text-star-700 font-mono mt-0.5">
            <span>1</span>
            <span>7</span>
          </div>
          <p className="text-[9px] text-star-600 font-mono mt-1">
            Walker: RAAN {lang === 'ru' ? 'равномерно' : 'uniform'}, {Math.ceil(satelliteCount / orbitalPlanes)} {t('control.scPerPlane', lang)}
          </p>
        </div>
      )}

      {/* Communication range */}
      <div className="mb-4">
        <label className="block text-xs text-star-400 font-mono mb-2">
          {t('control.commRange', lang)}: <span className="text-star-200">{commRangeKm} {lang === 'ru' ? 'км' : 'km'}</span>
        </label>
        <input
          type="range"
          min={50}
          max={2000}
          step={50}
          value={commRangeKm}
          onChange={(e) => setCommRangeKm(Number(e.target.value))}
        />
        <div className="flex justify-between text-[10px] text-star-700 font-mono mt-0.5">
          <span>50</span>
          <span>2000 {lang === 'ru' ? 'км' : 'km'}</span>
        </div>
      </div>

      {/* Toggles */}
      <div className="mb-4 space-y-2">
        <Toggle label={t('control.orbitalTracks', lang)} checked={showOrbits} onChange={setShowOrbits} />
        <Toggle label={t('control.satLabels', lang)} checked={showLabels} onChange={setShowLabels} />
        <Toggle
          label={
            <span>
              {t('control.islLinks', lang)}
              <span className="ml-1 text-[10px] text-green-400 font-mono">●</span>
            </span>
          }
          checked={showLinks}
          onChange={setShowLinks}
        />
      </div>

      {/* Constellations */}
      <div className="mb-4">
        <label className="block text-xs text-star-400 font-mono mb-2">
          {t('control.constellations', lang)}
        </label>
        <div className="space-y-1">
          {Object.entries(CONSTELLATION_COLORS).map(([name, color]) => (
            <button
              key={name}
              onClick={() => toggleConstellation(name)}
              className={`flex items-center gap-2 w-full text-left text-xs px-2 py-1.5 rounded-md transition-all ${
                activeConstellations.includes(name)
                  ? 'opacity-100'
                  : 'opacity-30'
              }`}
              style={{
                background: activeConstellations.includes(name)
                  ? `${color}15`
                  : 'transparent',
                borderLeft: `3px solid ${color}`,
              }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: color }}
              />
              <span className="font-body text-star-200">{tConstellation(name, lang)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Reset */}
      <button onClick={resetView} className="btn-star w-full text-xs py-2">
        {t('control.reset', lang)}
      </button>
    </div>
  );
}

// ── Toggle ──────────────────────────────────────────────────────────
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: React.ReactNode;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <div
        className={`w-8 h-4 rounded-full transition-all relative flex-shrink-0 ${
          checked
            ? 'bg-star-600'
            : 'bg-void-700 border border-star-900'
        }`}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${
            checked
              ? 'left-4 bg-star-200 shadow-[0_0_6px_rgba(51,137,255,0.6)]'
              : 'left-0.5 bg-star-800'
          }`}
        />
      </div>
      <span className="text-xs text-star-300 font-body group-hover:text-star-100 transition-colors">
        {label}
      </span>
    </label>
  );
}
