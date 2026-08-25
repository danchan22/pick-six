'use client';

export default function RulesTab() {
  return (
    <div className="flex flex-col gap-4 pb-28 max-w-2xl mx-auto px-4 pt-4 text-white">
      <h2 className="text-xl font-bold flex items-center gap-2">📖 League Rules</h2>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-2">
        <h3 className="font-bold text-sm text-emerald-400">1. Weekly Picks</h3>
        <p className="text-xs text-gray-300 leading-relaxed">
          Select exactly 6 NFL team winners each week. Correct regular picks earn <span className="text-emerald-400 font-bold">+1 point</span>. Incorrect picks earn <span className="text-gray-400 font-bold">0 points</span>.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-2">
        <h3 className="font-bold text-sm text-amber-400">2. Lock of the Week</h3>
        <p className="text-xs text-gray-300 leading-relaxed">
          Designate 1 of your 6 picks as your Lock of the Week. A correct Lock earns <span className="text-emerald-400 font-bold">+2 points</span>. An incorrect Lock costs <span className="text-red-400 font-bold">-1 point</span>.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-2">
        <h3 className="font-bold text-sm text-blue-400">3. Pick Limits</h3>
        <p className="text-xs text-gray-300 leading-relaxed">
          You can pick any NFL team up to <span className="font-bold text-white">6 times total</span> across the entire 18-week regular season.
        </p>
      </div>

      {/* Chaos Week Rule */}
      <div className="bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border border-purple-500/50 rounded-xl p-4 flex flex-col gap-2 shadow-lg">
        <h3 className="font-bold text-sm text-purple-300 flex items-center gap-1.5">
          <span>🌀</span> Chaos Week (Week 18)
        </h3>
        <p className="text-xs text-gray-200 leading-relaxed">
          Week 18 is Chaos Week, which means instead of picking 6 games, you pick all 16 games. Each win is worth 1 point. Each loss is worth 0 points. There are no Locks of the Week.
        </p>
      </div>
    </div>
  );
}
