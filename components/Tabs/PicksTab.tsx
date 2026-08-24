'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; // Ensure your public supabase client is configured here

interface Game {
  id: string;
  season_year: number;
  week: number;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  kickoff_time: string;
  status: 'pre' | 'in' | 'post' | 'postponed' | 'canceled';
  winner_team: string | null;
}

interface Pick {
  id?: string;
  game_id: string;
  selected_team: string;
  is_lock: boolean;
  points_awarded?: number;
}

interface UserPickUsage {
  [teamName: string]: number; // Tracks season usage for each team
}

interface PicksTabProps {
  userId: string;
  currentWeek: number;
}

export default function PicksTab({ userId, currentWeek }: PicksTabProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [userPicks, setUserPicks] = useState<Record<string, Pick>>({}); // map game_id -> Pick
  const [seasonUsage, setSeasonUsage] = useState<UserPickUsage>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [currentWeek, userId]);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);

    // 1. Fetch games for current week
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('week', currentWeek)
      .order('kickoff_time', { ascending: true });

    if (gamesError) console.error(gamesError);
    else setGames(gamesData || []);

    // 2. Fetch user picks for current week
    const { data: currentPicksData, error: picksError } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', userId)
      .eq('week', currentWeek);

    if (picksError) console.error(picksError);

    const picksMap: Record<string, Pick> = {};
    (currentPicksData || []).forEach((p) => {
      picksMap[p.game_id] = p;
    });
    setUserPicks(picksMap);

    // 3. Fetch user picks across whole season to compute team usage limits (Max 6 per team)
    const { data: seasonPicksData } = await supabase
      .from('picks')
      .select('selected_team, games!inner(kickoff_time)')
      .eq('user_id', userId);

    const usage: UserPickUsage = {};
    (seasonPicksData || []).forEach((p: any) => {
      const team = p.selected_team;
      // Count picks where game has kicked off or is in current selection
      usage[team] = (usage[team] || 0) + 1;
    });
    setSeasonUsage(usage);

    setLoading(false);
  };

  const selectedPicksCount = Object.keys(userPicks).length;
  const currentLockGameId = Object.keys(userPicks).find(
    (gId) => userPicks[gId]?.is_lock
  );

  // Helper: check if a game is locked due to kickoff time or game status
  const isGameLocked = (game: Game) => {
    const now = new Date();
    const kickoff = new Date(game.kickoff_time);
    return now >= kickoff || game.status !== 'pre';
  };

  // Handle selecting a team
  const handleSelectTeam = (game: Game, team: string) => {
    if (isGameLocked(game)) return;
    setErrorMsg(null);

    const existingPick = userPicks[game.id];

    // Deselect if already picked
    if (existingPick && existingPick.selected_team === team) {
      const nextPicks = { ...userPicks };
      delete nextPicks[game.id];
      setUserPicks(nextPicks);
      return;
    }

    // Check 6 total weekly picks rule
    if (!existingPick && selectedPicksCount >= 6) {
      setErrorMsg('You can only pick 6 games per week.');
      return;
    }

    // Check 6 max season usage per team rule
    const currentTeamUses = seasonUsage[team] || 0;
    // If user is swapping from team A to team B, check team B's limit
    if (currentTeamUses >= 6 && (!existingPick || existingPick.selected_team !== team)) {
      setErrorMsg(`You have already picked ${team} 6 times this season.`);
      return;
    }

    // Assign pick (inherit LOTW status if previously locked in this slot)
    const isLock = existingPick ? existingPick.is_lock : false;

    setUserPicks({
      ...userPicks,
      [game.id]: {
        game_id: game.id,
        selected_team: team,
        is_lock: isLock,
      },
    });
  };

  // Handle setting Lock of the Week
  const handleToggleLock = (gameId: string) => {
    const pick = userPicks[gameId];
    if (!pick) return;

    const game = games.find((g) => g.id === gameId);
    if (game && isGameLocked(game)) return;

    const nextPicks = { ...userPicks };

    if (pick.is_lock) {
      // Remove lock
      nextPicks[gameId] = { ...pick, is_lock: false };
    } else {
      // Remove lock from any other game first (only 1 LOTW per week)
      Object.keys(nextPicks).forEach((gId) => {
        nextPicks[gId] = { ...nextPicks[gId], is_lock: false };
      });
      // Set lock on target game
      nextPicks[gameId] = { ...pick, is_lock: true };
    }

    setUserPicks(nextPicks);
  };

  // Save picks to Supabase
  const handleSavePicks = async () => {
    if (selectedPicksCount !== 6) {
      setErrorMsg(`You must select exactly 6 games. (Currently selected: ${selectedPicksCount})`);
      return;
    }

    if (!currentLockGameId) {
      setErrorMsg('You must designate one of your 6 picks as your Lock of the Week.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      // Format payload
      const rowsToUpsert = Object.values(userPicks).map((p) => ({
        user_id: userId,
        game_id: p.game_id,
        week: currentWeek,
        selected_team: p.selected_team,
        is_lock: p.is_lock,
      }));

      // Delete picks no longer in current selection (if any were removed)
      const selectedGameIds = Object.keys(userPicks);
      await supabase
        .from('picks')
        .delete()
        .eq('user_id', userId)
        .eq('week', currentWeek)
        .not('game_id', 'in', `(${selectedGameIds.join(',')})`);

      // Upsert picks
      const { error } = await supabase.from('picks').upsert(rowsToUpsert, {
        onConflict: 'user_id,game_id',
      });

      if (error) throw error;
      alert('Picks saved successfully!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save picks.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-400">Loading week {currentWeek} games...</div>;
  }

  return (
    <div className="flex flex-col gap-4 pb-24 max-w-2xl mx-auto px-4">
      {/* Week Header & Counter */}
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 p-4 rounded-b-xl shadow-lg flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Week {currentWeek} Picks</h2>
          <p className="text-xs text-gray-400">
            {selectedPicksCount}/6 Selected • {currentLockGameId ? '🔒 Lock Set' : '⚠️ No Lock Selected'}
          </p>
        </div>

        <button
          onClick={handleSavePicks}
          disabled={saving || selectedPicksCount !== 6 || !currentLockGameId}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
            selectedPicksCount === 6 && currentLockGameId
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40 shadow-lg'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          {saving ? 'Saving...' : 'Save Picks'}
        </button>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="bg-red-950/80 border border-red-500/50 text-red-200 text-sm p-3 rounded-xl">
          {errorMsg}
        </div>
      )}

      {/* Game Cards List */}
      <div className="flex flex-col gap-3">
        {games.map((game) => {
          const locked = isGameLocked(game);
          const currentPick = userPicks[game.id];
          const awaySelected = currentPick?.selected_team === game.away_team;
          const homeSelected = currentPick?.selected_team === game.home_team;
          const isLock = currentPick?.is_lock || false;

          const awayUses = seasonUsage[game.away_team] || 0;
          const homeUses = seasonUsage[game.home_team] || 0;

          return (
            <div
              key={game.id}
              className={`relative bg-gray-800/80 border rounded-xl p-4 transition-all ${
                isLock
                  ? 'border-amber-500/80 bg-gradient-to-r from-amber-950/20 via-gray-800 to-gray-800'
                  : currentPick
                  ? 'border-emerald-500/50'
                  : 'border-gray-700/60'
              }`}
            >
              {/* Card Top Meta */}
              <div className="flex justify-between items-center text-xs text-gray-400 mb-3">
                <span>
                  {new Date(game.kickoff_time).toLocaleDateString([], {
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span
                  className={`font-mono font-semibold px-2 py-0.5 rounded text-[10px] ${
                    game.status === 'in'
                      ? 'bg-red-900/60 text-red-300 animate-pulse'
                      : game.status === 'post'
                      ? 'bg-gray-700 text-gray-300'
                      : 'bg-gray-900 text-gray-400'
                  }`}
                >
                  {game.status === 'in' ? 'LIVE' : game.status === 'post' ? 'FINAL' : 'UPCOMING'}
                </span>
              </div>

              {/* Teams Matchup Selection */}
              <div className="grid grid-cols-2 gap-3">
                {/* Away Team */}
                <button
                  disabled={locked || (awayUses >= 6 && !awaySelected)}
                  onClick={() => handleSelectTeam(game, game.away_team)}
                  className={`flex flex-col p-3 rounded-lg border text-left transition-all ${
                    awaySelected
                      ? 'bg-emerald-600/20 border-emerald-500 text-white'
                      : 'bg-gray-900/50 border-gray-700 text-gray-300 hover:border-gray-500'
                  } ${locked || (awayUses >= 6 && !awaySelected) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-bold text-sm">{game.away_team}</span>
                    {game.status !== 'pre' && (
                      <span className="font-mono text-lg font-bold">{game.away_score}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1">Used: {awayUses}/6</span>
                </button>

                {/* Home Team */}
                <button
                  disabled={locked || (homeUses >= 6 && !homeSelected)}
                  onClick={() => handleSelectTeam(game, game.home_team)}
                  className={`flex flex-col p-3 rounded-lg border text-left transition-all ${
                    homeSelected
                      ? 'bg-emerald-600/20 border-emerald-500 text-white'
                      : 'bg-gray-900/50 border-gray-700 text-gray-300 hover:border-gray-500'
                  } ${locked || (homeUses >= 6 && !homeSelected) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-bold text-sm">{game.home_team}</span>
                    {game.status !== 'pre' && (
                      <span className="font-mono text-lg font-bold">{game.home_score}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1">Used: {homeUses}/6</span>
                </button>
              </div>

              {/* Lock of the Week Button (Only if game is selected) */}
              {currentPick && (
                <div className="mt-3 pt-2 border-t border-gray-700/50 flex items-center justify-between">
                  <button
                    disabled={locked}
                    onClick={() => handleToggleLock(game.id)}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
                      isLock
                        ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-950'
                        : 'bg-gray-900 text-gray-400 hover:text-amber-400'
                    }`}
                  >
                    <span>{isLock ? '🔒 LOCK OF THE WEEK' : '🔓 Set as Lock'}</span>
                  </button>

                  {/* Points display after game finishes */}
                  {currentPick.points_awarded !== undefined && game.status === 'post' && (
                    <span
                      className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                        currentPick.points_awarded > 0
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                          : currentPick.points_awarded < 0
                          ? 'bg-red-950 text-red-400 border border-red-700'
                          : 'bg-gray-900 text-gray-400'
                      }`}
                    >
                      {currentPick.points_awarded > 0 ? `+${currentPick.points_awarded}` : currentPick.points_awarded} pts
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
