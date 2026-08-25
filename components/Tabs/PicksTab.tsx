'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getTeamNickname, getTeamLogoUrl, getTeamAbbr } from '@/lib/nflTeams';

interface Game {
  id: string;
  week: number;
  home_team: string;
  away_team: string;
  home_record?: string;
  away_record?: string;
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

interface PicksTabProps {
  userId: string;
  currentWeek: number;
  onPicksChanged?: (count: number, hasLock: boolean) => void;
}

export default function PicksTab({ userId, currentWeek, onPicksChanged }: PicksTabProps) {
  const [selectedWeek, setSelectedWeek] = useState(currentWeek || 1);
  const [games, setGames] = useState<Game[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [teamPickCounts, setTeamPickCounts] = useState<Record<string, number>>({});
  const [forceUnlockForTesting, setForceUnlockForTesting] = useState(false);
  const [selectedSlotForSwap, setSelectedSlotForSwap] = useState<number | null>(null);

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
    const { data, error } = await supabase
      .from('picks')
      .select('*, games(*)')
      .eq('user_id', userId)
      .eq('week', selectedWeek);

    if (error) return;

    const currentPicks = data || [];
    setPicks(currentPicks);

    if (selectedWeek === currentWeek && onPicksChanged) {
      onPicksChanged(currentPicks.length, currentPicks.some((p) => p.is_lock));
    }
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
    if (error) return;
    await fetchUserPicks();
    await fetchSeasonTeamCounts();
  };

  const handleSelectTeam = async (gameId: string, team: string) => {
    const existingPick = picks.find((p) => p.game_id === gameId);

    if (existingPick?.selected_team === team) {
      await deletePick(existingPick.id);
    } else if (existingPick) {
      await supabase
        .from('picks')
        .update({ selected_team: team })
        .eq('id', existingPick.id);
      fetchUserPicks();
    } else {
      if (picks.length >= 6) return;
      const isSixthPick = picks.length === 5;
      await supabase.from('picks').insert({
        user_id: userId,
        game_id: gameId,
        week: selectedWeek,
        selected_team: team,
        is_lock: isSixthPick,
      });
      fetchUserPicks();
    }
    fetchSeasonTeamCounts();
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

  const pickSlots = Array.from({ length: 6 }, (_, index) => orderedPicks[index] || null);

  const handleSlotClick = async (index: number) => {
    const currentSlotPick = pickSlots[index];

    if (selectedSlotForSwap === null) {
      if (currentSlotPick) {
        setSelectedSlotForSwap(index);
      }
    } else {
      if (selectedSlotForSwap === index) {
        if (currentSlotPick) {
          await deletePick(currentSlotPick.id);
        }
        setSelectedSlotForSwap(null);
      } else {
        const firstPick = pickSlots[selectedSlotForSwap];
        const secondPick = pickSlots[index];

        if (firstPick) {
          await supabase
            .from('picks')
            .update({ is_lock: index === 5 })
            .eq('id', firstPick.id);
        }
        if (secondPick) {
          await supabase
            .from('picks')
            .update({ is_lock: selectedSlotForSwap === 5 })
            .eq('id', secondPick.id);
        }

        setSelectedSlotForSwap(null);
        fetchUserPicks();
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-40 max-w-2xl mx-auto px-4 pt-4 text-white">
      <div className="flex justify-between items-center bg-gray-900 p-2.5 rounded-xl border border-gray-800">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setSelectedWeek((prev) => Math.max(1, prev - 1));
              setSelectedSlotForSwap(null);
            }}
            disabled={selectedWeek <= 1}
            className="w-7 h-7 flex items-center justify-center bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-lg text-xs font-bold transition-colors"
          >
            ◀
          </button>

          <select
            value={selectedWeek}
            onChange={(e) => {
              setSelectedWeek(Number(e.target.value));
              setSelectedSlotForSwap(null);
            }}
            className="bg-gray-800 text-xs font-bold text-white px-3 py-1.5 rounded-lg border border-gray-700 focus:outline-none"
          >
            {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setSelectedWeek((prev) => Math.min(18, prev + 1));
              setSelectedSlotForSwap(null);
            }}
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

      <div className="text-[11px] font-semibold text-gray-400 text-right px-1">
        All Times Eastern
      </div>

      <div className="flex flex-col gap-3">
        {games.map((game) => {
          const locked = isGameLocked(game.kickoff_time);
          const currentPick = picks.find((p) => p.game_id === game.id);
          const homeNickname = getTeamNickname(game.home_team);
          const awayNickname = getTeamNickname(game.away_team);

          return (
            <div
              key={game.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col gap-2.5"
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
                  { full: game.away_team, nick: awayNickname, record: game.away_record },
                  { full: game.home_team, nick: homeNickname, record: game.home_record },
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
                        <div className="flex flex-col items-start">
                          <span className="text-xs font-semibold">{team.nick}</span>
                          <span className="text-[9px] text-gray-400">Picked {count}/6</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono font-medium">
                        {team.record || '0-0'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-[57px] left-0 right-0 z-30 bg-gray-950/95 backdrop-blur-lg border-t border-gray-800 px-4 py-2.5 shadow-2xl">
        <div className="max-w-md mx-auto flex flex-col gap-1.5">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-[11px] font-extrabold text-emerald-400 tracking-wider uppercase">
              MY WEEK {selectedWeek} PICKS
            </h3>
            <span className="text-[9px] text-gray-400">
              {selectedSlotForSwap !== null ? 'Tap target slot to swap/clear' : 'Tap slot to swap/clear'}
            </span>
          </div>

          <div className="flex justify-between items-start gap-1.5">
            {pickSlots.map((pick, i) => {
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

              const isSlotLock = i === 5;
              const isSelectedForSwap = selectedSlotForSwap === i;

              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                  <span className={`text-[10px] font-black ${outcomeColor}`}>
                    {outcomeLabel}
                  </span>

                  <button
                    onClick={() => handleSlotClick(i)}
                    className={`w-full aspect-square max-w-[50px] rounded-xl border flex items-center justify-center p-0.5 relative shadow-md transition-transform active:scale-95 ${slotBg} ${
                      isSelectedForSwap
                        ? 'border-2 border-emerald-400 ring-4 ring-emerald-500/50 scale-105'
                        : isSlotLock
                        ? 'border-2 border-amber-400 ring-2 ring-amber-400/50'
                        : 'border-gray-300'
                    }`}
                  >
                    {pick ? (
                      <img
                        src={getTeamLogoUrl(pick.selected_team)}
                        alt={pick.selected_team}
                        className="w-9 h-9 object-contain"
                      />
                    ) : (
                      <span className="text-gray-400 font-bold text-sm">?</span>
                    )}

                    {isSlotLock && (
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gray-900 border-2 border-amber-400 rounded-full w-4 h-4 flex items-center justify-center shadow-md">
                        <span className="text-[8px]">🔒</span>
                      </div>
                    )}
                  </button>

                  <span className="text-[8px] font-bold text-gray-400 truncate w-full text-center mt-1">
                    {pick ? `${oppPrefix} ${oppAbbr}` : '-'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
