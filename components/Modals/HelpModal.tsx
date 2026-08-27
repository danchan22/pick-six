'use client';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto flex flex-col gap-5 text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
          <img src="/pick-six-logo.png" alt="Pick Six Logo" className="w-10 h-10 object-contain" />
          <div>
            <h2 className="text-lg font-extrabold text-emerald-400">Welcome to Pick 6!</h2>
            <p className="text-xs text-gray-400">Everything you need to know to play and win</p>
          </div>
        </div>

        <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-3.5 flex flex-col gap-2">
          <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
            <span>🏈</span> How It Works
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed">
            Pick <strong>6 teams</strong> you think will win each week straight up. If the team you picked wins, you get 1 point. If they lose, you get 0 points.
          </p>
        </div>

        <div className="bg-gradient-to-r from-amber-950/40 via-gray-800 to-gray-800 border border-amber-500/60 rounded-xl p-3.5 flex flex-col gap-2 shadow-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>🔒</span> Lock of the Week
            </h3>
            <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-bold uppercase">
              Gold Slot
            </span>
          </div>
          <p className="text-xs text-gray-200 leading-relaxed">
            One of your picks must be designated as your <strong>Lock of the Week</strong>, highlighted in gold. If this team wins, you get 2 points! But if they lose, you get -1 point.
          </p>
        </div>

        <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-3.5 flex flex-col gap-1.5">
          <h3 className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>📊</span> Season Team Usage Limit
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed">
            One last wrinkle: You can only pick a team <strong>6 times</strong> over the course of the whole season. So choose wisely!
          </p>
        </div>

        <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-3.5 flex flex-col gap-2">
          <h3 className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>📱</span> Changing Your Lock
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed">
            You can tap on the teams in the bottom bar to change which team is your Lock of the Week.
          </p>
        </div>

        <div className="bg-emerald-950/40 border border-emerald-500/60 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center font-bold text-emerald-400 flex-shrink-0">
            ⚡
          </div>
          <div>
            <h4 className="text-xs font-bold text-emerald-400">Automatic Saving</h4>
            <p className="text-[11px] text-gray-300">
              Your picks save automatically -- no need to submit or click save.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs transition-colors shadow-lg mt-1"
        >
          Let’s play!
        </button>
      </div>
    </div>
  );
}
