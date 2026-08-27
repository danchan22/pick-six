'use client';

import { useEffect, useState } from 'react';
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
  const [historyData, setHistoryData] = useState<any[]>([]);
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

    // Client-side sort applying current key and order
    popularList.sort((a, b) => {
      const aVal = a[popularSortKey];
      const bVal = b[popularSortKey];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return popularSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        return popularSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

    setTeamStats(popularList);

    // 2. Perfection Stats (Users with 6-0 completed weeks)
    const userWeekStats: Record<string, Record<number, { wins: number; total: number; profile: any }>> = {};

    completedPicks.forEach((p) => {
      const uId = p.user_id;
      const wk = p.week;
      if (!userWeekStats[uId]) userWeekStats[uId] = {};
      if (!userWeekStats[uId][wk]) {
        userWeekStats[uId][wk] = { wins: 0, total: 0, profile: p.profiles };
      }

      userWeekStats[uId][wk].total += 1;
      if (p.games?.winner_team === p.selected_team) {
        userWeekStats[uId][wk].wins += 1;
      }
    });

    const perfectionList: any[] = [];
    Object.entries(userWeekStats).forEach(([uId, weekMap]) => {
      Object.entries(weekMap).forEach(([wkStr, stat]) => {
        const wkNum = Number(wkStr);
        const req = wkNum === 18 ? 16 : 6;
        if (stat.total === req && stat.wins === req) {
          perfectionList.push({
            user_id: uId,
            profile: stat.profile,
            week: wkNum,
          });
        }
      });
    });

    setPerfectionData(perfectionList.sort((a, b) => a.week - b.week));

    // 3. History Stats (completed weeks only)
    const weekSummaries: Record<number, { completedGames: number; totalPicks: number }> = {};
    (games || []).forEach((g) => {
      if (g.status === 'post') {
        if (!weekSummaries[g.week]) weekSummaries[g.week] = { completedGames: 0, totalPicks: 0 };
        weekSummaries[g.week].completedGames += 1;
      }
    });

    completedPicks.forEach((p) => {
      if (weekSummaries[p.week]) {
        weekSummaries[p.week].totalPicks += 1;
      }
    });

    const histList = Object.entries(weekSummaries).map(([wk, data]) => ({
      week: Number(wk),
      completedGames: data.completedGames,
      totalPicks: data.totalPicks,
    })).sort((a, b) => b.week - a.week);

    setHistoryData(histList);
    setLoading(false);
  };

  const handleSortPopular = (key: keyof TeamStat) => {
    if (key === popularSortKey) {
      setPopularSortOrder(popularSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setPopularSortKey(key);
      setPopularSortOrder('desc');
    }
  };

  const getSortIcon = (key: keyof TeamStat) => {
    if (popularSortKey === key) {
      return popularSortOrder === 'asc' ? '↑' : '↓';
    }
    return '';
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
          {/* Fix: Table Layout Prevent Overrun */}
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              {/* Fix: Column Header Layout and Sorting */}
              <tr className="border-b border-gray-800 text-[11px] font-bold text-gray-400 bg-gray-900/50">
                <th className="py-3 px-4 w-[40%] cursor-pointer" onClick={() => handleSortPopular('nick')}>
                  Team {getSortIcon('nick')}
                </th>
                <th className="py-3 px-3 text-center w-[20%] cursor-pointer" onClick={() => handleSortPopular('picked')}>
                  Picked {getSortIcon('picked')}
                </th>
                <th className="py-3 px-3 text-center w-[20%] cursor-pointer" onClick={() => handleSortPopular('lotw')}>
                  LOTW {getSortIcon('lotw')}
                </th>
                <th className="py-3 px-4 text-center w-[20%] cursor-pointer" onClick={() => handleSortPopular('maxed')}>
                  Maxed {getSortIcon('maxed')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 text-xs">
              {teamStats.map((item) => (
                <tr key={item.team} className="hover:bg-gray-800/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-white flex items-center gap-2 min-w-0">
                    <img src={getTeamLogoUrl(item.team)} alt="" className="w-6 h-6 object-contain flex-shrink-0" />
                    {/* Fix: Buccaneers Overrun Text with Truncate */}
                    <div className="flex flex-col truncate">
                      <span className="truncate">{item.nick}</span>
                      <span className="text-[10px] font-mono text-gray-400 font-normal">({item.record})</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-emerald-400">
                    {item.picked}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-amber-400">
                    {item.lotw}
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-indigo-400">
                    {item.maxed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : subTab === 'perfection' ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xl">
          <h3 className="font-extrabold text-sm text-amber-400 flex items-center gap-2">
            <span>🏆</span> Hall of Perfection
          </h3>
          <p className="text-xs text-gray-400">
            Members who achieved an unblemished 6-0 (or 16-0) record this season.
          </p>

          {perfectionData.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500 font-mono">
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
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xl">
          <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
            <span>📜</span> Completed Weeks Overview
          </h3>

          {historyData.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500 font-mono">
              No completed weeks available.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {historyData.map((item) => (
                <div
                  key={item.week}
                  className="bg-gray-800/80 border border-gray-700/80 p-3 rounded-xl flex justify-between items-center text-xs"
                >
                  <span className="font-bold text-white">Week {item.week}</span>
                  <div className="flex gap-4 font-mono text-gray-300">
                    <span>{item.completedGames} Games Final</span>
                    <span className="text-emerald-400 font-bold">{item.totalPicks} Picks</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
