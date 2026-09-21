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

interface BestUser {
  name: string;
  wins: number;
  losses: number;
  points: number;
}

interface WeekStat {
  week: number;
  leaguePoints: number;
  leagueWins: number;
  leagueLosses: number;
  winPctStr: string;
  bestUsers: BestUser[];
  hasCompletedGames: boolean;
}

export default function StatsTab() {
  const [subTab, setSubTab] = useState<'perfection' | 'weeks' | 'popular' | 'history'>('popular');
  const [teamStats, setTeamStats] = useState<TeamStat[]>([]);
  const [perfectionData, setPerfectionData] = useState<any[]>([]);
  const [shameData, setShameData] = useState<any[]>([]);
  const [weeksData, setWeeksData] = useState<WeekStat[]>([]);
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

    // 3. Weeks Calculations (Weeks 1 to 18)
    const weeksList: WeekStat[] = [];

    for (let wk = 1; wk <= 18; wk++) {
      const wkPicks = completedPicks.filter((p) => p.week === wk);

      if (wkPicks.length === 0) {
        weeksList.push({
          week: wk,
          leaguePoints: 0,
          leagueWins: 0,
          leagueLosses: 0,
          winPctStr: '.000',
          bestUsers: [],
          hasCompletedGames: false,
        });
        continue;
      }

      let leagueWins = 0;
      let leagueLosses = 0;
      let leagueTies = 0;
      let leaguePoints = 0;

      const userStatsMap: Record<string, { wins: number; losses: number; points: number; profile: any }> = {};

      wkPicks.forEach((p) => {
        const isWin = p.selected_team === p.games?.winner_team;
        const isTie = p.games?.winner_team === 'TIE';

        let pts = 0;
        if (wk === 18) {
          pts = isWin ? 1 : isTie ? 0.5 : 0;
        } else if (p.is_lock) {
          pts = isWin ? 2 : -1;
        } else {
          pts = isWin ? 1 : isTie ? 0.5 : 0;
        }

        leaguePoints += pts;

        if (isWin) leagueWins += 1;
        else if (isTie) leagueTies += 1;
        else leagueLosses += 1;

        if (!userStatsMap[p.user_id]) {
          userStatsMap[p.user_id] = { wins: 0, losses: 0, points: 0, profile: p.profiles };
        }

        if (isWin) {
          userStatsMap[p.user_id].wins += 1;
        } else if (!isTie) {
          userStatsMap[p.user_id].losses += 1;
        }
        userStatsMap[p.user_id].points += pts;
      });

      const totalGames = leagueWins + leagueLosses + leagueTies;
      const winPct = totalGames > 0 ? (leagueWins + 0.5 * leagueTies) / totalGames : 0;
      const winPctStr = winPct === 1 ? '1.000' : winPct.toFixed(3).replace(/^0/, '');

      const userList = Object.values(userStatsMap);
      let bestUsers: BestUser[] = [];

      if (userList.length > 0) {
        const maxPts = Math.max(...userList.map((u) => u.points));
        const topUsers = userList.filter((u) => u.points === maxPts);

        bestUsers = topUsers.map((u) => {
          const fn = u.profile?.first_name?.trim() || '';
          const li = u.profile?.last_name?.trim()?.slice(0, 1) || '';
          const name = fn ? `${fn}${li ? ` ${li}.` : ''}` : (u.profile?.team_name || 'Unknown');
          return {
            name,
            wins: u.wins,
            losses: u.losses,
            points: u.points,
          };
        });
      }

      weeksList.push({
        week: wk,
        leaguePoints,
        leagueWins,
        leagueLosses,
        winPctStr,
        bestUsers,
        hasCompletedGames: true,
      });
    }

    setWeeksData(weeksList);
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
      <div className="flex justify-center gap-1.5 bg-gray-900 p-1.5 rounded-xl border border-gray-800">
        <button
          onClick={() => setSubTab('perfection')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            subTab === 'perfection' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Perfection
        </button>
        <button
          onClick={() => setSubTab('weeks')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            subTab === 'weeks' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Weeks
        </button>
        <button
          onClick={() => setSubTab('popular')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            subTab === 'popular' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Popular
        </button>
        <button
          onClick={() => setSubTab('history')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
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
              Every single pick right for the week!
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
                      Week {item.week}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Hall of Shame / Goose Egg (0 Point Weeks) */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xl">
            <h3 className="font-extrabold text-sm text-red-400 flex items-center gap-2">
              <span>💩</span> Hall of Poop
            </h3>
            <p className="text-xs text-gray-400">
              0 points or fewer in a week!
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
      ) : subTab === 'weeks' ? (
        /* Subtab 2: Weeks */
        <div className="flex flex-col gap-2.5">
          {weeksData.map((wItem) => (
            <div
              key={wItem.week}
              className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex gap-3 items-start shadow-md"
            >
              {/* Standings-style week number on left without # */}
              <span className="font-extrabold text-sm font-mono w-6 text-center text-gray-400 pt-0.5">
                {wItem.week}
              </span>

              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-xs text-white">Week {wItem.week}</h4>
                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                      League record: <span className="text-gray-200 font-bold">{wItem.leagueWins}-{wItem.leagueLosses}</span>{' '}
                      <span className="text-gray-400">({wItem.winPctStr})</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-base font-mono text-emerald-400">
                      {wItem.leaguePoints} {wItem.leaguePoints === 1 ? 'pt' : 'pts'}
                    </span>
                    <span className="block text-[10px] text-gray-400 font-bold tracking-wider">
                      League points
                    </span>
                  </div>
                </div>

                {/* Best record section */}
                {wItem.bestUsers.length > 0 && (
                  <div className="border-t border-gray-800/80 pt-2 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-amber-400/90 uppercase tracking-wider">
                      Best record:
                    </span>
                    <div className="flex flex-col gap-1">
                      {wItem.bestUsers.map((bUser, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <span className="font-bold text-white">
                            {bUser.name}
                          </span>
                          <span className="font-mono text-[11px] text-gray-300">
                            {bUser.wins}-{bUser.losses}, <span className="text-emerald-400 font-bold">{bUser.points} {bUser.points === 1 ? 'pt' : 'pts'}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Subtab 4: History */
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-400">Celebrate our league&apos;s past champions.</p>

          <div className="bg-gradient-to-r from-amber-950/60 to-yellow-950/60 border-2 border-amber-400 rounded-2xl p-4 shadow-xl flex justify-between items-center">
            <div>
              <span className="text-xs font-mono font-extrabold text-amber-400">2025 CHAMPION</span>
              <h4 className="text-lg font-extrabold text-white flex items-center gap-1.5">
                Mandie 🏆
              </h4>
            </div>
            <span className="font-mono font-bold text-amber-300 text-sm bg-black/40 px-3 py-1 rounded-lg border border-amber-400/40">
              80-21
            </span>
          </div>

          <div className="bg-gradient-to-r from-amber-950/60 to-yellow-950/60 border-2 border-amber-400 rounded-2xl p-4 shadow-xl flex flex-col gap-2">
            <span className="text-xs font-mono font-extrabold text-amber-400">2024 CO-CHAMPIONS</span>
            <div className="flex justify-between items-center border-b border-amber-500/20 pb-1.5">
              <h4 className="text-sm font-bold text-white flex items-center gap-1">
                Rick 🏆
              </h4>
              <span className="font-mono font-bold text-amber-300 text-xs">73-17</span>
            </div>
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-white flex items-center gap-1">
                Lindsay 🏆
              </h4>
              <span className="font-mono font-bold text-amber-300 text-xs">73-17</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
