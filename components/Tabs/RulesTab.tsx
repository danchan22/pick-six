'use client';

export default function RulesTab() {
  return (
    <div className="flex flex-col gap-4 pb-28 max-w-2xl mx-auto px-4 pt-4 text-white">
      <h2 className="text-xl font-bold flex items-center gap-2">📖 League Rules</h2>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3 text-xs text-gray-300 leading-relaxed">
        <p>
          <strong className="text-emerald-400">1. Overview:</strong> Pick 6 NFL teams each week that you think will win. Select one of those 6 as your <span className="text-amber-400 font-bold">Lock of the Week</span>.
        </p>

        <p>
          <strong className="text-emerald-400">2. Scoring:</strong>
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-1 text-gray-300">
          <li>Standard Pick Win: <span className="text-emerald-400 font-bold">+1 point</span></li>
          <li>Standard Pick Loss or Tie: <span className="text-gray-400 font-bold">0 points</span></li>
          <li>Lock of the Week Win: <span className="text-emerald-400 font-bold">+2 points</span></li>
          <li>Lock of the Week Loss: <span className="text-red-400 font-bold">-1 point</span></li>
          <li>Lock of the Week Tie: <span className="text-gray-400 font-bold">0 points</span></li>
        </ul>

        <p>
          <strong className="text-emerald-400">3. Team Pick Limits:</strong> You may pick any given NFL team a maximum of <span className="text-white font-bold">6 times</span> throughout the regular season.
        </p>

        <p>
          <strong className="text-emerald-400">4. Lock Limits:</strong> You may use a team as your Lock of the Week a maximum of <span className="text-white font-bold">1 time</span> per season.
        </p>

        <p>
          <strong className="text-emerald-400">5. Deadlines:</strong> Picks lock individually at each game&apos;s scheduled kickoff time.
        </p>
      </div>

      {/* Chaos Week Section */}
      <div className="bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border border-purple-500/50 rounded-xl p-4 flex flex-col gap-2 shadow-lg">
        <h3 className="font-bold text-sm text-purple-300 flex items-center gap-1.5">
          <span>🌀</span> Chaos Week
        </h3>
        <p className="text-xs text-gray-200 leading-relaxed">
          Week 18 is Chaos Week, which means instead of picking 6 games, you pick all 16 games. Each win is worth 1 point. Each loss is worth 0 points. There are no Locks of the Week.
        </p>
      </div>
    </div>
  );
}
