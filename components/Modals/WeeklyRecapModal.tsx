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
  const [seasonWins, setSeasonWins] = useState(0);
  const [seasonLosses, setSeasonLosses] = useState(0);
  const [seasonPoints, setSeasonPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && userId && week >= 1) {
      loadRecapData();
    }
  }, [isOpen, userId, week]);

  const loadRecapData = async () => {
    setLoading(true);

    // 1. Fetch user picks for selected week
    const { data: userPickData } = await supabase
      .from('picks')
      .select('*, games(*)')
      .eq('user_id', userId)
      .eq('week', week);

    setPicks(userPickData || []);

    // 2. Fetch all season picks to compute season stats & standings
    const { data: allPicks } = await supabase.from('picks').select('*, games(*)');
    const { data: profiles } = await supabase.from('profiles').select('*');

    if (allPicks && profiles) {
      setTotalMembers(profiles.length);

      const userScores: Record<string, number> = {};
      profiles.forEach((p) => (userScores[p.id] = 0));

      let sWins = 0;
      let sLosses = 0;
      let sPoints = 0;

      allPicks.forEach((p) => {
        if (!p.games || p.games.status !== 'post') return;
        const winner = p.games.winner_team;
        const isUser = p.user_id === userId;
        const isUpToWeek = p.week <= week;

        let points = 0;
        let isWin = winner === p.selected_team;

        if (p.week === 18) {
          if (isWin) points = 1;
        } else {
          if (p.is_lock) {
            if (isWin) points = 2;
            else points = -1;
          } else {
            if (isWin) points = 1;
          }
        }

        userScores[p.user_id] += points;

        if (isUser && isUpToWeek) {
          sPoints += points;
          if (isWin) sWins++;
          else sLosses++;
        }
      });

      setSeasonWins(sWins);
      setSeasonLosses(sLosses);
      setSeasonPoints(sPoints);

      const sortedStandings = profiles
        .map((p) => ({ id: p.id, score: userScores[p.id] || 0 }))
        .sort((a, b) => b.score - a.score);

      const rankIndex = sortedStandings.findIndex((s) => s.id === userId);
      setUserRank(rankIndex !== -1 ? rankIndex + 1 : null);
    }

    setLoading(false);
  };

  if (!isOpen) return null;

  // Calculate target week stats
  let wins = 0;
  let losses = 0;
  let weekPoints = 0;

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

  // Dynamic Headline Matrix
  const getHeadline = (w: number, l: number) => {
    const key = `${w}-${l}`;
    switch (key) {
      case '6-0':
      case '16-0':
        return 'PERFECTION!';
      case '5-1':
        return 'Great job!';
      case '4-2':
        return 'A winning week!';
      case '3-3':
        return 'Even Steven!';
      case '2-4':
        return 'Oof, tough one.';
      case '1-5':
        return 'Could be worse!';
      case '0-6':
        return 'Welp…';
      default:
        if (w > l) return 'A winning week!';
        if (w === l) return 'Even Steven!';
        return 'Oof, tough one.';
    }
  };

  const isPerfect = wins === (week === 18 ? 16 : 6) && losses === 0;
  const isWinning = wins > losses;
  const isLosing = losses > wins;

  let cardBorderClass = 'border-gray-800 shadow-2xl';
  if (isPerfect) cardBorderClass = 'border-amber-400 shadow-amber-500/20 ring-1 ring-amber-400/50';
  else if (isWinning) cardBorderClass = 'border-emerald-500 shadow-emerald-500/20 ring-1 ring-emerald-500/50';
  else if (isLosing) cardBorderClass = 'border-red-500 shadow-red-500/20 ring-1 ring-red-500/50';

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

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-800 pb-3">
          <img src="/pick-six-logo.png" alt="Pick Six" className="w-10 h-10 object-contain" />
          <div>
            <span className="text-[10px] px-2 py-0.5 rounded border border-gray-700 bg-gray-800 text-gray-300 font-bold uppercase tracking-wide">
              Week {week} Recap
            </span>
            <h2 className="text-xl font-extrabold text-white mt-0.5">
              {getHeadline(wins, losses)}
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-gray-400 font-mono animate-pulse">
            Calculating results...
          </div>
        ) : (
          <>
            {/* Multi-line Stats Summary Box */}
            <div className="grid grid-cols-3 gap-2 bg-gray-800/60 p-3 rounded-xl border border-gray-700/60 font-mono">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 uppercase">Record</span>
                <span className="text-xs font-bold text-white mt-0.5">
                  This Week: <span className="text-emerald-400">{wins}-{losses}</span>
                </span>
                <span className="text-[11px] text-gray-400 mt-0.5">
                  Season: {seasonWins}-{seasonLosses}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 uppercase">Points</span>
                <span className="text-xs font-bold text-white mt-0.5">
                  This Week:{' '}
                  <span className={weekPoints > 0 ? 'text-emerald-400' : weekPoints < 0 ? 'text-red-400' : 'text-gray-300'}>
                    {weekPoints > 0 ? `+${weekPoints}` : weekPoints}
                  </span>
                </span>
                <span className="text-[11px] text-gray-400 mt-0.5">
                  Season: {seasonPoints} pts
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 uppercase">Standings</span>
                <span className="text-xs font-bold text-amber-400 mt-0.5">
                  {userRank ? `#${userRank}` : '-'}
                </span>
                <span className="text-[11px] text-gray-400 mt-0.5">
                  of {totalMembers} teams
                </span>
              </div>
            </div>

            {/* Pick Results List */}
            <div className="flex flex-col gap-2">
              {picks.length === 0 ? (
                <p className="text-xs text-gray-500 py-4 text-center">No picks were submitted for Week {week}.</p>
              ) : (
                picks.map((pick) => {
                  const game = pick.games;
                  const isFinished = game?.status === 'post';
                  const winner = game?.winner_team;
                  const isWin = isFinished && winner === pick.selected_team;

                  // Determine Home vs Away Opponent string
                  let opponentText = '';
                  let selectedScore = 0;
                  let opponentScore = 0;

                  if (game) {
                    const isHome = pick.selected_team === game.home_team;
                    const opponentTeam = isHome ? game.away_team : game.home_team;
                    opponentText = `${isHome ? 'vs' : '@'} ${getTeamNickname(opponentTeam)}`;
                    selectedScore = isHome ? game.home_score : game.away_score;
                    opponentScore = isHome ? game.away_score : game.home_score;
                  }

                  return (
                    <div
                      key={pick.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                        pick.is_lock
                          ? 'bg-amber-950/20 border-2 border-amber-400'
                          : 'bg-gray-800/80 border-gray-700/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <img
                          src={getTeamLogoUrl(pick.selected_team)}
                          alt=""
                          className="w-5 h-5 object-contain flex-shrink-0"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-white truncate flex items-center gap-1">
                            {getTeamNickname(pick.selected_team)}
                            {pick.is_lock && <span className="text-[10px]">🔒</span>}
                          </span>
                          <span className="text-[11px] text-gray-400 font-medium truncate">
                            {opponentText}
                          </span>
                        </div>
                      </div>

                      {/* Score Outcome Box */}
                      <div className="flex items-center flex-shrink-0">
                        {isFinished ? (
                          <div
                            className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold shadow ${
                              isWin
                                ? 'bg-emerald-600 border-emerald-500 text-white'
                                : 'bg-red-600 border-red-500 text-white'
                            }`}
                          >
                            {isWin ? 'W' : 'L'} {selectedScore}-{opponentScore}
                          </div>
                        ) : (
                          <div className="px-2.5 py-1 rounded-lg border border-gray-700 bg-gray-800 text-amber-400 text-xs font-mono font-bold">
                            PENDING
                          </div>
                        )}
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
