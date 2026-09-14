'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getTeamLogoUrl, getTeamNickname, getTeamAbbr } from '@/lib/nflTeams';
import { toPng } from 'html-to-image';

interface AdminWeeklyRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialWeek?: number;
}

export default function AdminWeeklyRecapModal({
  isOpen,
  onClose,
  initialWeek = 1,
}: AdminWeeklyRecapModalProps) {
  const [selectedWeek, setSelectedWeek] = useState(initialWeek);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const [mostPopularPicks, setMostPopularPicks] = useState<any[]>([]);
  const [upsets, setUpsets] = useState<any[]>([]);
  const [bustedLocks, setBustedLocks] = useState<any[]>([]);
  const [perfectUsers, setPerfectUsers] = useState<any[]>([]);
  const [topStandings, setTopStandings] = useState<any[]>([]);

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialWeek) setSelectedWeek(initialWeek);
  }, [initialWeek]);

  useEffect(() => {
    if (isOpen) {
      loadRecapData();
    }
  }, [isOpen, selectedWeek]);

  const loadRecapData = async () => {
    setLoading(true);

    const { data: weekGames } = await supabase
      .from('games')
      .select('*')
      .eq('week', selectedWeek);

    const { data: allPicks } = await supabase
      .from('picks')
      .select('*, games(*), profiles(*)');

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*');

    if (!weekGames || !allPicks || !profiles) {
      setLoading(false);
      return;
    }

    const weekPicks = allPicks.filter((p) => p.week === selectedWeek);

    // 1. Most Popular Picks & Upsets Calculation
    const teamPickCounts: Record<string, number> = {};
    weekPicks.forEach((p) => {
      teamPickCounts[p.selected_team] = (teamPickCounts[p.selected_team] || 0) + 1;
    });

    const gamePickStats = weekGames.map((game) => {
      const homePicks = teamPickCounts[game.home_team] || 0;
      const awayPicks = teamPickCounts[game.away_team] || 0;

      return {
        game,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        homePicks,
        awayPicks,
      };
    });

    const teamList = Object.entries(teamPickCounts).map(([team, count]) => {
      const game = weekGames.find((g) => g.home_team === team || g.away_team === team);
      return { team, count, game };
    });

    teamList.sort((a, b) => b.count - a.count);
    setMostPopularPicks(teamList.slice(0, 3));

    // 2. Upsets This Week (More people picked Team A than Team B, but Team A lost)
    const qualifiedUpsets: any[] = [];
    gamePickStats.forEach(({ game, homeTeam, awayTeam, homePicks, awayPicks }) => {
      if (game.status !== 'post') return;

      if (homePicks > awayPicks && game.winner_team === awayTeam) {
        qualifiedUpsets.push({
          team: homeTeam,
          opponent: awayTeam,
          count: homePicks,
          oppCount: awayPicks,
          game,
        });
      } else if (awayPicks > homePicks && game.winner_team === homeTeam) {
        qualifiedUpsets.push({
          team: awayTeam,
          opponent: homeTeam,
          count: awayPicks,
          oppCount: homePicks,
          game,
        });
      }
    });

    qualifiedUpsets.sort((a, b) => b.count - a.count);
    setUpsets(qualifiedUpsets);

    // 3. Locks Busted
    const bustedLockPicks = weekPicks.filter((p) => {
      const game = p.games;
      if (!p.is_lock || !game || game.status !== 'post') return false;
      return game.winner_team !== p.selected_team && game.winner_team !== 'TIE';
    });

    setBustedLocks(bustedLockPicks);

    // 4. Perfect Weeks
    const userWeekStats: Record<string, { wins: number; losses: number; total: number }> = {};
    profiles.forEach((p) => {
      userWeekStats[p.id] = { wins: 0, losses: 0, total: 0 };
    });

    weekPicks.forEach((p) => {
      if (p.games?.status === 'post') {
        const isWin = p.selected_team === p.games.winner_team;
        if (!userWeekStats[p.user_id]) {
          userWeekStats[p.user_id] = { wins: 0, losses: 0, total: 0 };
        }
        userWeekStats[p.user_id].total += 1;
        if (isWin) userWeekStats[p.user_id].wins += 1;
        else userWeekStats[p.user_id].losses += 1;
      }
    });

    const targetPicksCount = selectedWeek === 18 ? 16 : 6;
    const perfectUserIds = Object.entries(userWeekStats)
      .filter(([_, stats]) => stats.wins >= targetPicksCount && stats.losses === 0)
      .map(([uid]) => uid);

    const perfectProfiles = profiles.filter((p) => perfectUserIds.includes(p.id));
    setPerfectUsers(perfectProfiles);

    // 5. Current Standings (Top 3)
    const userScores: Record<string, number> = {};
    const userWins: Record<string, number> = {};
    const userLosses: Record<string, number> = {};

    profiles.forEach((p) => {
      userScores[p.id] = 0;
      userWins[p.id] = 0;
      userLosses[p.id] = 0;
    });

    allPicks.forEach((p) => {
      if (p.games?.status === 'post') {
        const isWin = p.selected_team === p.games.winner_team;
        if (p.is_lock) {
          userScores[p.user_id] += isWin ? 2.0 : -1.0;
        } else {
          if (isWin) userScores[p.user_id] += 1.0;
          else if (p.games.winner_team === 'TIE') userScores[p.user_id] += 0.5;
        }

        if (isWin) userWins[p.user_id] += 1;
        else if (p.games.winner_team !== 'TIE') userLosses[p.user_id] += 1;
      }
    });

    const rankedProfiles = profiles.map((p) => ({
      ...p,
      totalPoints: userScores[p.id] || 0,
      wins: userWins[p.id] || 0,
      losses: userLosses[p.id] || 0,
    }));

    rankedProfiles.sort((a, b) => b.totalPoints - a.totalPoints || b.wins - a.wins);
    setTopStandings(rankedProfiles.slice(0, 3));

    setLoading(false);
  };

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    setDownloading(true);

    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      
      // Check if Web Share API is available (Mobile photo save/share)
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `PickSix_Week_${selectedWeek}_Recap.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Week ${selectedWeek} Recap`,
        });
      } else {
        // Fallback for desktop downloads
        const link = document.createElement('a');
        link.download = `PickSix_Week_${selectedWeek}_Recap.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error('Failed to capture or share image', err);
    } finally {
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="flex flex-col items-center gap-3 w-full max-w-md my-auto">
        {/* Controls Bar */}
        <div className="flex items-center justify-between w-full bg-gray-900 border border-gray-800 p-2.5 rounded-xl text-white">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedWeek((w) => Math.max(1, w - 1))}
              disabled={selectedWeek <= 1}
              className="w-7 h-7 flex items-center justify-center bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-lg text-xs font-bold"
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
                  Week {w}
                </option>
              ))}
            </select>
            <button
              onClick={() => setSelectedWeek((w) => Math.min(18, w + 1))}
              disabled={selectedWeek >= 18}
              className="w-7 h-7 flex items-center justify-center bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-lg text-xs font-bold"
            >
              ▶
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadImage}
              disabled={loading || downloading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow transition-colors disabled:opacity-50"
            >
              <span>{downloading ? 'Exporting...' : 'Save Image'}</span>
            </button>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white font-bold text-sm px-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Export Card Area */}
        <div
          ref={cardRef}
          className="bg-gray-950 border border-gray-800 rounded-2xl w-full p-6 relative flex flex-col gap-5 text-white shadow-2xl"
        >
          {/* Logo Header */}
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <div className="flex items-center gap-3">
              <img src="/pick-six-logo.png" alt="Pick Six" className="w-10 h-10 object-contain" />
              <div>
                <h2 className="text-xl font-black text-white tracking-tight">
                  Week {selectedWeek} Recap
                </h2>
                <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest">
                  PICK SIX LEAGUE
                </span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400 font-mono animate-pulse">
              Generating Week {selectedWeek} summary...
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Most Popular Picks */}
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-extrabold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🔥</span> MOST POPULAR PICKS
                </h3>

                <div className="flex flex-col gap-1.5">
                  {mostPopularPicks.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No picks submitted.</p>
                  ) : (
                    mostPopularPicks.map((item, i) => {
                      const game = item.game;
                      const isHome = item.team === game?.home_team;
                      const opponent = game ? (isHome ? game.away_team : game.home_team) : '';
                      const teamScore = game ? (isHome ? game.home_score : game.away_score) : 0;
                      const oppScore = game ? (isHome ? game.away_score : game.home_score) : 0;
                      const isFinished = game?.status === 'post';
                      const isWin = isFinished && game.winner_team === item.team;

                      return (
                        <div
                          key={i}
                          className="bg-gray-900 border border-gray-800 rounded-xl p-2.5 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={getTeamLogoUrl(item.team)}
                              alt=""
                              className="w-6 h-6 object-contain flex-shrink-0"
                            />
                            <div className="flex flex-col truncate">
                              <span className="font-bold text-white truncate">
                                {getTeamNickname(item.team)}{' '}
                                <span className="text-[11px] font-normal text-gray-400">
                                  {isHome ? 'vs' : '@'} {getTeamAbbr(opponent)}
                                </span>
                              </span>
                              <span className="text-[10px] text-amber-400 font-bold">
                                Picked by {item.count} players
                              </span>
                            </div>
                          </div>

                          {isFinished && (
                            <div
                              className={`px-2.5 py-0.5 rounded border text-xs font-mono font-bold shadow ${
                                isWin
                                  ? 'bg-emerald-600 border-emerald-500 text-white'
                                  : 'bg-red-600 border-red-500 text-white'
                              }`}
                            >
                              {isWin ? 'W' : 'L'} {teamScore}-{oppScore}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Upsets This Week */}
              {upsets.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-extrabold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🚨</span> UPSETS THIS WEEK
                  </h3>

                  <div className="flex flex-col gap-1.5">
                    {upsets.map((item, i) => {
                      const game = item.game;
                      const isHome = item.team === game?.home_team;
                      const teamScore = game ? (isHome ? game.home_score : game.away_score) : 0;
                      const oppScore = game ? (isHome ? game.away_score : game.home_score) : 0;

                      return (
                        <div
                          key={i}
                          className="bg-red-950/20 border border-red-500/40 rounded-xl p-2.5 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={getTeamLogoUrl(item.team)}
                              alt=""
                              className="w-6 h-6 object-contain flex-shrink-0"
                            />
                            <div className="flex flex-col truncate">
                              <span className="font-bold text-white truncate">
                                {getTeamNickname(item.team)}{' '}
                                <span className="text-[11px] font-normal text-gray-400">
                                  {isHome ? 'vs' : '@'} {getTeamAbbr(item.opponent)}
                                </span>
                              </span>
                              <span className="text-[10px] text-red-400 font-bold">
                                Picked by {item.count} vs {item.oppCount}
                              </span>
                            </div>
                          </div>

                          <div className="px-2.5 py-0.5 rounded border border-red-500 bg-red-600 text-xs font-mono font-bold text-white shadow">
                            L {teamScore}-{oppScore}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Locks Busted */}
              {bustedLocks.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🔒</span> LOCKS BUSTED
                  </h3>

                  <div className="flex flex-col gap-1.5">
                    {bustedLocks.map((pick) => {
                      const firstName = pick.profiles?.first_name?.trim();
                      const lastInitial = pick.profiles?.last_name?.trim()?.slice(0, 1);
                      const displayName = firstName
                        ? `${firstName}${lastInitial ? ` ${lastInitial}.` : ''}`
                        : pick.profiles?.team_name || 'Unknown';

                      return (
                        <div
                          key={pick.id}
                          className="bg-gray-900 border border-amber-500/40 p-2.5 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <img
                              src={getTeamLogoUrl(pick.selected_team)}
                              alt=""
                              className="w-6 h-6 object-contain"
                            />
                            <div className="flex flex-col">
                              <span className="font-bold text-white">{displayName}</span>
                              <span className="text-[10px] text-amber-300 font-semibold">
                                Lock: {getTeamNickname(pick.selected_team)}
                              </span>
                            </div>
                          </div>

                          <span className="text-xs font-mono font-bold text-red-400 bg-red-950/60 border border-red-500/50 px-2 py-0.5 rounded">
                            -1.0 pt
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Perfect Weeks */}
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>⭐</span> PERFECT WEEKS
                </h3>

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-wrap gap-2 items-center">
                  {perfectUsers.length === 0 ? (
                    <span className="text-xs text-gray-500 italic">
                      No perfect weeks recorded for Week {selectedWeek}.
                    </span>
                  ) : (
                    perfectUsers.map((u) => (
                      <span
                        key={u.id}
                        className="bg-amber-500/10 border border-amber-500/40 text-amber-300 px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1"
                      >
                        👑 {u.team_name}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Current Standings (Top 3) */}
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🏆</span> CURRENT STANDINGS (TOP 3)
                </h3>

                <div className="flex flex-col gap-1.5">
                  {topStandings.map((user, idx) => {
                    const isFirst = idx === 0;
                    return (
                      <div
                        key={user.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                          isFirst
                            ? 'gold-shimmer-card border-amber-500/50'
                            : 'bg-gray-900 border-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-extrabold text-xs w-4 text-center text-gray-400">
                            {isFirst ? '👑' : `#${idx + 1}`}
                          </span>
                          <div className="flex flex-col">
                            <span className="font-bold text-white">{user.team_name}</span>
                            <span className="text-[10px] text-gray-400">
                              {user.first_name} {user.last_name}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`font-mono font-extrabold ${
                              isFirst ? 'text-amber-400' : 'text-emerald-400'
                            }`}
                          >
                            {user.totalPoints} pts
                          </span>
                          <span className="block text-[10px] text-gray-400 font-mono">
                            {user.wins}-{user.losses}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
