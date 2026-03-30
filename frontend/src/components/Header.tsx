import { useState, useEffect } from 'react';

interface HeaderProps {
  satelliteCount: number;
  activeCount: number;
  timeSpeed: number;
  activeLinksCount: number;
}

export function Header({ satelliteCount, activeCount, timeSpeed, activeLinksCount }: HeaderProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const utcStr = time.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  return (
    <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Логотип */}
        <div className="pointer-events-auto flex items-center gap-3 ml-4">
          <div className="relative">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-star-500 via-star-600 to-star-800 flex items-center justify-center shadow-lg shadow-star-600/30">
              <span className="text-white font-display font-extrabold text-sm">СК</span>
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border border-void-900" />
          </div>
          <div>
            <h1 className="font-display font-bold text-star-100 text-sm tracking-wide">
              СФЕРА-КС
            </h1>
            <p className="text-[9px] text-star-500 font-mono tracking-wider">
              ЦИФРОВОЙ ДВОЙНИК ГРУППИРОВКИ
            </p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Статус-бар */}
        <div className="pointer-events-auto flex items-center gap-4 glass-panel px-4 py-2 mr-4">
          <StatusItem label="UTC" value={utcStr} />
          <Divider />
          <StatusItem label="КА" value={`${activeCount}/${satelliteCount}`} />
          <Divider />
          <StatusItem label="Скорость" value={`${timeSpeed}×`} />
          <Divider />
          <StatusItem
            label="МСС"
            value={`${activeLinksCount}`}
            valueClass={activeLinksCount > 0 ? 'text-green-400' : 'text-star-600'}
          />
          <Divider />
          <StatusItem
            label="Статус"
            value="ОНЛАЙН"
            valueClass="text-green-400"
          />
        </div>
      </div>
    </div>
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
