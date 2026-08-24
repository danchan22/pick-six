'use client';

export default function RulesTab() {
  return (
    <div className="flex flex-col gap-4 pb-24 max-w-2xl mx-auto px-4 pt-4 text-white">
      {/* Header without emoji */}
      <div>
        <h2 className="text-xl font-bold">Pick Six Rules & Scoring</h2>
        <p className="text-xs text-gray-400">Everything you need to know about competing in the league</p>
      </div>

      <div className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-4 flex flex-col gap-2">
        <h3 className="text-sm font-bold text-emerald-400">Weekly Pick Limit</h3>
        <p className="text-xs text-gray-300 leading-relaxed">
          Every week during the NFL season, participants pick the winner of exactly <strong>6 games</strong> straight up.
        </p>
      </div>

      {/* Scoring Structure */}
      <div className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-4 flex flex-col gap-3">
        <h3 className="text-sm font-bold text-emerald-400">Scoring Structure</h3>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-700/50">
            <span className="block font-bold text-emerald-400 text-sm">+1.0</span>
            <span className="text-[10px] text-gray-400 uppercase">Win</span>
          </div>
          <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-700/50">
            <span className="block font-bold text-amber-400 text-sm">+0.5</span>
            <span className="text-[10px] text-gray-400 uppercase">Tie</span>
          </div>
          <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-700/50">
            <span className="block font-bold text-gray-400 text-sm">0.0</span>
            <span className="text-[10px] text-gray-400 uppercase">Loss</span>
          </div>
        </div>
      </div>

      {/* Lock of the Week */}
      <div className="bg-gradient-to-r from-amber-950/40 via-gray-800 to-gray-800 border border-amber-500/50 rounded-xl p-4 flex flex-col gap-2">
        <h3 className="text-sm font-bold text-amber-400">Lock of the Week</h3>
        <p className="text-xs text-gray-300 leading-relaxed">
          Each week, you must designate <strong>one</strong> of your 6 selected teams as your Lock of the Week.
        </p>
        <ul className="text-xs text-gray-300 list-disc list-inside space-y-1 mt-1">
          <li><strong>Win:</strong> Awards <span className="text-emerald-400 font-bold">+2 points</span>.</li>
          <li><strong>Loss or Tie:</strong> Incurs a <span className="text-red-400 font-bold">-1 point</span> penalty.</li>
        </ul>
      </div>

      {/* Season Team Usage */}
      <div className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-4 flex flex-col gap-2">
        <h3 className="text-sm font-bold text-emerald-400">6-Team Usage Season Limit</h3>
        <p className="text-xs text-gray-300 leading-relaxed">
          Each NFL team can only be picked <strong>six times per user</strong> over the entire season.
        </p>
      </div>

      {/* Deadlines */}
      <div className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-4 flex flex-col gap-2">
        <h3 className="text-sm font-bold text-emerald-400">Kickoff Locks & Deadlines</h3>
        <ul className="text-xs text-gray-300 list-disc list-inside space-y-1">
          <li>Games lock individually at their official kickoff time.</li>
          <li>You can alter unlocked games anytime prior to kickoff.</li>
          <li>If you fail to submit picks before kickoff, you receive 0 points for unsubmitted slots.</li>
          <li>Postponed games remain locked and points are awarded whenever the game is eventually played.</li>
        </ul>
      </div>
    </div>
  );
}
