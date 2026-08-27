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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto text-white">
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

            return (
              <div
                key={teamFullName}
                className="bg-gray-800/80 border border-gray-700/80 p-2.5 rounded-xl flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-[130px]">
                  <img
                    src={getTeamLogoUrl(teamFullName)}
                    alt=""
                    className="w-5 h-5 object-contain flex-shrink-0"
                  />
                  <span className="font-bold text-xs truncate">{nick}</span>
                </div>

                {/* 6 Pick Tracking Boxes */}
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: 6 }).map((_, i) => {
                    const pick = picks[i];
                    if (!pick) {
                      // Unused slot
                      return (
                        <div
                          key={i}
                          className="w-6 h-6 rounded-md border border-dashed border-gray-700 bg-gray-900/40 flex items-center justify-center text-[10px] text-gray-600 font-mono"
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
                          className="w-6 h-6 rounded-md bg-emerald-600 border border-emerald-500 text-white font-extrabold text-[11px] flex items-center justify-center shadow"
                          title={`Week ${pick.week}: Win`}
                        >
                          W
                        </div>
                      );
                    } else if (isLoss) {
                      return (
                        <div
                          key={i}
                          className="w-6 h-6 rounded-md bg-red-600 border border-red-500 text-white font-extrabold text-[11px] flex items-center justify-center shadow"
                          title={`Week ${pick.week}: Loss`}
                        >
                          L
                        </div>
                      );
                    } else {
                      return (
                        <div
                          key={i}
                          className="w-6 h-6 rounded-md bg-gray-800 border border-gray-600 text-amber-400 font-extrabold text-[11px] flex items-center justify-center shadow"
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
