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

// Convert any image URL (local or external) to Base64 via server proxy
async function fetchAsBase64(url: string): Promise<string> {
  if (!url) return '';
  try {
    const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url;
    const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(fullUrl)}`);
    if (!res.ok) return url;
    const data = await res.json();
    return data.dataUrl || url;
  } catch (e) {
    return url;
  }
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
  const [bestUsers, setBestUsers] = useState<any[]>([]);
  const [topStandings, setTopStandings] = useState<any[]>([]);
  const [logoBase64, setLogoBase64] = useState<string>('');

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

    // Convert Pick Six logo to base64
    const b64AppLogo = await fetchAsBase64('/pick-six-logo.png');
    setLogoBase64(b64AppLogo);

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

    // 1. Most Popular Picks
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

    const teamList = await Promise.all(
      Object.entries(teamPickCounts).map(async ([team, count]) => {
        const game = weekGames.find((g) => g.home_team === team || g.away_team === team);
        const b64Logo = await fetchAsBase64(getTeamLogoUrl(team));
        return { team, count, game, logoUrl: b64Logo };
      })
    );

    teamList.sort((a, b) => b.count - a.count);
    setMostPopularPicks(teamList.slice(0, 3));

    // 2. Upsets This Week + Busted Locks Integration
    const qualifiedUpsets: any[] = [];
    for (const { game, homeTeam, awayTeam, homePicks, awayPicks } of gamePickStats) {
      if (game.status !== 'post') continue;

      const evaluateUpset = async (
        pickedTeam: string,
        oppTeam: string,
        pCount: number,
        oCount: number
      ) => {
        const bustedLockPicks = weekPicks.filter(
          (p) => p.game_id === game.id && p.selected_team === pickedTeam && p.is_lock
        );

        const bustedNames = bustedLockPicks.map((p) => {
          const fn = p.profiles?.first_name?.trim();
          const li = p.profiles?.last_name?.trim()?.slice(0, 1);
          return fn ? `${fn}${li ? ` ${li}.` : ''}` : p.profiles?.team_name || 'Unknown';
        });

        if (pCount > oCount && game.winner_team === oppTeam) {
          const b64Logo = await fetchAsBase64(getTeamLogoUrl(pickedTeam));
          qualifiedUpsets.push({
            team: pickedTeam,
            opponent: oppTeam,
            count: pCount,
            oppCount: oCount,
            game,
            logoUrl: b64Logo,
            bustedLockNames: bustedNames,
          });
        }
      };

      await evaluateUpset(homeTeam, awayTeam, homePicks, awayPicks);
      await evaluateUpset(awayTeam, homeTeam, awayPicks, homePicks);
    }

    qualifiedUpsets.sort((a, b) => b.count - a.count);
    setUpsets(qualifiedUpsets);

    // 3. Best Record Calculation for Selected Week
    const userWeekPerformance: Record<string, { wins: number; losses: number; points: number; profile: any }> = {};

    profiles.forEach((p) => {
      userWeekPerformance[p.id] = { wins: 0, losses: 0, points: 0, profile: p };
    });

    weekPicks.forEach((p) => {
      if (p.games?.status === 'post') {
        const isWin = p.selected_team === p.games.winner_team;
        const isTie = p.games.winner_team === 'TIE';

        if (!userWeekPerformance[p.user_id]) {
          const profileMatch = profiles.find((prof) => prof.id === p.user_id);
          userWeekPerformance[p.user_id] = { wins: 0, losses: 0, points: 0, profile: profileMatch || p.profiles };
        }

        let pts = 0;
        if (selectedWeek === 18) {
          pts = isWin ? 1 : isTie ? 0.5 : 0;
        } else if (p.is_lock) {
          pts = isWin ? 2 : -1;
        } else {
          pts = isWin ? 1 : isTie ? 0.5 : 0;
        }

        userWeekPerformance[p.user_id].points += pts;

        if (isWin) {
          userWeekPerformance[p.user_id].wins += 1;
        } else if (!isTie) {
          userWeekPerformance[p.user_id].losses += 1;
        }
      }
    });

    const performanceList = Object.values(userWeekPerformance).filter((u) => u.wins > 0 || u.losses > 0 || u.points !== 0);

    if (performanceList.length > 0) {
      const maxPts = Math.max(...performanceList.map((u) => u.points));
      const winners = performanceList.filter((u) => u.points === maxPts);
      setBestUsers(winners);
    } else {
      setBestUsers([]);
    }

    // 4. Current Standings (Top 3)
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
      await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `PickSix_Week_${selectedWeek}_Recap.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Week ${selectedWeek} Recap`,
        });
      } else {
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
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-gray-800 pb-3">
            {logoBase64 && (
              <img
                src={logoBase64}
                alt="Pick Six"
                className="w-10 h-10 object-contain"
              />
            )}
            <h2 className="text-xl font-black text-white tracking-tight">
              Week {selectedWeek} Recap
            </h2>
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
                            {item.logoUrl && (
                              <img
                                src={item.logoUrl}
                                alt=""
                                className="w-6 h-6 object-contain flex-shrink-0"
                              />
                            )}
                            <div className="flex flex-col truncate">
                              <span className="font-bold text-white truncate">
                                {getTeamNickname(item.team)}{' '}
                                <span className="text-[11px] font-normal text-gray-400">
                                  {isHome ? 'vs' : '@'} {getTeamAbbr(opponent)}
                                </span>
                              </span>
                              <span className="text-[10px] text-white font-bold">
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
                          className="bg-red-950/20 border border-red-500/40 rounded-xl p-2.5 flex flex-col gap-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {item.logoUrl && (
                                <img
                                  src={item.logoUrl}
                                  alt=""
                                  className="w-6 h-6 object-contain flex-shrink-0"
                                />
                              )}
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

                          {item.bustedLockNames && item.bustedLockNames.length > 0 && (
                            <div className="border-t border-red-500/20 pt-1.5 text-[10px] flex items-center flex-wrap gap-x-1 gap-y-0.5">
                              <span className="font-bold text-amber-400">Locks busted:</span>
                              {item.bustedLockNames.map((name: string, nIdx: number) => (
                                <span key={nIdx} className="text-white font-medium whitespace-nowrap">
                                  {name}
                                  {nIdx < item.bustedLockNames.length - 1 && (
                                    <span className="text-gray-500 ml-1">•</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Best Record */}
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🥇</span> BEST RECORD
                </h3>

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col gap-1.5">
                  {bestUsers.length === 0 ? (
                    <span className="text-xs text-gray-500 italic">
                      No game results recorded for Week {selectedWeek}.
                    </span>
                  ) : (
                    bestUsers.map((u, i) => {
                      const fn = u.profile?.first_name?.trim() || '';
                      const ln = u.profile?.last_name?.trim() || '';
                      const displayName = `${fn} ${ln}`.trim() || u.profile?.team_name || 'Unknown';

                      return (
                        <div
                          key={i}
                          className="flex justify-between items-center text-xs"
                        >
                          <span className="font-bold text-white flex items-center gap-1.5 truncate pr-2">
                            <span>👑</span> {displayName}
                          </span>
                          <span className="font-mono text-[11px] text-gray-300 flex-shrink-0">
                            {u.wins}-{u.losses},{' '}
                            <span className="text-emerald-400 font-bold">
                              {u.points} {u.points === 1 ? 'pt' : 'pts'}
                            </span>
                          </span>
                        </div>
                      );
                    })
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
