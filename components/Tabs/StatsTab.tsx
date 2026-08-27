'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getTeamLogoUrl, getTeamNickname } from '@/lib/nflTeams';

const ALL_NFL_TEAMS = [
  'San Francisco 49ers', 'Chicago Bears', 'Cincinnati Bengals', 'Buffalo Bills',
  'Denver Broncos', 'Cleveland Browns', 'Tampa Bay Buccaneers', 'Arizona Cardinals',
  'Los Angeles Chargers', 'Kansas City Chiefs', 'Washington Commanders', 'Dallas Cowboys',
  'Miami Dolphins', 'Philadelphia Eagles', 'Atlanta Falcons', 'New York Giants',
  'Jacksonville Jaguars', 'New York Jets', 'Detroit Lions', 'Green Bay Packers',
  'Carolina Panthers', 'New England Patriots', 'Las Vegas Raiders', 'Los Angeles Rams',
  'Baltimore Ravens', 'New Orleans Saints', 'Seattle Seahawks', 'Pittsburgh Steelers',
  'Houston Texans', 'Tennessee Titans', 'Minnesota Vikings'
].sort((a, b) => getTeamNickname(a).localeCompare(getTeamNickname(b)));

interface TeamStat {
  team: string;
  nick: string;
  record: string;
  picked: number;
  lotw: number;
  maxed: number;
}

