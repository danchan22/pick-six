'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getTeamNickname, getTeamLogoUrl, getTeamAbbr } from '@/lib/nflTeams';

interface Game {
  id: string;
  week: number;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  status: string;
  winner_team: string | null;
}

interface Pick {
  id: string;
  game_id: string;
  selected_team: string;
  is_lock: boolean;
  points_awarded?: number;
  games?: Game;
}

export default function PicksTab({ userId, currentWeek }: { userId: string; currentWeek: number }) {
  const [selectedWeek, setSelectedWeek] = useState(currentWeek || 1);
  const [games, setGames] = useState<Game[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [teamPickCounts, setTeamPickCounts] = useState<Record<string, number>>({});
  const [forceUnlockForTesting, setForceUnlockForTesting] = useState(false);

  useEffect(() => {
    if (currentWeek) setSelectedWeek(currentWeek);
  }, [currentWeek]);

  useEffect(() => {
    fetchWeekGames();
    fetchUserPicks();
    fetchSeasonTeamCounts();
  }, [selectedWeek, userId]);

  const fetchWeekGames = async () => {
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('week', selectedWeek)
      .order('kickoff_time', { ascending: true });
    setGames(data || []);
  };

  const fetchUserPicks = async () => {
    const { data } = await supabase
      .from('picks')
      .select('*, games(*)')
      .eq('user_id', userId)
      .eq('week', selectedWeek);
    setPicks(data || []);
  };

  const fetchSeasonTeamCounts = async () => {
    const { data } = await supabase
      .from('picks')
      .select('selected_team')
      .eq('user_id', userId);

    const counts: Record<string, number> = {};
    (data || []).forEach((p) => {
      counts[p.selected_team] = (counts[p.selected_team] || 0) + 1;
    });
    setTeamPickCounts(counts);
  };

  const deletePick = async (pickId: string) => {
    const { error } = await supabase.from('picks').delete().eq('id', pickId);
    if (!error) {
      setPicks((prev) => prev.filter((p) => p.id !== pickId));
      fetchSeasonTeamCounts();
    }
  };

  const handleSelectTeam = async (gameId: string, team: string) => {
    const existingPick = picks.find((p) => p.game_id === gameId);

    if (existingPick?.selected_team === team) {
      await deletePick(existingPick.id);
    } else if (existingPick) {
      const { error } = await supabase
        .from('picks')
        .update({ selected_team: team })
        .eq('id', existingPick.id);
      if (!error) fetchUserPicks();
    } else {
      if (picks.length >= 6) return;
      const { error } = await supabase.from('picks').insert({
        user_id: userId,
        game_id: gameId,
        week: selectedWeek,
        selected_team: team,
        is_lock: false,
      });
      if (!error) fetchUserPicks();
    }

    fetchSeasonTeamCounts();
  };

  const handleToggleLock = async (gameId: string) => {
    const existingPick = picks.find((p) => p.game_id === gameId);
    if (!existingPick) return;

    const newLockState = !existingPick.is_lock;
    if (newLockState) {
      await supabase
        .from('picks')
        .update({ is_lock: false })
        .eq('user_id', userId)
        .eq('week', selectedWeek);
    }

    await supabase
      .from('picks')
      .update({ is_lock: newLockState })
      .eq('id', existingPick.id);

    fetchUserPicks();
  };

  const isGameLocked = (kickoffTime: string) => {
    if (forceUnlockForTesting) return false;
    return new Date() >= new Date(kickoffTime);
  };

  const standardPicks = picks.filter((p) => !p.is_lock);
  const lockPick = picks.find((p) => p.is_lock);

  const orderedPicks: (Pick | null)[] = [
    standardPicks[0] || null,
    standardPicks[1] || null,
    standardPicks[2] || null,
    standardPicks[3] || null,
    standardPicks[4] || null,
    lockPick || standardPicks[5] || null,
  ];

  return (
    <div className="flex flex-col gap-4 pb-24 max-w-2xl mx-auto px-4 pt-2 text-white relative">
      {/* Sticky Header Container (Week Nav + Floating My Picks Widget) */}
      <div className="sticky top-[53px] z-20 bg-gray-950/95 backdrop-blur-md pt-2 pb-3 -mx-4 px-4 flex flex-col gap-3 border-b border-gray-800/80 shadow-2xl">
        {/* Week Selector Bar with Arrows */}
        <div className="flex justify-between items-center bg-gray-900 p-2.5 rounded-xl border border-gray-800">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSelectedWeek((prev) => Math.max(1, prev - 1))}
              disabled={selectedWeek <= 1}
              className="w-7 h-7 flex items-center justify-center bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-lg text-xs font-bold transition-colors"
            >
              ◀
            </button>

            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              className="bg-gray-800 text-xs font-bold text-white px-3 py-1.5 rounded-lg border border-gray-700 focus:outline-none"
            >
              {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>

            <button
              onClick={() => setSelectedWeek((prev) => Math.min(18, prev + 1))}
              disabled={selectedWeek >= 18}
              className="w-7 h-7 flex items-center justify-center bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-lg text-xs font-bold transition-colors"
            >
              ▶
            </button>
          </div>

          <button
            onClick={() => setForceUnlockForTesting(!forceUnlockForTesting)}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${
              forceUnlockForTesting
                ? 'bg-amber-950 text-amber-300 border-amber-500'
                : 'bg-gray-800 text-gray-400 border-gray-700'
            }`}
          >
            {forceUnlockForTesting ? '🧪 Dev Unlocked' : 'Test Locks'}
          </button>
        </div>

        {/* Floating My Picks Widget */}
        <div className="bg-gray-900 border border-gray-800 p-3 rounded-xl flex flex-col gap-1.5 shadow-xl">
          <div className="flex justify-between items-center">
            <h3 className="text-[11px] font-extrabold text-gray-300 tracking-wider">MY PICKS</h3>
            <span className="text-[10px] text-gray-500 font-medium">Tap slot to remove</span>
          </div>

          <div className="flex justify-between items-start gap-1">
            {orderedPicks.map((pick, i) => {
              let game = games.find((g) => g.id === pick?.game_id) || pick?.games;
              let isHome = game?.home_team === pick?.selected_team;
              let opponentName = game ? (isHome ? game.away_team : game.home_team) : null;
              let oppAbbr = opponentName ? getTeamAbbr(opponentName) : '';
              let oppPrefix = isHome ? 'vs' : '@';

              let outcomeLabel = '?';
              let outcomeColor = 'text-gray-500';
              let slotBg = 'bg-white';

              if (game?.status === 'post' && pick) {
                if (pick.selected_team === game.winner_team) {
                  outcomeLabel = 'W';
                  outcomeColor = 'text-emerald-400';
                  slotBg = 'bg-emerald-100';
                } else if (game.winner_team === 'TIE') {
                  outcomeLabel = 'T';
                  outcomeColor = 'text-amber-400';
                  slotBg = 'bg-amber-100';
                } else {
                  outcomeLabel = 'L';
                  outcomeColor = 'text-red-400';
                  slotBg = 'bg-red-100';
                }
              }

              const isSlotLock = pick?.is_lock || (i === 5 && lockPick);

              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <span className={`text-[11px] font-black ${outcomeColor}`}>
                    {outcomeLabel}
                  </span>

                  <button
                    onClick={() => pick && deletePick(pick.id)}
                    className={`w-full aspect-square max-w-[48px] rounded-lg border flex items-center justify-center p-1 relative shadow-sm transition-transform active:scale-95 ${slotBg} ${
                      isSlotLock ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-gray-300'
                    }`}
                  >
                    {pick ? (
                      <img
                        src={getTeamLogoUrl(pick.selected_team)}
                        alt={pick.selected_team}
                        className="w-6 h-6 object-contain"
                      />
                    ) : (
                      <span className="text-gray-400 font-bold text-xs">?</span>
                    )}

                    {isSlotLock && (
                      <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-gray-900 border border-amber-400 rounded-full w-4 h-4 flex items-center justify-center shadow-md">
                        <span className="text-[9px]">🔒</span>
                      </div>
                    )}
                  </button>

                  <span className="text-[9px] font-semibold text-gray-400 truncate w-full text-center mt-0.5">
                    {pick ? `${oppPrefix} ${oppAbbr}` : '-'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="text-[11px] font-semibold text-gray-400 text-right px-1">
        All Times Eastern
      </div>

      {/* Matchup Schedule Cards */}
      <div className="flex flex-col gap-3">
        {games.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-xs">
            No games loaded for Week {selectedWeek}. (Use Admin panel to sync schedule).
          </div>
        ) : (
          games.map((game) => {
            const locked = isGameLocked(game.kickoff_time);
            const currentPick = picks.find((p) => p.game_id === game.id);
            const homeNickname = getTeamNickname(game.home_team);
            const awayNickname = getTeamNickname(game.away_team);

            return (
              <div
                key={game.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col gap-3"
              >
                <div className="flex justify-between items-center text-[11px] text-gray-400 border-b border-gray-800 pb-1.5">
                  <span>
                    {new Date(game.kickoff_time).toLocaleDateString([], {
                      weekday: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                  {locked && <span className="text-red-400 font-bold">🔒</span>}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { full: game.away_team, nick: awayNickname },
                    { full: game.home_team, nick: homeNickname },
                  ].map((team) => {
                    const isSelected = currentPick?.selected_team === team.full;
                    const count = teamPickCounts[team.full] || 0;
                    const disabled = locked || (count >= 6 && !isSelected);

                    let btnColor = 'bg-gray-800/80 border-gray-700/80 text-gray-300 hover:border-gray-500';
                    if (isSelected) {
                      if (game.status === 'post') {
                        if (team.full === game.winner_team) btnColor = 'bg-emerald-600/30 border-emerald-500 text-white font-bold';
                        else if (game.winner_team === 'TIE') btnColor = 'bg-amber-600/30 border-amber-500 text-white font-bold';
                        else btnColor = 'bg-red-600/30 border-red-500 text-white font-bold';
                      } else {
                        btnColor = 'bg-blue-600/30 border-blue-500 text-white font-bold';
                      }
                    }

                    return (
                      <button
                        key={team.full}
                        disabled={disabled}
                        onClick={() => handleSelectTeam(game.id, team.full)}
                        className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 transition-all ${btnColor} ${
                          disabled ? 'opacity-40 cursor-not-allowed' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={getTeamLogoUrl(team.full)}
                            alt={team.nick}
                            className="w-6 h-6 object-contain"
                          />
                          <span className="text-xs font-semibold">{team.nick}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">{count}/6</span>
                      </button>
                    );
                  })}
                </div>

                {currentPick && (
                  <button
                    disabled={locked}
                    onClick={() => handleToggleLock(game.id)}
                    className={`py-1 text-xs font-bold rounded-md border transition-all ${
                      currentPick.is_lock
                        ? 'bg-amber-500 text-black border-amber-400'
                        : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
                    }`}
                  >
                    {currentPick.is_lock ? '🔒 Lock of the Week' : 'Set as Lock of the Week'}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
