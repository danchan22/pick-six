'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getTeamNickname, getTeamLogoUrl, getTeamAbbr } from '@/lib/nflTeams';

interface PickHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  profile: any;
  currentWeek: number;
}

export default function PickHistoryModal({
  isOpen,
  onClose,
  userId,
  profile,
  currentWeek,
}: PickHistoryModalProps) {
  const [viewWeek, setViewWeek] = useState<number>(currentWeek || 1);
  const [picks, setPicks] = useState<any[]>([]);

  useEffect(() => {
    if (currentWeek) setViewWeek(currentWeek);
  }, [currentWeek]);

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserWeekPicks(userId, viewWeek);
    }
  }, [isOpen, userId, viewWeek]);

  const fetchUserWeekPicks = async (uId: string, week: number) => {
    const { data } = await supabase
      .from('picks')
      .select('*, games(*)')
      .eq('user_id', uId)
      .eq('week', week);

    const rawPicks = data || [];
    let lockFound = false;
    const sanitizedPicks = rawPicks.map((pick) => {
      if (pick.is_lock && !lockFound) {
        lockFound = true;
        return pick;
      }
      return { ...pick, is_lock: false };
    });

    setPicks(sanitizedPicks);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-5 shadow-2xl relative flex flex-col gap-3">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white font-bold text-sm"
        >
          ✕
        </button>

        <div>
          <h3 className="font-bold text-base text-white">
            {profile?.team_name || 'My Picks'}
          </h3>
          <p className="text-xs text-gray-400">
            {profile?.first_name} {profile?.last_name} • Pick History
          </p>
        </div>

        {/* Week Selector Bar with Arrows */}
        <div className="flex items-center justify-between bg-gray-800/80 p-2 rounded-xl border border-gray-700/80">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewWeek((prev) => Math.max(1, prev - 1))}
              disabled={viewWeek <= 1}
              className="w-7 h-7 flex items-center justify-center bg-gray-700 hover:bg-gray-600 disabled:opacity-30 rounded-lg text-xs font-bold transition-colors text-white"
            >
              ◀
            </button>

            <select
              value={viewWeek}
              onChange={(e) => setViewWeek(Number(e.target.value))}
              className="bg-gray-700 text-xs font-bold text-white px-3 py-1 rounded-lg border border-gray-600 focus:outline-none"
            >
              {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>

            <button
              onClick={() => setViewWeek((prev) => Math.min(18, prev + 1))}
              disabled={viewWeek >= 18}
              className="w-7 h-7 flex items-center justify-center bg-gray-700 hover:bg-gray-600 disabled:opacity-30 rounded-lg text-xs font-bold transition-colors text-white"
            >
              ▶
            </button>
          </div>

          <span className="text-[10px] text-gray-400 font-semibold font-mono">
            {picks.length}/6 Picks
          </span>
        </div>

        {/* Compact Pick List formatted like Standings */}
        <div className="flex flex-col gap-1.5">
          {picks.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-8">
              No picks submitted for Week {viewWeek}
            </p>
          ) : (
            picks.map((pick) => {
              const game = pick.games;
              const teamNick = getTeamNickname(pick.selected_team);
              const isHome = game?.home_team === pick.selected_team;
              const opponentName = game ? (isHome ? game.away_team : game.home_team) : null;
              const oppAbbr = opponentName ? getTeamAbbr(opponentName) : '';
              const oppPrefix = isHome ? 'vs' : '@';

              return (
                <div
                  key={pick.id}
                  className={`p-2 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                    pick.is_lock
                      ? 'bg-amber-950/20 border-amber-500/60'
                      : 'bg-gray-800/80 border-gray-700/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={getTeamLogoUrl(pick.selected_team)}
                      alt=""
                      className="w-6 h-6 object-contain flex-shrink-0"
                    />
                    <div className="truncate flex items-center gap-1">
                      <span className="font-bold text-white">{teamNick}</span>
                      <span className="text-gray-400 font-normal text-[11px]">
                        {oppPrefix} {oppAbbr}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {pick.is_lock && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/50 px-1.5 py-0.5 rounded font-bold">
                        🔒 LOCK
                      </span>
                    )}
                    <span className="font-mono font-bold text-emerald-400 min-w-[36px] text-right">
                      +{pick.points_awarded || 0}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
