'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getTeamNickname, getTeamLogoUrl, getTeamAbbr } from '@/lib/nflTeams';

// Inject custom gold shimmer animation
const __GOLD_SHIMMER_STYLES = `
@keyframes goldShimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.gold-shimmer-card {
  background: linear-gradient(
    110deg,
    rgba(245, 158, 11, 0.08) 20%,
    rgba(251, 191, 36, 0.28) 35%,
    rgba(245, 158, 11, 0.08) 50%
  );
  background-size: 200% 100%;
  animation: goldShimmer 3.5s infinite linear;
}
`;

if (typeof document !== 'undefined' && !document.getElementById('gold-shimmer-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'gold-shimmer-styles';
  styleEl.textContent = __GOLD_SHIMMER_STYLES;
  document.head.appendChild(styleEl);
}

interface LeaderboardTabProps {
  currentWeek?: number;
}

export default function LeaderboardTab({ currentWeek = 1 }: LeaderboardTabProps) {
  const [standings, setStandings] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [memberPicks, setMemberPicks] = useState<any[]>([]);
  const [viewWeek, setViewWeek] = useState<number>(currentWeek);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, []);

  // Fetch leaderboard data when currentWeek changes
  useEffect(() => {
    fetchLeaderboard();
    setViewWeek(currentWeek);
  }, [currentWeek]);

  useEffect(() => {
    if (selectedMember) fetchMemberPicks(selectedMember.id, viewWeek);
  }, [selectedMember, viewWeek]);

  const fetchLeaderboard = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: picks } = await supabase.from('picks').select('*, games(*)');

    if (!profiles) return;

    const computed = profiles.map((p) => {
      const userPicks = (picks || []).filter((pick) => pick.user_id === p.id);

      // --- Overall Calculations ---
      const totalPoints = userPicks.reduce((acc, curr) => {
        const game = curr.games;
        if (game?.status === 'post') {
          const isWin = curr.selected_team === game.winner_team;
          if (curr.is_lock) {
            return acc + (isWin ? 2.0 : -1.0);
          } else {
            if (isWin) return acc + 1.0;
            if (game.winner_team === 'TIE') return acc + 0.5;
            return acc;
          }
        }
        return acc + (curr.points_awarded || 0);
      }, 0);

      const completedPicks = userPicks.filter((pick) => pick.games?.status === 'post');
      const wins = completedPicks.filter(
        (pick) => pick.selected_team === pick.games?.winner_team
      ).length;
      const losses = completedPicks.filter(
        (pick) =>
          pick.selected_team !== pick.games?.winner_team &&
          pick.games?.winner_team !== 'TIE'
      ).length;

      // --- Current Week Calculations ---
      const weekPicks = userPicks.filter((pick) => pick.week === currentWeek);
      const weekPoints = weekPicks.reduce((acc, curr) => {
        const game = curr.games;
        if (game?.status === 'post') {
          const isWin = curr.selected_team === game.winner_team;
          if (curr.is_lock) {
            return acc + (isWin ? 2.0 : -1.0);
          } else {
            if (isWin) return acc + 1.0;
            if (game.winner_team === 'TIE') return acc + 0.5;
            return acc;
          }
        }
        return acc + (curr.points_awarded || 0);
      }, 0);

      const weekCompletedPicks = weekPicks.filter((pick) => pick.games?.status === 'post');
      const weekWins = weekCompletedPicks.filter(
        (pick) => pick.selected_team === pick.games?.winner_team
      ).length;
      const weekLosses = weekCompletedPicks.filter(
        (pick) =>
          pick.selected_team !== pick.games?.winner_team &&
          pick.games?.winner_team !== 'TIE'
      ).length;

      return {
        ...p,
        totalPoints,
        wins,
        losses,
        weekPoints,
        weekWins,
        weekLosses,
      };
    });

    computed.sort((a, b) => b.totalPoints - a.totalPoints || b.wins - a.wins);

    let currentRank = 1;
    const rankedStandings = computed.map((user, index, arr) => {
      if (index > 0) {
        const prevUser = arr[index - 1];
        if (user.totalPoints < prevUser.totalPoints) {
          currentRank = index + 1;
        }
      }

      const isFirstOfTie =
        index === 0 || user.totalPoints !== arr[index - 1].totalPoints;

      return {
        ...user,
        rank: currentRank,
        isFirstOfTie,
        isFirstPlace: currentRank === 1,
      };
    });

    setStandings(rankedStandings);
  };

  const fetchMemberPicks = async (userId: string, week: number) => {
    const { data } = await supabase
      .from('picks')
      .select('*, games(*)')
      .eq('user_id', userId)
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

    const standardPicks = sanitizedPicks.filter((p) => !p.is_lock);
    const lockPick = sanitizedPicks.find((p) => p.is_lock);
    const orderedPicks = lockPick ? [...standardPicks, lockPick] : sanitizedPicks;

    setMemberPicks(orderedPicks);
  };

  const handleOpenMemberModal = (user: any) => {
    setSelectedMember(user);
    setViewWeek(currentWeek || 1);
  };

  return (
    <div className="flex flex-col gap-4 pb-24 max-w-2xl mx-auto px-4 pt-4 text-white">
      <h2 className="text-xl font-bold flex items-center gap-2">League Standings</h2>

      <div className="flex flex-col gap-2">
        {standings.map((user, index) => {
          const isCurrentUser = user.id === currentUserId;
          const initials = `${user.first_name?.slice(0, 1) || ''}${
            user.last_name?.slice(0, 1) || ''
          }`.toUpperCase() || 'PS';
          const champYear = user.championships ? String(user.championships).trim() : '';

          const isFirstPlace = user.isFirstPlace;
          const nextUser = standings[index + 1];
          const showSeparator = isFirstPlace && nextUser && !nextUser.isFirstPlace;

          let cardStyle = 'bg-gray-900 border-gray-800';
          if (isFirstPlace) {
            cardStyle = 'gold-shimmer-card border-amber-500/50 shadow-lg shadow-amber-500/10';
          }
          if (isCurrentUser) {
            cardStyle += ' border-emerald-500 shadow-lg ring-1 ring-emerald-500';
          }

          return (
            <div key={user.id} className="flex flex-col gap-2">
              <div
                onClick={() => handleOpenMemberModal(user)}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all hover:border-emerald-500/50 ${cardStyle}`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-sm font-mono w-6 text-center text-gray-400">
                    {isFirstPlace
                      ? '👑'
                      : user.isFirstOfTie
                      ? `#${user.rank}`
                      : ''}
                  </span>

                  <div
                    className={`w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-indigo-600 border flex items-center justify-center font-bold text-xs text-white overflow-hidden ${
                      isFirstPlace ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-emerald-500'
                    }`}
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-xs text-white">{user.team_name}</p>
                      {isCurrentUser && (
                        <span className="text-[9px] bg-emerald-500 text-black px-1.5 py-0.2 rounded font-bold uppercase">
                          YOU
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400">
                      {user.first_name} {user.last_name}
                    </p>

                    {champYear && (
                      <span className="text-[10px] font-semibold text-amber-400 flex items-center gap-1 mt-0.5">
                        <span>🏆</span> {champYear} Champion
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <span
                    className={`font-extrabold text-base font-mono leading-none ${
                      isFirstPlace ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {user.totalPoints} {user.totalPoints === 1 ? 'pt' : 'pts'}
                  </span>
                  <p className="text-[11px] text-gray-200 font-mono mt-1">
                    Overall: {user.wins}-{user.losses}
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                    Wk {currentWeek}: {user.weekWins}-{user.weekLosses}, {user.weekPoints} {user.weekPoints === 1 ? 'pt' : 'pts'}
                  </p>
                </div>
              </div>

              {/* Gold dotted line separator below 1st place */}
              {showSeparator && (
                <div className="my-2 border-b border-dashed border-amber-500/40 relative">
                  <span className="absolute -top-2.5 right-4 bg-gray-950 px-2 text-[9px] font-bold text-amber-400/80 uppercase tracking-widest">
                    1ST PLACE
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedMember && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-5 shadow-2xl relative flex flex-col gap-3">
            <button
              onClick={() => setSelectedMember(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white font-bold text-sm"
            >
              ✕
            </button>

            <div>
              <h3 className="font-bold text-base text-white">
                {selectedMember.team_name}
              </h3>
              <p className="text-xs text-gray-400">
                {selectedMember.first_name} {selectedMember.last_name} •{' '}
                {selectedMember.totalPoints} pts
              </p>
            </div>

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
                {memberPicks.length}/6 Picks
              </span>
            </div>

            <div className="flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto pr-0.5">
              {memberPicks.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-8">
                  No picks submitted for Week {viewWeek}
                </p>
              ) : (
                memberPicks.map((pick) => {
                  const game = pick.games;
                  const isLocked = new Date() >= new Date(game?.kickoff_time);
                  const isSelf = selectedMember.id === currentUserId;

                  if (!isLocked && !isSelf) {
                    return (
                      <div
                        key={pick.id}
                        className="bg-gray-800/50 p-2.5 rounded-lg border border-gray-700/50 flex justify-between items-center text-xs"
                      >
                        <span className="text-gray-400 font-bold">
                          🔒 Hidden Pick (Kickoff Pending)
                        </span>
                      </div>
                    );
                  }

                  const isFinished = game?.status === 'post';
                  const teamNick = getTeamNickname(pick.selected_team);
                  const isHome = game?.home_team === pick.selected_team;
                  const opponentName = game
                    ? isHome
                      ? game.away_team
                      : game.home_team
                    : null;
                  const oppAbbr = opponentName ? getTeamAbbr(opponentName) : '';
                  const oppPrefix = isHome ? 'vs' : '@';

                  const selectedScore = isHome ? game?.home_score : game?.away_score;
                  const oppScore = isHome ? game?.away_score : game?.home_score;

                  let outcome = '';
                  let outcomeBadgeColor = 'text-gray-400';
                  let cardBgBorder = 'bg-gray-800/80 border-gray-700/80';

                  let pts = pick.points_awarded ?? 0;
                  if (isFinished) {
                    const isWin = game.winner_team === pick.selected_team;
                    if (pick.is_lock) {
                      pts = isWin ? 2.0 : -1.0;
                    } else {
                      if (isWin) pts = 1.0;
                      else if (game.winner_team === 'TIE') pts = 0.5;
                      else pts = 0.0;
                    }
                  }

                  let formattedPts = '0';
                  let ptsColor = 'text-gray-400';

                  if (isFinished) {
                    if (game.winner_team === pick.selected_team) {
                      outcome = 'W';
                      outcomeBadgeColor = 'text-emerald-400';
                      cardBgBorder = 'bg-emerald-950/30 border-emerald-500/60';
                    } else if (game.winner_team === 'TIE') {
                      outcome = 'T';
                      outcomeBadgeColor = 'text-amber-400';
                      cardBgBorder = 'bg-amber-950/30 border-amber-500/60';
                    } else {
                      outcome = 'L';
                      outcomeBadgeColor = 'text-red-400';
                      cardBgBorder = 'bg-red-950/30 border-red-500/60';
                    }

                    if (pts > 0) {
                      formattedPts = `+${pts}`;
                      ptsColor = 'text-emerald-400';
                    } else if (pts < 0) {
                      formattedPts = `${pts}`;
                      ptsColor = 'text-red-400';
                    } else {
                      formattedPts = '0';
                      ptsColor = 'text-gray-400';
                    }
                  } else {
                    if (pick.is_lock) {
                      cardBgBorder = 'bg-amber-950/20 border-amber-500/60';
                    }
                  }

                  return (
                    <div key={pick.id} className="flex flex-col gap-1">
                      {pick.is_lock && (
                        <div className="flex items-center gap-1.5 pt-1.5 pb-0.5 px-0.5">
                          <span className="text-[10px] font-extrabold tracking-wider text-amber-400 uppercase flex items-center gap-1">
                            🔒 LOCK OF THE WEEK
                          </span>
                          <div className="h-[1px] flex-1 bg-amber-500/30" />
                        </div>
                      )}

                      <div
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${cardBgBorder}`}
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

                        <div className="flex items-center gap-3 flex-shrink-0">
                          {isFinished && (
                            <span
                              className={`font-mono font-bold text-[11px] ${outcomeBadgeColor}`}
                            >
                              {outcome} {selectedScore}-{oppScore}
                            </span>
                          )}
                          <span
                            className={`font-mono font-bold min-w-[24px] text-right ${ptsColor}`}
                          >
                            {formattedPts}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
