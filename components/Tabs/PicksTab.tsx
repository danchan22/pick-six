'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getTeamNickname, getTeamLogoUrl } from '@/lib/nflTeams';

interface Game {
  id: string;
  week: number;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  status: string;
}

interface Pick {
  id?: string;
  game_id: string;
  selected_team: string;
  is_lock: boolean;
}

export default function PicksTab({ userId, currentWeek: initialWeek }: { userId: string; currentWeek: number }) {
  const [selectedWeek, setSelectedWeek] = useState(initialWeek);
  const [games, setGames] = useState<Game[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [teamPickCounts, setTeamPickCounts] = useState<Record<string, number>>({});
  const [forceUnlockForTesting, setForceUnlockForTesting] = useState(false);

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
      .select('*')
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

  const handleSelectTeam = async (gameId: string, team: string) => {
    const existingPick = picks.find((p) => p.game_id === gameId);

    if (existingPick?.selected_team === team) {
      await supabase.from('picks').delete().eq('id', existingPick.id);
    } else if (existingPick) {
      await supabase
        .from('picks')
        .update({ selected_team: team })
        .eq('id', existingPick.id);
    } else {
      if (picks.length >= 6) return;
      await supabase.from('picks').insert({
        user_id: userId,
        game_id: gameId,
        week: selectedWeek,
        selected_team: team,
        is_lock: false,
      });
    }

    fetchUserPicks();
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

  // Top 6 Picks Slot Display
  const pickSlots = Array.from({ length: 6 }, (_, index) => picks[index] || null);

  return (
    <div className="flex flex-col gap-4 pb-24 max-w-2xl mx-auto px-4 pt-4 text-white">
      {/* Week Navigation + Dev Testing Switch */}
      <div className="flex justify-between items-center bg-gray-900 p-3 rounded-xl border border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400">Week:</span>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
            className="bg-gray-800 text-xs font-bold text-white px-2 py-1 rounded border border-gray-700"
          >
            {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setForceUnlockForTesting(!forceUnlockForTesting)}
          className={`text-[10px] font-bold px-2.5 py-1 rounded border ${
            forceUnlockForTesting
              ? 'bg-amber-950 text-amber-300 border-amber-500'
              : 'bg-gray-800 text-gray-400 border-gray-700'
          }`}
        >
          {forceUnlockForTesting ? '🧪 Dev Unlock Active' : 'Test Locks'}
        </button>
      </div>

      {/* Top 6 Pick Logos Row */}
      <div className="bg-gray-900 border border-gray-800 p-3 rounded-xl flex justify-between items-center gap-1">
        {pickSlots.map((pick, i) => (
          <div
            key={i}
            className={`flex-1 aspect-square max-w-[56px] rounded-lg border flex flex-col items-center justify-center p-1 relative ${
              pick
                ? pick.is_lock
                  ? 'border-amber-400 bg-amber-500/10'
                  : 'border-emerald-500 bg-emerald-500/10'
                : 'border-dashed border-gray-700 bg-gray-950/40'
            }`}
          >
            {pick ? (
              <>
                <img
                  src={getTeamLogoUrl(pick.selected_team)}
                  alt={pick.selected_team}
                  className="w-7 h-7 object-contain"
                />
                {pick.is_lock && (
                  <span className="absolute -top-1 -right-1 text-[10px]">🔒</span>
                )}
              </>
            ) : (
              <span className="text-gray-500 font-bold text-xs">?</span>
            )}
          </div>
        ))}
      </div>

      {/* Games List */}
      <div className="flex flex-col gap-3">
        {games.map((game) => {
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
                {locked && <span className="text-red-400 font-bold">🔒 LOCKED</span>}
              </div>

              {/* Matchup Teams */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { full: game.away_team, nick: awayNickname },
                  { full: game.home_team, nick: homeNickname },
                ].map((team) => {
                  const isSelected = currentPick?.selected_team === team.full;
                  const count = teamPickCounts[team.full] || 0;
                  const disabled = locked || (count >= 6 && !isSelected);

                  return (
                    <button
                      key={team.full}
                      disabled={disabled}
                      onClick={() => handleSelectTeam(game.id, team.full)}
                      className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 transition-all ${
                        isSelected
                          ? 'bg-emerald-600/20 border-emerald-500 text-white font-bold'
                          : 'bg-gray-800/80 border-gray-700/80 text-gray-300 hover:border-gray-500'
                      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
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

              {/* Lock Toggle */}
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
                  {currentPick.is_lock ? '🔒 Lock of the Week' : 'Set as Lock'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