export default function StatsTab() {
  const [subTab, setSubTab] = useState<'perfection' | 'popular' | 'history'>('popular');
  const [teamStats, setTeamStats] = useState<TeamStat[]>([]);
  const [perfectionData, setPerfectionData] = useState<any[]>([]);
  const [shameData, setShameData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sorting state for Popular subtab
  const [popularSortKey, setPopularSortKey] = useState<keyof TeamStat>('picked');
  const [popularSortOrder, setPopularSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchStats();
  }, [subTab]);

  const fetchStats = async () => {
    setLoading(true);

    const { data: picks } = await supabase
      .from('picks')
      .select('*, games(*), profiles(*)');

    const { data: games } = await supabase
      .from('games')
      .select('*');

    // 1. Calculate stats for COMPLETED GAMES ONLY (status === 'post')
    const completedPicks = (picks || []).filter((p) => p.games && p.games.status === 'post');

    const teamCounts: Record<string, { picked: number; lotw: number; maxed: number }> = {};
    ALL_NFL_TEAMS.forEach((t) => {
      teamCounts[t] = { picked: 0, lotw: 0, maxed: 0 };
    });

    const userTeamUsage: Record<string, Record<string, number>> = {};

    completedPicks.forEach((p) => {
      const team = p.selected_team;
      if (teamCounts[team]) {
        teamCounts[team].picked += 1;
        if (p.is_lock) teamCounts[team].lotw += 1;
      }

      if (!userTeamUsage[p.user_id]) userTeamUsage[p.user_id] = {};
      userTeamUsage[p.user_id][team] = (userTeamUsage[p.user_id][team] || 0) + 1;
    });

    Object.values(userTeamUsage).forEach((userMap) => {
      Object.entries(userMap).forEach(([team, count]) => {
        if (count >= 6 && teamCounts[team]) {
          teamCounts[team].maxed += 1;
        }
      });
    });

    const teamRecordMap: Record<string, string> = {};
    (games || []).forEach((g) => {
      if (g.home_team && g.home_record) teamRecordMap[g.home_team] = g.home_record;
      if (g.away_team && g.away_record) teamRecordMap[g.away_team] = g.away_record;
    });

    const popularList: TeamStat[] = ALL_NFL_TEAMS.map((team) => ({
      team,
      nick: getTeamNickname(team),
      record: teamRecordMap[team] || '0-0',
      picked: teamCounts[team].picked,
      lotw: teamCounts[team].lotw,
      maxed: teamCounts[team].maxed,
    }));

    setTeamStats(popularList);

    // 2. Perfection & Zero Points (Shame) Calculations
    const userWeekStats: Record<string, Record<number, { wins: number; total: number; points: number; profile: any }>> = {};

    completedPicks.forEach((p) => {
      const uId = p.user_id;
      const wk = p.week;
      if (!userWeekStats[uId]) userWeekStats[uId] = {};
      if (!userWeekStats[uId][wk]) {
        userWeekStats[uId][wk] = { wins: 0, total: 0, points: 0, profile: p.profiles };
      }

      userWeekStats[uId][wk].total += 1;
      const isWin = p.games?.winner_team === p.selected_team;

      if (isWin) {
        userWeekStats[uId][wk].wins += 1;
        userWeekStats[uId][wk].points += p.is_lock && wk !== 18 ? 2 : 1;
      } else if (p.is_lock && wk !== 18) {
        userWeekStats[uId][wk].points -= 1;
      }
    });

    const perfList: any[] = [];
    const zeroList: any[] = [];

    Object.entries(userWeekStats).forEach(([uId, weekMap]) => {
      Object.entries(weekMap).forEach(([wkStr, stat]) => {
        const wkNum = Number(wkStr);
        const req = wkNum === 18 ? 16 : 6;

        if (stat.total === req) {
          if (stat.wins === req) {
            perfList.push({
              user_id: uId,
              profile: stat.profile,
              week: wkNum,
              points: stat.points,
            });
          }
          if (stat.points <= 0) {
            zeroList.push({
              user_id: uId,
              profile: stat.profile,
              week: wkNum,
              points: stat.points,
              wins: stat.wins,
            });
          }
        }
      });
    });

    setPerfectionData(perfList.sort((a, b) => a.week - b.week));
    setShameData(zeroList.sort((a, b) => a.week - b.week));

    setLoading(false);
  };

  // Re-sort Popular table dynamically
  const sortedTeamStats = useMemo(() => {
    return [...teamStats].sort((a, b) => {
      const aVal = a[popularSortKey];
      const bVal = b[popularSortKey];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comp = aVal.localeCompare(bVal);
        return popularSortOrder === 'asc' ? comp : -comp;
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        if (aVal !== bVal) {
          return popularSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return a.nick.localeCompare(b.nick);
      }
      return 0;
    });
  }, [teamStats, popularSortKey, popularSortOrder]);

  const handleSortPopular = (key: keyof TeamStat) => {
    if (key === popularSortKey) {
      setPopularSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setPopularSortKey(key);
      setPopularSortOrder(key === 'nick' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-28 max-w-2xl mx-auto px-4 pt-4 text-white">
      {/* Subtab Navigator */}
      <div className="flex justify-center gap-2 bg-gray-900 p-1.5 rounded-xl border border-gray-800">
        <button
          onClick={() => setSubTab('perfection')}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            subTab === 'perfection' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Perfection
        </button>
        <button
          onClick={() => setSubTab('popular')}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            subTab === 'popular' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Popular
        </button>
        <button
          onClick={() => setSubTab('history')}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            subTab === 'history' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          History
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-gray-500 font-mono animate-pulse">
          Loading league statistics...
        </div>
      ) : subTab === 'popular' ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="border-b border-gray-800 text-[11px] font-bold text-gray-400 bg-gray-900/50">
                <th
                  className="py-3 px-4 w-[38%] cursor-pointer whitespace-nowrap select-none"
                  onClick={() => handleSortPopular('nick')}
                >
                  <div className="flex items-center gap-1">
                    <span>Team</span>
                    {popularSortKey === 'nick' && (
                      <span className="text-emerald-400 font-bold">{popularSortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="py-3 px-2 text-center w-[20%] cursor-pointer whitespace-nowrap select-none"
                  onClick={() => handleSortPopular('picked')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Picked</span>
                    {popularSortKey === 'picked' && (
                      <span className="text-emerald-400 font-bold">{popularSortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="py-3 px-2 text-center w-[21%] cursor-pointer whitespace-nowrap select-none"
                  onClick={() => handleSortPopular('lotw')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>LOTW</span>
                    {popularSortKey === 'lotw' && (
                      <span className="text-emerald-400 font-bold">{popularSortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="py-3 px-2 text-center w-[21%] cursor-pointer whitespace-nowrap select-none"
                  onClick={() => handleSortPopular('maxed')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Maxed</span>
                    {popularSortKey === 'maxed' && (
                      <span className="text-emerald-400 font-bold">{popularSortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 text-xs">
              {sortedTeamStats.map((item) => (
                <tr key={item.team} className="hover:bg-gray-800/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-white flex items-center gap-2 min-w-0">
                    <img src={getTeamLogoUrl(item.team)} alt="" className="w-6 h-6 object-contain flex-shrink-0" />
                    <div className="flex flex-col truncate min-w-0">
                      <span className="truncate">{item.nick}</span>
                      <span className="text-[10px] font-mono text-gray-400 font-normal">({item.record})</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center font-mono font-bold text-emerald-400">
                    {item.picked}
                  </td>
                  <td className="py-3 px-2 text-center font-mono font-bold text-amber-400">
                    {item.lotw}
                  </td>
                  <td className="py-3 px-2 text-center font-mono font-bold text-indigo-400">
                    {item.maxed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : subTab === 'perfection' ? (
        <div className="flex flex-col gap-4">
          {/* Hall of Perfection */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xl">
            <h3 className="font-extrabold text-sm text-amber-400 flex items-center gap-2">
              <span>🏆</span> Hall of Perfection
            </h3>
            <p className="text-xs text-gray-400">
              Members who achieved an unblemished 6-0 (or 16-0) record in a week.
            </p>

            {perfectionData.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-500 font-mono">
                No perfect weeks recorded yet.
              </div>
            ) : (
              <div className="flex flex-col gap-2 mt-1">
                {perfectionData.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-amber-950/20 border border-amber-500/40 p-3 rounded-xl flex justify-between items-center"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center justify-center font-bold text-xs text-amber-300">
                        {item.profile?.avatar_url ? (
                          <img src={item.profile.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          `${item.profile?.first_name?.slice(0, 1) || ''}${item.profile?.last_name?.slice(0, 1) || ''}`
                        )}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-white block">{item.profile?.team_name}</span>
                        <span className="text-[10px] text-gray-400">
                          {item.profile?.first_name} {item.profile?.last_name}
                        </span>
                      </div>
                    </div>

                    <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
                      Week {item.week} Perfect
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Hall of Shame / Goose Egg (0 Point Weeks) */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xl">
            <h3 className="font-extrabold text-sm text-red-400 flex items-center gap-2">
              <span>🦆</span> Zero Point Weeks (Goose Egg)
            </h3>
            <p className="text-xs text-gray-400">
              Members who scored 0 or fewer points in a completed week.
            </p>

            {shameData.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-500 font-mono">
                No zero-point weeks recorded yet!
              </div>
            ) : (
              <div className="flex flex-col gap-2 mt-1">
                {shameData.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-red-950/20 border border-red-500/40 p-3 rounded-xl flex justify-between items-center"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-400/50 flex items-center justify-center font-bold text-xs text-red-300">
                        {item.profile?.avatar_url ? (
                          <img src={item.profile.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          `${item.profile?.first_name?.slice(0, 1) || ''}${item.profile?.last_name?.slice(0, 1) || ''}`
                        )}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-white block">{item.profile?.team_name}</span>
                        <span className="text-[10px] text-gray-400">
                          {item.profile?.first_name} {item.profile?.last_name}
                        </span>
                      </div>
                    </div>

                    <span className="text-xs font-mono font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/30">
                      Week {item.week} • {item.points} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* History Subtab: Restored Past Champions Showcase */
        <div className="flex flex-col gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="font-extrabold text-base text-amber-400 flex items-center gap-2">
                <span>🏆</span> League History & Champions
              </h3>
              <span className="text-[10px] font-mono text-gray-400">Roll of Honor</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 2025 Champion Card */}
              <div className="bg-gradient-to-br from-amber-950/40 to-gray-900 border-2 border-amber-400/60 p-4 rounded-xl flex flex-col gap-2 relative shadow-lg">
                <span className="text-[10px] font-mono font-extrabold text-amber-400 uppercase tracking-widest">
                  2025 Champion
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center font-black text-amber-300 text-sm">
                    🏆
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white">To Be Crowned</h4>
                    <p className="text-xs text-gray-400">2025 Season</p>
                  </div>
                </div>
              </div>

              {/* 2024 Champion Card */}
              <div className="bg-gradient-to-br from-indigo-950/40 to-gray-900 border-2 border-indigo-400/60 p-4 rounded-xl flex flex-col gap-2 relative shadow-lg">
                <span className="text-[10px] font-mono font-extrabold text-indigo-400 uppercase tracking-widest">
                  2024 Champion
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/20 border-2 border-indigo-400 flex items-center justify-center font-black text-indigo-300 text-sm">
                    👑
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white">Inaugural Season</h4>
                    <p className="text-xs text-gray-400">2024 Season</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
