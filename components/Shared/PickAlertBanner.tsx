'use client';

interface PickAlertBannerProps {
  currentWeek: number;
  picksCount: number;
  hasLock: boolean;
  onNavigateToPicks: () => void;
}

export default function PickAlertBanner({
  currentWeek,
  picksCount,
  hasLock,
  onNavigateToPicks,
}: PickAlertBannerProps) {
  const isComplete = picksCount === 6 && hasLock;

  if (isComplete) return null;

  const missingLockOnly = picksCount === 6 && !hasLock;

  return (
    <div
      onClick={onNavigateToPicks}
      className={`border-b px-4 py-2.5 cursor-pointer transition-colors ${
        missingLockOnly
          ? 'bg-amber-500/20 border-amber-500/50 hover:bg-amber-500/30'
          : 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20'
      }`}
    >
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{missingLockOnly ? '🔒' : '⚠️'}</span>
          <div>
            <p className="text-xs font-bold text-white">
              {missingLockOnly
                ? `Week ${currentWeek}: Lock of the Week Required!`
                : `Week ${currentWeek} Picks Incomplete (${picksCount}/6)`}
            </p>
            <p className="text-[11px] text-gray-300">
              {missingLockOnly
                ? 'You picked 6 teams but have not set your Lock!'
                : 'Make your picks now!'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
