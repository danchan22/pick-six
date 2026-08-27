'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getTeamLogoUrl, getTeamNickname } from '@/lib/nflTeams';

interface WeeklyRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  week: number;
}

export default function WeeklyRecapModal({
  isOpen,
  onClose,
  userId,
  week,
}: WeeklyRecapModalProps) {
  const [picks, setPicks] = useState<any[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [totalMembers, setTotalMembers] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && userId && week >= 1) {
      loadRecapData();
    }
  }, [isOpen, userId, week]);

  const loadRecapData = async () => {
    setLoading(true);

    const { data: userPickData } = await supabase
      .from('picks')
      .select('*, games(*)')
      .eq('user_id', userId)
      .eq('week', week);

    setPicks(userPickData || []);

    const { data: allPicks } = await supabase.from('picks').select('*, games(*)');
    const { data: profiles } = await supabase.from('profiles').select('*');

    if (allPicks && profiles) {
      setTotalMembers(profiles.length);

      const userScores: Record<string, number> = {};
      profiles.forEach((p) => (userScores[p.id] = 0));

      allPicks.forEach((p) => {
        if (!p.games || p.games.status !== 'post') return;
        const winner = p.games.winner_team;

        if (p.week === 18) {
          if (winner === p.selected_team) userScores[p.user_id] += 1;
        } else {
          if (p.is_lock) {
            if (winner === p.selected_team) userScores[p.user_id] += 2;
            else userScores[p.user_id] -= 1;
          } else {
            if (winner === p.selected_team) userScores[p.user_id] += 1;
          }
        }
      });

      const sortedStandings = profiles
        .map((p) => ({ id: p.id, score: userScores[p.id] || 0 }))
        .sort((a, b) => b.score - a.score);

      const rankIndex = sortedStandings.findIndex((s) => s.id === userId);
      setUserRank(rankIndex !== -1 ? rankIndex + 1 : null);
    }

    setLoading(false);
  };

  if (!isOpen) return null;

  let wins = 0;
  let losses = 0;
  let weekPoints = 0;
  const maxPossibleWins = week === 18 ? 16 : 6;

  picks.forEach((p) => {
    if (p.games?.status === 'post') {
      const winner = p.games.winner_team;
      const isWin = winner === p.selected_team;

      if (isWin) {
        wins++;
        weekPoints += p.is_lock && week !== 18 ? 2 : 1;
      } else {
        losses++;
        if (p.is_lock && week !== 18) weekPoints -= 1;
      }
    }
  });

  const isPerfect = wins === maxPossibleWins && losses === 0;
  const isWinningRecord = wins > losses;
  const isLosingRecord = losses > wins;

  let cardBorderClass = 'border-gray-800 shadow-2xl';
  let badgeClass = 'bg-gray-800 text-gray-300 border-gray-700';
  let badgeText = `Week ${week} Recap`;

  if (isPerfect) {
    cardBorderClass = 'border-amber-400 shadow-amber-500/20 ring-1 ring-amber-400/50';
    badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-400 font-extrabold';
    badgeText = `🏆 Perfect Week ${week}!`;
  } else if (isWinningRecord) {
    cardBorderClass = 'border-emerald-500 shadow-emerald-500/20 ring-1 ring-emerald-500/50';
    badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-400 font-extrabold';
    badgeText = `📈 Week ${week} Winning Record`;
  } else if (isLosingRecord) {
    cardBorderClass = 'border-red-500 shadow-red-500/20 ring-1 ring-red-500/50';
    badgeClass = 'bg-red-500/20 text-red-300 border-red-400 font-extrabold';
    badgeText = `📉 Week ${week} Results`;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div
        className={`bg-gray-900 border rounded-2xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto flex flex-col gap-4 text-white ${cardBorderClass}`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 border-b border-gray-800 pb-3">
          <img src="/pick-six-logo.png" alt="Pick Six" className="w-10 h-10 object-contain" />
          <div>
            <span className={`text-[10px] px-2 py-0.5 rounded border uppercase tracking-wide ${badgeClass}`}>
              {badgeText}
            </span>
            <h2 className="text-lg font-extrabold text-white mt-1">Week {week} Performance</h2>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-gray-400 font-mono animate-pulse">
            Calculating results...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 bg-gray-800/60 p-3 rounded-xl border border-gray-700/60 text-center font-mono">
              <div>
                <span className="text-[10px] text-gray-400 block">Record</span>
                <span className="text-sm font-bold text-white">
                  {wins}-{losses}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">Points</span>
                <span
                  className={`text-sm font-bold ${
                    weekPoints > 0
                      ? 'text-emerald-400'
                      : weekPoints < 0
                      ? 'text-red-400'
                      : 'text-gray-300'
                  }`}
                >
                  {weekPoints > 0 ? `+${weekPoints}` : weekPoints} pts
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">Standings</span>
                <span className="text-sm font-bold text-amber-400">
                  {userRank ? `#${userRank}` : '-'}{' '}
                  <span className="text-[10px] text-gray-400 font-normal">of {totalMembers}</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-gray-400">Your Pick Breakdown</span>
              {picks.length === 0 ? (
                <p className="text-xs text-gray-500 py-4 text-center">No picks were submitted for Week {week}.</p>
              ) : (
                picks.map((pick) => {
                  const game = pick.games;
                  const isFinished = game?.status === 'post';
                  const winner = game?.winner_team;
                  const isWin = isFinished && winner === pick.selected_team;

                  let scoreText = 'Not Played';
                  if (game) {
                    scoreText = `${game.away_team} ${game.away_score} @ ${game.home_team} ${game.home_score}`;
                  }

                  return (
                    <div
                      key={pick.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                        pick.is_lock
                          ? 'bg-amber-950/20 border-amber-500/40'
                          : 'bg-gray-800/80 border-gray-700/80'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={getTeamLogoUrl(pick.selected_team)}
                          alt=""
                          className="w-5 h-5 object-contain flex-shrink-0"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold truncate flex items-center gap-1 text-white">
                            {getTeamNickname(pick.selected_team)}
                            {pick.is_lock && <span className="text-[10px]">🔒</span>}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono truncate">{scoreText}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                            isWin
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-red-500/20 text-red-300 border-red-500/40'
                          }`}
                        >
                          {isWin ? 'WIN ✓' : 'LOSS ✕'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        <button
          onClick={onClose}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition-colors mt-2"
        >
          Continue to Week {week + 1}
        </button>
      </div>
    </div>
  );
}
