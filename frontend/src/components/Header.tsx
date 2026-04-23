import { useState, useEffect } from 'react';
import { useStore } from '../hooks/useStore';
import { t } from '../i18n';
import type { Lang } from '../i18n';
import type { BackendStatus, TleEffectiveSource } from '../types';

interface HeaderProps {
  satelliteCount: number;
  activeCount: number;
  timeSpeed: number;
  activeLinksCount: number;
}

export function Header({ satelliteCount, activeCount, timeSpeed, activeLinksCount }: HeaderProps) {
  const { lang, setLang, health, tleMeta, tleSource } = useStore();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const utcStr = time.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  const statusView = renderStatus(health.status, lang);
  const sourceView = renderSource(tleMeta?.effective_source ?? tleSource, lang, Boolean(tleMeta?.fallback));
  const freshnessView = renderFreshness(tleMeta?.cache_age_sec ?? null, tleMeta?.stale ?? false, tleSource, lang);

  return (
    <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo — offset to avoid overlap with control panel */}
        <div className="pointer-events-auto flex items-center gap-3 ml-[310px]">
          <div className="relative">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-star-500 via-star-600 to-star-800 flex items-center justify-center shadow-lg shadow-star-600/30">
              <span className="text-white font-display font-extrabold text-sm">SV</span>
            </div>
            <div className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${statusView.dotClass} border border-void-900`} />
          </div>
          <div>
            <h1 className="font-display font-bold text-star-100 text-sm tracking-wide">
              StarVision
            </h1>
            <p className="text-[9px] text-star-500 font-mono tracking-wider">
              {t('header.subtitle', lang)}
            </p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Language switcher + Status bar */}
        <div className="pointer-events-auto flex items-center gap-3 mr-4">
          {/* Language switcher */}
          <div className="flex items-center gap-0.5 glass-panel px-1.5 py-1">
            <LangButton current={lang} value="ru" label="RU" onClick={setLang} />
            <LangButton current={lang} value="en" label="EN" onClick={setLang} />
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-4 glass-panel px-4 py-2">
            <StatusItem label={t('header.utc', lang)} value={utcStr} />
            <Divider />
            <StatusItem label={t('header.spacecraft', lang)} value={`${activeCount}/${satelliteCount}`} />
            <Divider />
            <StatusItem label={t('header.speed', lang)} value={`${timeSpeed}×`} />
            <Divider />
            <StatusItem
              label={t('header.isl', lang)}
              value={`${activeLinksCount}`}
              valueClass={activeLinksCount > 0 ? 'text-green-400' : 'text-star-600'}
            />
            <Divider />
            <StatusItem
              label={t('header.source', lang)}
              value={sourceView.label}
              valueClass={sourceView.colorClass}
              title={sourceView.title}
            />
            <Divider />
            <StatusItem
              label={t('header.freshness', lang)}
              value={freshnessView.label}
              valueClass={freshnessView.colorClass}
              title={freshnessView.title}
            />
            <Divider />
            <StatusItem
              label={t('header.status', lang)}
              value={statusView.label}
              valueClass={statusView.colorClass}
              title={statusView.title}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function renderStatus(status: BackendStatus, lang: Lang): { label: string; colorClass: string; dotClass: string; title: string } {
  switch (status) {
    case 'ok':
      return { label: t('header.online', lang), colorClass: 'text-green-400', dotClass: 'bg-green-400', title: 'backend healthy' };
    case 'degraded':
      return { label: t('header.degraded', lang), colorClass: 'text-yellow-400', dotClass: 'bg-yellow-400', title: 'upstream data degraded' };
    case 'offline':
      return { label: t('header.offline', lang), colorClass: 'text-red-400', dotClass: 'bg-red-400', title: 'backend unreachable' };
    default:
      return { label: t('header.checking', lang), colorClass: 'text-star-500', dotClass: 'bg-star-500', title: 'checking...' };
  }
}

function renderSource(
  source: TleEffectiveSource,
  lang: Lang,
  fallback: boolean,
): { label: string; colorClass: string; title: string } {
  if (source === 'celestrak') {
    return { label: t('header.sourceLive', lang), colorClass: 'text-green-400', title: 'live CelesTrak TLE' };
  }
  if (source === 'embedded') {
    return { label: t('header.sourceEmbedded', lang), colorClass: 'text-blue-300', title: 'embedded demo TLE' };
  }
  if (source === 'embedded_fallback' || fallback) {
    return { label: t('header.sourceFallback', lang), colorClass: 'text-yellow-400', title: 'CelesTrak unavailable — using embedded TLE' };
  }
  if (source === 'mixed') {
    return { label: t('header.sourceMixed', lang), colorClass: 'text-yellow-400', title: 'partial CelesTrak data, rest embedded' };
  }
  return { label: source, colorClass: 'text-star-500', title: source };
}

function formatAge(sec: number, lang: Lang): string {
  if (sec < 60) return t('header.freshAgo', lang, { age: `${Math.round(sec)}s` });
  if (sec < 3600) return t('header.freshAgo', lang, { age: `${Math.round(sec / 60)}m` });
  return t('header.freshAgo', lang, { age: `${Math.round(sec / 3600)}h` });
}

function renderFreshness(
  ageSec: number | null,
  stale: boolean,
  source: 'embedded' | 'celestrak',
  lang: Lang,
): { label: string; colorClass: string; title: string } {
  // Embedded TLE doesn't carry a meaningful "freshness" — it's static.
  if (source === 'embedded') {
    return { label: '—', colorClass: 'text-star-500', title: 'embedded TLE is static' };
  }
  if (ageSec === null) {
    return { label: '—', colorClass: 'text-star-500', title: 'no CelesTrak fetch yet' };
  }
  if (stale) {
    return {
      label: t('header.stale', lang),
      colorClass: 'text-yellow-400',
      title: `TLE cache is stale (${Math.round(ageSec)}s old)`,
    };
  }
  return {
    label: formatAge(ageSec, lang),
    colorClass: 'text-green-400',
    title: `TLE cached ${Math.round(ageSec)}s ago`,
  };
}

function LangButton({
  current,
  value,
  label,
  onClick,
}: {
  current: Lang;
  value: Lang;
  label: string;
  onClick: (lang: Lang) => void;
}) {
  const isActive = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      className={`text-[10px] font-mono px-2 py-0.5 rounded-md transition-all ${
        isActive
          ? 'bg-star-600/40 text-star-100 border border-star-500/40'
          : 'text-star-500 hover:text-star-300 border border-transparent'
      }`}
    >
      {label}
    </button>
  );
}

function StatusItem({
  label,
  value,
  valueClass = 'text-star-200',
  title,
}: {
  label: string;
  value: string;
  valueClass?: string;
  title?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5" title={title}>
      <span className="text-[9px] text-star-600 font-mono uppercase">{label}</span>
      <span className={`text-[11px] font-mono ${valueClass}`}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-3 bg-star-800" />;
}
