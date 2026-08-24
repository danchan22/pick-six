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

  return (
    <div
      onClick={onNavigateToPicks}
      className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 cursor-pointer hover:bg-amber-500/15 transition-colors"
    >
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-base">⚠️</span>
          <div>
            <p className="text-xs font-bold text-amber-200">
              Week {currentWeek} Picks Incomplete
            </p>
            <p className="text-[11px] text-amber-400/80 font-medium">
              Make your picks now!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
