import { useStore } from '../hooks/useStore';

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
];

export function ControlPanel() {
  const {
    timeSpeed, setTimeSpeed,
    showOrbits, setShowOrbits,
    showLabels, setShowLabels,
    activeConstellations, toggleConstellation,
    resetView,
  } = useStore();

  return (
    <div
      className="glass-panel absolute top-4 left-4 w-72 p-4 animate-slide-left z-10"
      style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
    >
      {/* Заголовок */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-star-400 animate-pulse-glow" />
        <h2 className="font-display font-bold text-star-200 text-sm tracking-wider uppercase">
          Управление
        </h2>
      </div>

      {/* Скорость времени */}
      <div className="mb-4">
        <label className="block text-xs text-star-400 font-mono mb-2">
          Скорость симуляции: {timeSpeed}×
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
        <input
          type="range"
          min={1}
          max={200}
          value={timeSpeed}
          onChange={(e) => setTimeSpeed(Number(e.target.value))}
          className="mt-2"
        />
      </div>

      {/* Переключатели */}
      <div className="mb-4 space-y-2">
        <Toggle label="Орбитальные треки" checked={showOrbits} onChange={setShowOrbits} />
        <Toggle label="Подписи спутников" checked={showLabels} onChange={setShowLabels} />
      </div>

      {/* Группировки */}
      <div className="mb-4">
        <label className="block text-xs text-star-400 font-mono mb-2">
          Группировки
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
              <span className="font-body text-star-200">{name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Сброс */}
      <button onClick={resetView} className="btn-star w-full text-xs py-2">
        Сбросить вид
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
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <div
        className={`w-8 h-4 rounded-full transition-all relative ${
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
