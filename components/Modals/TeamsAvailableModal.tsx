'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getTeamNickname, getTeamLogoUrl } from '@/lib/nflTeams';

interface TeamsAvailableModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  profile: any;
}

const ALL_NFL_TEAMS = [
  'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills',
  'Carolina Panthers', 'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns',
  'Dallas Cowboys', 'Denver Broncos', 'Detroit Lions', 'Green Bay Packers',
  'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Kansas City Chiefs',
  'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
  'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants',
  'New York Jets', 'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers',
  'Seattle Seahawks', 'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders'
];

const SORTED_TEAMS = [...ALL_NFL_TEAMS].sort((a, b) =>
  getTeamNickname(a).localeCompare(getTeamNickname(b))
);

export default function TeamsAvailableModal({
  isOpen,
  onClose,
  userId,
  profile,
}: TeamsAvailableModalProps) {
  const [allUserPicks, setAllUserPicks] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && userId) {
      loadAllUserPicks();
    }
  }, [isOpen, userId]);

  const loadAllUserPicks = async () => {
    const { data } = await supabase
      .from('picks')
      .select('*, games(*)')
      .eq('user_id', userId);

    setAllUserPicks(data || []);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-5 shadow-2xl relative max-h-[85vh] flex flex-col gap-3">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold z-10"
        >
          ✕
        </button>

        <div>
          <h3 className="font-bold text-base text-white">Teams Available</h3>
          <p className="text-xs text-gray-400">
            {profile?.first_name} {profile?.last_name} • Seasonal Team Pick Usage
          </p>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto pr-1">
          {SORTED_TEAMS.map((teamFullName) => {
            const teamNick = getTeamNickname(teamFullName);
            const teamPicks = allUserPicks
              .filter((p) => p.selected_team === teamFullName)
              .sort((a, b) => (a.week || 0) - (b.week || 0));

            const count = teamPicks.length;

            return (
              <div
                key={teamFullName}
                className="bg-gray-800/80 border border-gray-700/80 p-2 rounded-xl flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <img
                    src={getTeamLogoUrl(teamFullName)}
                    alt=""
                    className="w-6 h-6 object-contain flex-shrink-0"
                  />
                  <span className="font-bold text-white truncate">{teamNick}</span>
                  <span className="text-[10px] text-gray-400 font-mono font-medium flex-shrink-0">
                    {count}/6
                  </span>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {Array.from({ length: 6 }).map((_, i) => {
                    const pick = teamPicks[i];

                    if (!pick) {
                      return (
                        <div
                          key={i}
                          className="w-6 h-6 rounded-md bg-gray-900/60 border border-gray-700/50 flex-shrink-0"
                        />
                      );
                    }

                    const game = pick.games;
                    const isFinished = game?.status === 'post';

                    let bgBorder = 'bg-blue-950/60 border-blue-500/60 text-blue-300';
                    let label = '?';

                    if (isFinished) {
                      if (game?.winner_team === pick.selected_team) {
                        bgBorder = 'bg-emerald-950/80 border-emerald-500 text-emerald-400';
                        label = 'W';
                      } else if (game?.winner_team === 'TIE') {
                        bgBorder = 'bg-amber-950/80 border-amber-500 text-amber-400';
                        label = 'T';
                      } else {
                        bgBorder = 'bg-red-950/80 border-red-500 text-red-400';
                        label = 'L';
                      }
                    }

                    return (
                      <div
                        key={i}
                        className={`w-6 h-6 rounded-md border flex items-center justify-center font-mono font-extrabold text-[11px] flex-shrink-0 ${bgBorder}`}
                      >
                        {label}
                      </div>
                    );
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
