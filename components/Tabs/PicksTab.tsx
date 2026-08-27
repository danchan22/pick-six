'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getTeamLogoUrl, getTeamNickname } from '@/lib/nflTeams';

interface PicksTabProps {
  userId: string;
  currentWeek: number;
  onPicksChanged?: (count: number, hasLock: boolean) => void;
}

export default function PicksTab({ userId, currentWeek, onPicksChanged }: PicksTabProps) {
  const [selectedWeek, setSelectedWeek] = useState<number>(currentWeek);
  const [games, setGames] = useState<any[]>([]);
  const [picks, setPicks] = useState<any[]>([]);
  const [userPickCounts, setUserPickCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (currentWeek) setSelectedWeek(currentWeek);
  }, [currentWeek]);

  useEffect(() => {
    if (userId) {
      fetchWeekData();
      fetchSeasonPickCounts();
    }
  }, [userId, selectedWeek]);

  useEffect(() => {
    if (onPicksChanged) {
      const lockExists = picks.some((p) => p.is_lock);
      onPicksChanged(picks.length, lockExists);
    }
  }, [picks]);

  const fetchWeekData = async () => {
    setLoading(true);
    // 1. Fetch matchups
    const { data: gameData } = await supabase
      .from('games')
      .select('*')
      .eq('week', selectedWeek)
      .order('kickoff_time', { ascending: true });

    // 2. Fetch user picks for this week
    const { data: pickData } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', userId)
      .eq('week', selectedWeek);

    setGames(gameData || []);
    setPicks(pickData || []);
    setLoading(false);
  };

  const fetchSeasonPickCounts = async () => {
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

  const handleSelectTeam = async (game: any, team: string) => {
    setStatusMsg(null);
    const now = new Date();
    const kickoff = new Date(game.kickoff_time);

    if (now >= kickoff) {
      setStatusMsg('This game has already started and is locked.');
      return;
    }

    const existingPick = picks.find((p) => p.game_id === game.id);

    // If tapping team already selected -> deselect
    if (existingPick?.selected_team === team) {
      const { error } = await supabase.from('picks').delete().eq('id', existingPick.id);
      if (!error) {
        setPicks((prev) => prev.filter((p) => p.id !== existingPick.id));
        fetchSeasonPickCounts();
      }
      return;
    }

    // Check season 6-use limit
    const currentTeamUses = userPickCounts[team] || 0;
    if (currentTeamUses >= 6 && (!existingPick || existingPick.selected_team !== team)) {
      setStatusMsg(`You have already picked the ${getTeamNickname(team)} 6 times this season.`);
      return;
    }

    // Week 1-17 logic (6 picks max)
    if (selectedWeek !== 18 && !existingPick && picks.length >= 6) {
      setStatusMsg('You can only select 6 teams per week. Deselect a team first.');
      return;
    }

    const hasLock = picks.some((p) => p.is_lock);
    const shouldBeLock = selectedWeek !== 18 && !hasLock && picks.length === 5;

    if (existingPick) {
      // Update existing pick
      const { data, error } = await supabase
        .from('picks')
        .update({ selected_team: team })
        .eq('id', existingPick.id)
        .select()
        .single();

      if (!error && data) {
        setPicks((prev) => prev.map((p) => (p.id === existingPick.id ? data : p)));
        fetchSeasonPickCounts();
      }
    } else {
      // Insert new pick
      const { data, error } = await supabase
        .from('picks')
        .insert({
          user_id: userId,
          game_id: game.id,
          week: selectedWeek,
          selected_team: team,
          is_lock: shouldBeLock,
        })
        .select()
        .single();

      if (!error && data) {
        setPicks((prev) => [...prev, data]);
        fetchSeasonPickCounts();
      }
    }
  };

  const handleToggleLockSlot = async (pickId: string, currentLockState: boolean) => {
    if (selectedWeek === 18) return;
    setStatusMsg(null);

    // If making this pick the lock, unlock any existing lock first
    if (!currentLockState) {
      await supabase
        .from('picks')
        .update({ is_lock: false })
        .eq('user_id', userId)
        .eq('week', selectedWeek);
    }

    const { data, error } = await supabase
      .from('picks')
      .update({ is_lock: !currentLockState })
      .eq('id', pickId)
      .select()
      .single();

    if (!error) {
      setPicks((prev) =>
        prev.map((p) => ({
          ...p,
          is_lock: p.id === pickId ? !currentLockState : false,
        }))
      );
    }
  };

  const isChaosWeek = selectedWeek === 18;
  const requiredCount = isChaosWeek ? 16 : 6;

  // Order picks so Lock is in 6th slot for bar rendering
  const sortedPicksForBar = [...picks].sort((a, b) => {
    if (a.is_lock) return 1;
    if (b.is_lock) return -1;
    return 0;
  });

  return (
    <div className="flex flex-col gap-4 pb-36 max-w-2xl mx-auto px-4 pt-4 text-white">
      {/* Week Navigation Header */}
      <div className="flex justify-between items-center bg-gray-900 p-3 rounded-xl border border-gray-800 shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedWeek((prev) => Math.max(1, prev - 1))}
            disabled={selectedWeek <= 1}
            className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-lg text-xs font-bold transition-colors"
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
                Week {w} {w === 18 ? '(Chaos Week)' : ''}
              </option>
            ))}
          </select>

          <button
            onClick={() => setSelectedWeek((prev) => Math.min(18, prev + 1))}
            disabled={selectedWeek >= 18}
            className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-lg text-xs font-bold transition-colors"
          >
            ▶
          </button>
        </div>

        <div className="font-mono text-right">
          <span className="text-xs font-bold text-emerald-400 block">
            {picks.length}/{requiredCount} Selected
          </span>
          {!isChaosWeek && (
            <span className="text-[10px] text-gray-400">
              {picks.some((p) => p.is_lock) ? '🔒 Lock Set' : '⚠️ Lock Needed'}
            </span>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className="bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs p-3 rounded-xl font-medium shadow-lg">
          {statusMsg}
        </div>
      )}

      {/* Matchups List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-gray-500 font-mono animate-pulse">
          Loading matchups...
        </div>
      ) : games.length === 0 ? (
        <div className="py-12 text-center text-xs text-gray-500">
          No games scheduled for Week {selectedWeek}.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {games.map((game) => {
            const pick = picks.find((p) => p.game_id === game.id);
            const kickoff = new Date(game.kickoff_time);
            const isLocked = new Date() >= kickoff;

            return (
              <div
                key={game.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col gap-2 shadow-sm"
              >
                <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono">
                  <span>
                    {kickoff.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} •{' '}
                    {kickoff.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                  {isLocked ? (
                    <span className="text-red-400 font-bold">LOCKED</span>
                  ) : (
                    <span className="text-emerald-400">OPEN</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: game.away_team, rec: game.away_record, score: game.away_score },
                    { name: game.home_team, rec: game.home_record, score: game.home_score },
                  ].map((teamObj) => {
                    const teamName = teamObj.name;
                    const isSelected = pick?.selected_team === teamName;
                    const isLock = isSelected && pick?.is_lock;
                    const uses = userPickCounts[teamName] || 0;

                    let btnStyle = 'bg-gray-800/80 border-gray-700/80 text-gray-200 hover:bg-gray-800';
                    if (isSelected) {
                      btnStyle = isLock
                        ? 'bg-amber-950/40 border-2 border-amber-400 text-amber-200 font-bold'
                        : 'bg-emerald-950/40 border-2 border-emerald-500 text-emerald-200 font-bold';
                    }

                    return (
                      <button
                        key={teamName}
                        disabled={isLocked}
                        onClick={() => handleSelectTeam(game, teamName)}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${btnStyle} ${
                          isLocked ? 'opacity-70 cursor-not-allowed' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <img
                            src={getTeamLogoUrl(teamName)}
                            alt=""
                            className="w-5 h-5 object-contain flex-shrink-0"
                          />
                          <div className="flex flex-col text-left min-w-0">
                            <span className="font-bold truncate text-white">
                              {getTeamNickname(teamName)}
                            </span>
                            <span className="text-[9px] text-gray-400 font-mono">
                              {teamObj.rec} • Used {uses}/6
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="text-xs flex-shrink-0 font-bold">
                            {isLock ? '🔒' : '✓'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky Bottom Selected Picks Bar */}
      <div className="fixed bottom-14 left-0 right-0 z-30 px-3 pointer-events-none">
        <div className="max-w-md mx-auto flex flex-col gap-1 pointer-events-auto">
          {/* Week 1 Lock Selection Helper Banner */}
          {selectedWeek === 1 && (
            <div className="bg-gray-900/95 backdrop-blur border border-amber-500/50 text-amber-300 text-[11px] font-medium px-3 py-1.5 rounded-xl shadow-lg flex items-center justify-center gap-1.5 text-center">
              <span>💡</span>
              <span>Tap a team below to move it into your Lock of the Week slot</span>
            </div>
          )}

          <div className="bg-gray-900/95 backdrop-blur-md border border-gray-800 p-2 rounded-2xl shadow-2xl flex items-center justify-between gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => {
              const pick = sortedPicksForBar[i];

              if (!pick) {
                const isSlot6 = i === 5;
                return (
                  <div
                    key={i}
                    className={`flex-1 h-12 rounded-xl border border-dashed flex flex-col items-center justify-center text-[10px] font-mono ${
                      isSlot6
                        ? 'border-amber-500/50 bg-amber-950/20 text-amber-400'
                        : 'border-gray-700 bg-gray-800/40 text-gray-500'
                    }`}
                  >
                    <span>{isSlot6 ? '🔒 LOCK' : `Pick ${i + 1}`}</span>
                  </div>
                );
              }

              return (
                <button
                  key={pick.id}
                  onClick={() => handleToggleLockSlot(pick.id, pick.is_lock)}
                  className={`flex-1 h-12 rounded-xl border p-1 flex flex-col items-center justify-center transition-all ${
                    pick.is_lock
                      ? 'bg-amber-950/40 border-2 border-amber-400 text-amber-200'
                      : 'bg-gray-800 border-gray-700 text-gray-200 hover:border-gray-600'
                  }`}
                >
                  <img
                    src={getTeamLogoUrl(pick.selected_team)}
                    alt=""
                    className="w-5 h-5 object-contain"
                  />
                  <span className="text-[9px] font-bold truncate max-w-full mt-0.5">
                    {pick.is_lock ? '🔒' : getTeamNickname(pick.selected_team)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
