import { useState, useEffect } from 'react';
import { useStore } from '../hooks/useStore';
import { t } from '../i18n';
import type { Lang } from '../i18n';

interface HeaderProps {
  satelliteCount: number;
  activeCount: number;
  timeSpeed: number;
  activeLinksCount: number;
}

export function Header({ satelliteCount, activeCount, timeSpeed, activeLinksCount }: HeaderProps) {
  const { lang, setLang } = useStore();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const utcStr = time.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  return (
    <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo — offset to avoid overlap with control panel */}
        <div className="pointer-events-auto flex items-center gap-3 ml-[310px]">
          <div className="relative">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-star-500 via-star-600 to-star-800 flex items-center justify-center shadow-lg shadow-star-600/30">
              <span className="text-white font-display font-extrabold text-sm">SV</span>
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border border-void-900" />
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
              label={t('header.status', lang)}
              value={t('header.online', lang)}
              valueClass="text-green-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
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
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[9px] text-star-600 font-mono uppercase">{label}</span>
      <span className={`text-[11px] font-mono ${valueClass}`}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-3 bg-star-800" />;
}
