'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getTeamNickname, getTeamLogoUrl, getTeamAbbr } from '@/lib/nflTeams';

export default function LeaderboardTab() {
  const [standings, setStandings] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [memberPicks, setMemberPicks] = useState<any[]>([]);
  const [viewWeek, setViewWeek] = useState<number>(1);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    if (selectedMember) fetchMemberPicks(selectedMember.id, viewWeek);
  }, [selectedMember, viewWeek]);

  const fetchLeaderboard = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: picks } = await supabase.from('picks').select('*, games(*)');

    if (!profiles) return;

    const computed = profiles.map((p) => {
      const userPicks = (picks || []).filter((pick) => pick.user_id === p.id);
      const totalPoints = userPicks.reduce((acc, curr) => acc + (curr.points_awarded || 0), 0);

      const completedPicks = userPicks.filter((pick) => pick.games?.status === 'post');
      const wins = completedPicks.filter((pick) => (pick.points_awarded || 0) > 0).length;
      const losses = completedPicks.filter((pick) => (pick.points_awarded || 0) < 0 || (pick.points_awarded === 0 && pick.games?.winner_team !== 'TIE')).length;

      return {
        ...p,
        totalPoints,
        wins,
        losses,
      };
    });

    computed.sort((a, b) => b.totalPoints - a.totalPoints);
    setStandings(computed);
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

    // Ensure Lock of the Week is always sorted at the bottom
    const standardPicks = sanitizedPicks.filter((p) => !p.is_lock);
    const lockPick = sanitizedPicks.find((p) => p.is_lock);
    const orderedPicks = lockPick ? [...standardPicks, lockPick] : sanitizedPicks;

    setMemberPicks(orderedPicks);
  };

  return (
    <div className="flex flex-col gap-4 pb-24 max-w-2xl mx-auto px-4 pt-4 text-white">
      <h2 className="text-xl font-bold flex items-center gap-2">🏆 Standings</h2>

      <div className="flex flex-col gap-2">
        {standings.map((user, index) => {
          const isCurrentUser = user.id === currentUserId;
          const initials = `${user.first_name?.slice(0, 1) || ''}${user.last_name?.slice(0, 1) || ''}`.toUpperCase() || 'PS';

          return (
            <div
              key={user.id}
              onClick={() => setSelectedMember(user)}
              className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all hover:border-emerald-500/50 ${
                isCurrentUser
                  ? 'bg-emerald-950/60 border-emerald-500 shadow-lg ring-1 ring-emerald-500'
                  : 'bg-gray-900 border-gray-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-extrabold text-sm font-mono w-5 text-gray-400">
                  {index === 0 ? '👑' : `#${index + 1}`}
                </span>

                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-indigo-600 border border-emerald-500 flex items-center justify-center font-bold text-xs text-white overflow-hidden">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
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
                </div>
              </div>

              <div className="text-right">
                <span className="font-extrabold text-base text-emerald-400 font-mono">
                  {user.totalPoints} {user.totalPoints === 1 ? 'pt' : 'pts'}
                </span>
                <p className="text-[10px] text-gray-400 font-mono">
                  {user.wins}-{user.losses}
                </p>
              </div>
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
                {selectedMember.first_name} {selectedMember.last_name} • {selectedMember.totalPoints} pts
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
                        <span className="text-gray-400 font-bold">🔒 Hidden Pick (Kickoff Pending)</span>
                      </div>
                    );
                  }

                  const isFinished = game?.status === 'post';
                  const teamNick = getTeamNickname(pick.selected_team);
                  const isHome = game?.home_team === pick.selected_team;
                  const opponentName = game ? (isHome ? game.away_team : game.home_team) : null;
                  const oppAbbr = opponentName ? getTeamAbbr(opponentName) : '';
                  const oppPrefix = isHome ? 'vs' : '@';

                  const selectedScore = isHome ? game?.home_score : game?.away_score;
                  const oppScore = isHome ? game?.away_score : game?.home_score;

                  let outcome = '';
                  let outcomeBadgeColor = 'text-gray-400';
                  let cardBgBorder = 'bg-gray-800/80 border-gray-700/80';
                  const pts = pick.points_awarded ?? 0;
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
                      {/* Gold Section Header right above Lock of the Week */}
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
                            <span className={`font-mono font-bold text-[11px] ${outcomeBadgeColor}`}>
                              {outcome} {selectedScore}-{oppScore}
                            </span>
                          )}
                          <span className={`font-mono font-bold min-w-[24px] text-right ${ptsColor}`}>
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
