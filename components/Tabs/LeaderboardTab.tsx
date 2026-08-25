'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getTeamLogoUrl } from '@/lib/nflTeams';

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
    const { data: picks } = await supabase.from('picks').select('*');

    if (!profiles) return;

    const computed = profiles.map((p) => {
      const userPicks = (picks || []).filter((pick) => pick.user_id === p.id);
      const totalPoints = userPicks.reduce((acc, curr) => acc + (curr.points_awarded || 0), 0);
      const wins = userPicks.filter((pick) => (pick.points_awarded || 0) > 0).length;
      const losses = userPicks.filter((pick) => (pick.points_awarded || 0) < 0 || (pick.points_awarded === 0 && pick.game_id)).length;

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

    setMemberPicks(data || []);
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

      {/* Member Pick Breakdown Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-5 shadow-2xl relative">
            <button
              onClick={() => setSelectedMember(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white font-bold text-sm"
            >
              ✕
            </button>

            <h3 className="font-bold text-base text-white mb-1">
              {selectedMember.team_name}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              {selectedMember.first_name} {selectedMember.last_name} • {selectedMember.totalPoints} pts
            </p>

            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-gray-300">Select Week</span>
              <select
                value={viewWeek}
                onChange={(e) => setViewWeek(Number(e.target.value))}
                className="bg-gray-800 text-xs text-white px-2 py-1 rounded border border-gray-700"
              >
                {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>
                    Week {w}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
              {memberPicks.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">No picks for Week {viewWeek}</p>
              ) : (
                memberPicks.map((pick) => {
                  const game = pick.games;
                  const isLocked = new Date() >= new Date(game?.kickoff_time);
                  const isSelf = selectedMember.id === currentUserId;

                  // Privacy check: Hide unkickoffed picks for other members
                  if (!isLocked && !isSelf) {
                    return (
                      <div key={pick.id} className="bg-gray-800/50 p-2.5 rounded-lg flex justify-between items-center text-xs">
                        <span className="text-gray-400 font-bold">🔒 Hidden Pick (Kickoff Pending)</span>
                      </div>
                    );
                  }

                  return (
                    <div key={pick.id} className="bg-gray-800 p-2.5 rounded-lg flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <img src={getTeamLogoUrl(pick.selected_team)} alt="" className="w-5 h-5 object-contain" />
                        <span className="font-bold text-white">{pick.selected_team}</span>
                        {pick.is_lock && <span className="text-[10px] text-amber-400 font-bold">🔒 LOCK</span>}
                      </div>
                      <span className="font-mono font-bold text-emerald-400">+{pick.points_awarded || 0} pts</span>
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
