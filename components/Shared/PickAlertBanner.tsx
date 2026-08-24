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
  // Hide banner if user has submitted all 6 picks and selected a Lock
  if (picksCount === 6 && hasLock) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-lg shrink-0">⚠️</span>
          <div className="text-xs text-amber-200 min-w-0">
            <p className="font-bold truncate">Week {currentWeek} Picks Incomplete</p>
            <p className="text-amber-300/80 text-[11px] truncate">
              {picksCount < 6
                ? `${6 - picksCount} more game pick${6 - picksCount > 1 ? 's' : ''} needed`
                : 'Select your Lock of the Week'}
            </p>
          </div>
        </div>

        <button
          onClick={onNavigateToPicks}
          className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 transition-colors shadow-sm"
        >
          Make Picks
        </button>
      </div>
    </div>
  );
}
