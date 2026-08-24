'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface LeaderboardUser {
  id: string;
  first_name: string;
  last_name: string;
  team_name: string;
  avatar_url: string | null;
  totalPoints: number;
  totalPicks: number;
  correctPicks: number;
  accuracy: number;
  lockWins: number;
  lockLosses: number;
  weeklyPoints: Record<number, number>; // map week -> points scored
}

export default function LeaderboardTab() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [completedWeeks, setCompletedWeeks] = useState<number[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboardData();
  }, []);

  const fetchLeaderboardData = async () => {
    setLoading(true);

    // 1. Fetch all user profiles
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, team_name, avatar_url');

    if (profileError) {
      console.error(profileError);
      setLoading(false);
      return;
    }

    // 2. Fetch all completed/locked picks joined with game info
    const { data: picks, error: picksError } = await supabase
      .from('picks')
      .select('user_id, week, selected_team, is_lock, points_awarded, games!inner(status, winner_team)');

    if (picksError) {
      console.error(picksError);
      setLoading(false);
      return;
    }

    // 3. Aggregate metrics per user
    const weeksSet = new Set<number>();
    const userMap: Record<string, LeaderboardUser> = {};

    profiles.forEach((p) => {
      userMap[p.id] = {
        id: p.id,
        first_name: p.first_name || '',
        last_name: p.last_name || '',
        team_name: p.team_name || 'Unnamed Team',
        avatar_url: p.avatar_url,
        totalPoints: 0,
        totalPicks: 0,
        correctPicks: 0,
        accuracy: 0,
        lockWins: 0,
        lockLosses: 0,
        weeklyPoints: {},
      };
    });

    (picks || []).forEach((pick: any) => {
      const game = pick.games;
      const user = userMap[pick.user_id];
      if (!user) return;

      // Only evaluate games that are FINAL or CANCELED
      if (game.status === 'post' || game.status === 'canceled') {
        weeksSet.add(pick.week);
        const pts = Number(pick.points_awarded || 0);

        // Track overall points
        user.totalPoints += pts;
        user.weeklyPoints[pick.week] = (user.weeklyPoints[pick.week] || 0) + pts;

        // Accuracy tracking (Straight-up winner check)
        user.totalPicks += 1;
        if (pick.selected_team === game.winner_team) {
          user.correctPicks += 1;
        }

        // Lock of the Week breakdown
        if (pick.is_lock) {
          if (pts > 0) user.lockWins += 1;
          else if (pts < 0) user.lockLosses += 1;
        }
      }
    });

    // Compute accuracy percentages & convert map to sorted array
    const sortedLeaderboard = Object.values(userMap).map((u) => ({
      ...u,
      accuracy: u.totalPicks > 0 ? Math.round((u.correctPicks / u.totalPicks) * 100) : 0,
    }));

    // Sort by Total Points (descending), then Accuracy (descending)
    sortedLeaderboard.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return b.accuracy - a.accuracy;
    });

    const weeksArray = Array.from(weeksSet).sort((a, b) => a - b);
    setCompletedWeeks(weeksArray);
    setLeaderboard(sortedLeaderboard);
    setLoading(false);
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-400">Loading standings...</div>;
  }

  return (
    <div className="flex flex-col gap-4 pb-24 max-w-3xl mx-auto px-4">
      {/* Header & Week Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4">
        <div>
          <h2 className="text-xl font-bold text-white">League Standings</h2>
          <p className="text-xs text-gray-400">Pick Six Leaderboard & Stats</p>
        </div>

        {/* Filter View */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedWeek('ALL')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              selectedWeek === 'ALL'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Season Total
          </button>
          {completedWeeks.map((wk) => (
            <button
              key={wk}
              onClick={() => setSelectedWeek(wk)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedWeek === wk
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              Wk {wk}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Table / Cards */}
      <div className="flex flex-col gap-2.5">
        {leaderboard.map((user, index) => {
          const rank = index + 1;
          const displayPoints =
            selectedWeek === 'ALL'
              ? user.totalPoints
              : user.weeklyPoints[selectedWeek] ?? 0;

          return (
            <div
              key={user.id}
              className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                rank === 1
                  ? 'bg-gradient-to-r from-amber-950/40 via-gray-800 to-gray-800 border-amber-500/60'
                  : rank === 2
                  ? 'bg-gray-800/90 border-gray-400/40'
                  : rank === 3
                  ? 'bg-gray-800/90 border-amber-800/40'
                  : 'bg-gray-800/60 border-gray-700/50'
              }`}
            >
              {/* Left: Rank & Profile Info */}
              <div className="flex items-center gap-3">
                {/* Rank Badge */}
                <span
                  className={`w-6 text-center font-mono font-bold text-sm ${
                    rank === 1
                      ? 'text-amber-400 text-base'
                      : rank === 2
                      ? 'text-gray-300'
                      : rank === 3
                      ? 'text-amber-600'
                      : 'text-gray-500'
                  }`}
                >
                  {rank === 1 ? '👑' : `#${rank}`}
                </span>

                {/* Team Avatar */}
                <div className="relative w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center border border-gray-600 shrink-0">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.team_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold text-gray-300">
                      {user.team_name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Team Name & Owner */}
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-sm text-white truncate">
                    {user.team_name}
                  </span>
                  <span className="text-[11px] text-gray-400 truncate">
                    {user.first_name} {user.last_name}
                  </span>
                </div>
              </div>

              {/* Right: Points & Quick Stats */}
              <div className="flex items-center gap-4 text-right">
                {/* Accuracy & Lock Stats (Shown on ALL view) */}
                {selectedWeek === 'ALL' && (
                  <div className="hidden sm:flex flex-col text-right text-[11px] text-gray-400">
                    <span>{user.accuracy}% Pick Acc</span>
                    <span className="text-amber-400/90">
                      🔒 {user.lockWins}W - {user.lockLosses}L
                    </span>
                  </div>
                )}

                {/* Main Points Pill */}
                <div className="flex flex-col items-end">
                  <span className="font-mono font-extrabold text-lg text-emerald-400">
                    {displayPoints > 0 ? `+${displayPoints}` : displayPoints}
                  </span>
                  <span className="text-[10px] text-gray-400 uppercase font-medium">
                    {selectedWeek === 'ALL' ? 'Total Pts' : `Wk ${selectedWeek} Pts`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
