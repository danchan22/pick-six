'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function LeaderboardTab() {
  const [standings, setStandings] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
    fetchLeaderboard();
  }, []);

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
              className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
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
    </div>
  );
}
