'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getTeamLogoUrl, getTeamNickname } from '@/lib/nflTeams';

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
  const [userPickCounts, setUserPickCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserPickCounts();
    }
  }, [isOpen, userId]);

  const fetchUserPickCounts = async () => {
    const { data } = await supabase
      .from('picks')
      .select('selected_team')
      .eq('user_id', userId);

    const counts: Record<string, number> = {};
    (data || []).forEach((p) => {
      counts[p.selected_team] = (counts[p.selected_team] || 0) + 1;
    });
    setUserPickCounts(counts);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold"
        >
          ✕
        </button>

        <h2 className="text-base font-bold text-white mb-1">Team Pick Frequency</h2>
        <p className="text-xs text-gray-400 mb-4">
          Each NFL team can only be picked up to 6 times per season.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {ALL_NFL_TEAMS.map((teamFullName) => {
            const count = userPickCounts[teamFullName] || 0;
            const remaining = 6 - count;
            const nick = getTeamNickname(teamFullName);

            return (
              <div
                key={teamFullName}
                className={`p-2 rounded-lg border flex items-center justify-between text-xs ${
                  remaining === 0
                    ? 'bg-red-950/30 border-red-500/40 text-red-300'
                    : 'bg-gray-800/80 border-gray-700/80 text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={getTeamLogoUrl(teamFullName)}
                    alt=""
                    className="w-5 h-5 object-contain flex-shrink-0"
                  />
                  <span className="font-semibold truncate">{nick}</span>
                </div>
                <span className="font-mono font-bold text-[11px] flex-shrink-0">
                  {count}/6
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
