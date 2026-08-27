'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getTeamLogoUrl, getTeamNickname } from '@/lib/nflTeams';

const ALL_NFL_TEAMS = [
  'San Francisco 49ers', 'Chicago Bears', 'Cincinnati Bengals', 'Buffalo Bills',
  'Denver Broncos', 'Cleveland Browns', 'Tampa Bay Buccaneers', 'Arizona Cardinals',
  'Los Angeles Chargers', 'Kansas City Chiefs', 'Washington Commanders', 'Dallas Cowboys',
  'Miami Dolphins', 'Philadelphia Eagles', 'Atlanta Falcons', 'New York Giants',
  'Jacksonville Jaguars', 'New York Jets', 'Detroit Lions', 'Green Bay Packers',
  'Carolina Panthers', 'New England Patriots', 'Las Vegas Raiders', 'Los Angeles Rams',
  'Baltimore Ravens', 'New Orleans Saints', 'Seattle Seahawks', 'Pittsburgh Steelers',
  'Houston Texans', 'Tennessee Titans', 'Minnesota Vikings'
].sort((a, b) => getTeamNickname(a).localeCompare(getTeamNickname(b)));

interface TeamsAvailableModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  profile: any;
}

export default function TeamsAvailableModal({
  isOpen,
  onClose,
  userId,
}: TeamsAvailableModalProps) {
  const [teamPicksMap, setTeamPicksMap] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserPicks();
    }
  }, [isOpen, userId]);

  const fetchUserPicks = async () => {
    const { data } = await supabase
      .from('picks')
      .select('*, games(*)')
      .eq('user_id', userId);

    const map: Record<string, any[]> = {};
    (data || []).forEach((p) => {
      if (!map[p.selected_team]) map[p.selected_team] = [];
      map[p.selected_team].push(p);
    });
    setTeamPicksMap(map);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-4 sm:p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold"
        >
          ✕
        </button>

        <h2 className="text-base font-bold text-white mb-1">Team Pick Frequency</h2>
        <p className="text-xs text-gray-400 mb-4">
          Each team can be picked up to 6 times per season.
        </p>

        <div className="flex flex-col gap-2">
          {ALL_NFL_TEAMS.map((teamFullName) => {
            const picks = teamPicksMap[teamFullName] || [];
            const nick = getTeamNickname(teamFullName);
            const isMaxedOut = picks.length >= 6;

            return (
              <div
                key={teamFullName}
                className={`p-2 sm:p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
                  isMaxedOut
                    ? 'bg-red-950/30 border-red-500 text-red-100'
                    : 'bg-gray-800/80 border-gray-700/80 text-gray-200'
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 pr-2 flex-1">
                  <img
                    src={getTeamLogoUrl(teamFullName)}
                    alt=""
                    className="w-4 h-4 sm:w-5 sm:h-5 object-contain flex-shrink-0"
                  />
                  <span className="font-bold text-xs truncate">{nick}</span>
                </div>

                {/* 6 Fixed Compact Boxes */}
                <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                  {Array.from({ length: 6 }).map((_, i) => {
                    const pick = picks[i];
                    if (!pick) {
                      return (
                        <div
                          key={i}
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded border border-dashed border-gray-700 bg-gray-900/40 flex items-center justify-center text-[9px] sm:text-[10px] text-gray-600 font-mono"
                        >
                          {i + 1}
                        </div>
                      );
                    }

                    const game = pick.games;
                    const isFinished = game?.status === 'post';
                    const winner = game?.winner_team;
                    const isWin = isFinished && winner === teamFullName;
                    const isLoss = isFinished && winner && winner !== teamFullName;

                    if (isWin) {
                      return (
                        <div
                          key={i}
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-emerald-600 border border-emerald-500 text-white font-extrabold text-[10px] sm:text-[11px] flex items-center justify-center shadow"
                          title={`Week ${pick.week}: Win`}
                        >
                          W
                        </div>
                      );
                    } else if (isLoss) {
                      return (
                        <div
                          key={i}
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-red-600 border border-red-500 text-white font-extrabold text-[10px] sm:text-[11px] flex items-center justify-center shadow"
                          title={`Week ${pick.week}: Loss`}
                        >
                          L
                        </div>
                      );
                    } else {
                      return (
                        <div
                          key={i}
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-gray-800 border border-gray-600 text-amber-400 font-extrabold text-[10px] sm:text-[11px] flex items-center justify-center shadow"
                          title={`Week ${pick.week}: Pending`}
                        >
                          ?
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
