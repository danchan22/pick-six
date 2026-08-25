'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getTeamNickname, getTeamLogoUrl } from '@/lib/nflTeams';

const ALL_NFL_TEAMS = [
  'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills',
  'Carolina Panthers', 'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns',
  'Dallas Cowboys', 'Denver Broncos', 'Detroit Lions', 'Green Bay Packers',
  'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Kansas City Chiefs',
  'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
  'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants',
  'New York Jets', 'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers',
  'Seattle Seahawks', 'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders'
];

type SortField = 'team' | 'timesPicked' | 'timesLotw' | 'maxedOutCount';

export default function StatsTab() {
  const [subTab, setSubTab] = useState<'perfection' | 'popular' | 'history'>('perfection');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [allPicks, setAllPicks] = useState<any[]>([]);

  // Sorting state for Popular subtab
  const [sortField, setSortField] = useState<SortField>('timesPicked');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  useEffect(() => {
    fetchStatsData();
  }, []);

  const fetchStatsData = async () => {
    const { data: profs } = await supabase.from('profiles').select('*');
    const { data: picksData } = await supabase.from('picks').select('*, games(*)');

    setProfiles(profs || []);
    setAllPicks(picksData || []);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Perfection Calculations
  const userPerfectWeeks: Record<string, number> = {};
  const zeroPointWeeks: { user: any; week: number; picks: any[] }[] = [];

  profiles.forEach((p) => {
    userPerfectWeeks[p.id] = 0;

    for (let w = 1; w <= 18; w++) {
      const weekPicks = allPicks.filter((pick) => pick.user_id === p.id && pick.week === w);
      if (weekPicks.length === 6) {
        const finishedPicks = weekPicks.filter((pick) => pick.games?.status === 'post');
        if (finishedPicks.length === 6) {
          const weekPts = finishedPicks.reduce((acc, curr) => acc + (curr.points_awarded || 0), 0);
          if (weekPts === 7) userPerfectWeeks[p.id] += 1;
          if (weekPts === 0) zeroPointWeeks.push({ user: p, week: w, picks: finishedPicks });
        }
      }
    }
  });

  const sortedPerfectionUsers = [...profiles].sort(
    (a, b) => (userPerfectWeeks[b.id] || 0) - (userPerfectWeeks[a.id] || 0)
  );

  // Popular Calculations & Interactive Sorting
  const teamPopularStats = ALL_NFL_TEAMS.map((teamFullName) => {
    const teamPicks = allPicks.filter((p) => p.selected_team === teamFullName);
    const timesPicked = teamPicks.length;
    const timesLotw = teamPicks.filter((p) => p.is_lock).length;

    const userCounts: Record<string, number> = {};
    teamPicks.forEach((p) => {
      userCounts[p.user_id] = (userCounts[p.user_id] || 0) + 1;
    });
    const maxedOutCount = Object.values(userCounts).filter((cnt) => cnt >= 6).length;

    return {
      teamFullName,
      teamNick: getTeamNickname(teamFullName),
      timesPicked,
      timesLotw,
      maxedOutCount,
    };
  }).sort((a, b) => {
    let comp = 0;
    if (sortField === 'team') {
      comp = a.teamNick.localeCompare(b.teamNick);
    } else {
      comp = b[sortField] - a[sortField];
    }
    return sortAsc ? -comp : comp;
  });

  return (
    <div className="flex flex-col gap-4 pb-28 max-w-2xl mx-auto px-4 pt-4 text-white">
      {/* Subtabs Header */}
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        <button
          onClick={() => setSubTab('perfection')}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
            subTab === 'perfection' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Perfection
        </button>
        <button
          onClick={() => setSubTab('popular')}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
            subTab === 'popular' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Popular
        </button>
        <button
          onClick={() => setSubTab('history')}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
            subTab === 'history' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          History
        </button>
      </div>

      {/* Subtab 1: Perfection */}
      {subTab === 'perfection' && (
        <div className="flex flex-col gap-4">
          <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col gap-3">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
              <span>🌟</span> Perfect 7-Point Weeks
            </h3>
            <p className="text-[11px] text-gray-400">
              7 points is the maximum weekly score (5 regular wins + 2 for Lock of the Week).
            </p>

            <div className="flex flex-col gap-2">
              {sortedPerfectionUsers.map((user) => (
                <div
                  key={user.id}
                  className="bg-gray-800/80 p-2.5 rounded-lg flex justify-between items-center text-xs"
                >
                  <span className="font-bold text-white">{user.team_name}</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {userPerfectWeeks[user.id] || 0} perfect
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Oops, all losses! */}
          <div className="bg-red-950/30 border border-red-500/50 p-4 rounded-xl flex flex-col gap-3">
            <h3 className="text-sm font-bold text-red-400 flex items-center gap-1.5">
              <span>🚨</span> Oops, all losses!
            </h3>

            {zeroPointWeeks.length === 0 ? (
              <p className="text-xs text-gray-400">No users have finished a week with 0 points yet.</p>
            ) : (
              zeroPointWeeks.map((item, idx) => (
                <div key={idx} className="bg-gray-900 border border-gray-800 p-3 rounded-lg flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white">
                      {item.user.team_name} (Week {item.week})
                    </span>
                    <span className="text-red-400 font-mono font-bold">0 pts</span>
                  </div>

                  <div className="grid grid-cols-6 gap-1">
                    {item.picks.map((p) => (
                      <div
                        key={p.id}
                        className="bg-red-950/80 border border-red-500/60 rounded p-1 flex flex-col items-center gap-0.5 text-center"
                      >
                        <img src={getTeamLogoUrl(p.selected_team)} alt="" className="w-5 h-5 object-contain" />
                        <span className="text-[9px] text-red-400 font-mono font-bold">L</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Subtab 2: Popular (Sortable) */}
      {subTab === 'popular' && (
        <div className="flex flex-col gap-2">
          <div className="bg-gray-900 border border-gray-800 p-3 rounded-xl text-xs flex justify-between items-center font-bold text-gray-400 select-none">
            <button
              onClick={() => handleSort('team')}
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              Team {sortField === 'team' && (sortAsc ? '↑' : '↓')}
            </button>

            <div className="flex gap-3 font-mono text-[10px]">
              <button
                onClick={() => handleSort('timesPicked')}
                className="w-10 text-right hover:text-white transition-colors"
              >
                Picked {sortField === 'timesPicked' && (sortAsc ? '↑' : '↓')}
              </button>
              <button
                onClick={() => handleSort('timesLotw')}
                className="w-10 text-right hover:text-white transition-colors"
              >
                LOTW {sortField === 'timesLotw' && (sortAsc ? '↑' : '↓')}
              </button>
              <button
                onClick={() => handleSort('maxedOutCount')}
                className="w-10 text-right hover:text-white transition-colors"
              >
                Maxed {sortField === 'maxedOutCount' && (sortAsc ? '↑' : '↓')}
              </button>
            </div>
          </div>

          {teamPopularStats.map((item) => (
            <div
              key={item.teamFullName}
              className="bg-gray-900 border border-gray-800 p-2.5 rounded-xl flex justify-between items-center text-xs"
            >
              <div className="flex items-center gap-2">
                <img src={getTeamLogoUrl(item.teamFullName)} alt="" className="w-6 h-6 object-contain" />
                <span className="font-bold text-white">{item.teamNick}</span>
              </div>

              <div className="flex gap-3 font-mono font-bold text-right text-xs pr-1">
                <span className="w-10 text-emerald-400">{item.timesPicked}</span>
                <span className="w-10 text-amber-400">{item.timesLotw}</span>
                <span className="w-10 text-indigo-400">{item.maxedOutCount}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Subtab 3: History */}
      {subTab === 'history' && (
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
