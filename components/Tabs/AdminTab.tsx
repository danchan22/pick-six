'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getTeamNickname, getTeamLogoUrl } from '@/lib/nflTeams';
import WeeklyRecapModal from '@/components/Modals/WeeklyRecapModal';

interface AdminTabProps {
  currentWeek?: number;
}

export default function AdminTab({ currentWeek = 1 }: AdminTabProps) {
  const [activeSubTab, setActiveTab] = useState<'status' | 'picks' | 'invites' | 'schedule'>('status');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<any[]>([]);

  const [inviteEmail, setInviteEmail] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);

  const [selectedWeek, setSelectedWeek] = useState<number>(currentWeek);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [weekGames, setWeekGames] = useState<any[]>([]);
  const [userPicks, setUserPicks] = useState<any[]>([]);
  const [allWeekPicks, setAllWeekPicks] = useState<any[]>([]);
  const [adminActionStatus, setAdminActionStatus] = useState<string | null>(null);

  // Recap Preview Modal State
  const [isPreviewRecapOpen, setIsPreviewRecapOpen] = useState(false);

  useEffect(() => {
    if (currentWeek) setSelectedWeek(currentWeek);
  }, [currentWeek]);

  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    fetchWeekGames();
    fetchAllWeekPicks();
    if (selectedUserId) {
      fetchUserPicks();
    }
  }, [activeSubTab, selectedWeek, selectedUserId]);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('first_name', { ascending: true });

    setProfiles(data || []);
    if (data && data.length > 0 && !selectedUserId) {
      setSelectedUserId(data[0].id);
    }
  };

  const fetchWeekGames = async () => {
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('week', selectedWeek)
      .order('kickoff_time', { ascending: true });
    setWeekGames(data || []);
  };

  const fetchUserPicks = async () => {
    const { data } = await supabase
      .from('picks')
      .select('*, games(*)')
      .eq('user_id', selectedUserId)
      .eq('week', selectedWeek);
    setUserPicks(data || []);
  };

  const fetchAllWeekPicks = async () => {
    const { data } = await supabase
      .from('picks')
      .select('*, games(*)')
      .eq('week', selectedWeek);
    setAllWeekPicks(data || []);
  };

  const handleSyncSchedule = async () => {
    setSyncing(true);
    setSyncMessage(null);

    try {
      const res = await fetch('/api/admin/sync-all-weeks', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to sync');
      setSyncMessage(data.message || 'Schedule synced successfully!');
    } catch (err: any) {
      setSyncMessage(`Error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyInviteLink = () => {
    const inviteUrl = 'https://picksixleague.com';
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const subject = encodeURIComponent('Your invite to join Pick Six');
    const body = encodeURIComponent(
      'Hey! This is your invite to join Pick Six, an NFL Pick Em league. Click here to register, set up your team, and start making picks! https://picksixleague.com.'
    );
    window.location.href = `mailto:${inviteEmail}?subject=${subject}&body=${body}`;

    setInviteStatus(`Opened email client to send invite to ${inviteEmail}`);
    setInviteEmail('');
  };

  const handleDeleteProfile = async (userId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to remove "${teamName}"? This will permanently delete their profile and picks.`)) return;

    await supabase.from('picks').delete().eq('user_id', userId);
    const { error } = await supabase.from('profiles').delete().eq('id', userId);

    if (error) {
      alert(`Error removing profile: ${error.message}`);
    } else {
      alert(`Successfully removed ${teamName}`);
      fetchProfiles();
    }
  };

  const handleExportCSV = async () => {
    const { data: picks } = await supabase.from('picks').select('*, games(*), profiles(*)');
    if (!picks || picks.length === 0) return alert('No pick data available to export.');

    const headers = ['User Name', 'Team Name', 'Week', 'Selected Team', 'Is Lock', 'Points Awarded', 'Kickoff Time'];
    const rows = picks.map((p) => [
      `"${p.profiles?.first_name || ''} ${p.profiles?.last_name || ''}"`,
      `"${p.profiles?.team_name || ''}"`,
      p.week,
      `"${p.selected_team}"`,
      p.is_lock ? 'YES' : 'NO',
      p.points_awarded ?? 0,
      `"${p.games?.kickoff_time || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Pick_Six_Season_Export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAdminSelectTeam = async (gameId: string, team: string) => {
    if (!selectedUserId) return;
    setAdminActionStatus(null);

    const existingPick = userPicks.find((p) => p.game_id === gameId);

    if (existingPick?.selected_team === team) {
      const { error } = await supabase.from('picks').delete().eq('id', existingPick.id);
      if (error) setAdminActionStatus(`Error: ${error.message}`);
      else setAdminActionStatus(`Removed pick for ${getTeamNickname(team)}`);
    } else if (existingPick) {
      const { error } = await supabase
        .from('picks')
        .update({ selected_team: team })
        .eq('id', existingPick.id);
      if (error) setAdminActionStatus(`Error: ${error.message}`);
      else setAdminActionStatus(`Updated pick to ${getTeamNickname(team)}`);
    } else {
      if (selectedWeek !== 18 && userPicks.length >= 6) {
        setAdminActionStatus('User already has 6 picks for this week.');
        return;
      }

      const hasLock = userPicks.some((p) => p.is_lock);
      const isLock = selectedWeek !== 18 && !hasLock && userPicks.length === 5;

      const { error } = await supabase.from('picks').insert({
        user_id: selectedUserId,
        game_id: gameId,
        week: selectedWeek,
        selected_team: team,
        is_lock: isLock,
      });

      if (error) setAdminActionStatus(`Error: ${error.message}`);
      else setAdminActionStatus(`Added pick for ${getTeamNickname(team)}`);
    }

    fetchUserPicks();
    fetchAllWeekPicks();
  };

  const handleAdminToggleLock = async (pickId: string, currentLockState: boolean) => {
    setAdminActionStatus(null);

    if (!currentLockState) {
      await supabase
        .from('picks')
        .update({ is_lock: false })
        .eq('user_id', selectedUserId)
        .eq('week', selectedWeek);
    }

    const { error } = await supabase
      .from('picks')
      .update({ is_lock: !currentLockState })
      .eq('id', pickId);

    if (error) setAdminActionStatus(`Error: ${error.message}`);
    else setAdminActionStatus(currentLockState ? 'Lock removed' : 'Lock designated!');

    fetchUserPicks();
    fetchAllWeekPicks();
  };

  const requiredPicksCount = selectedWeek === 18 ? 16 : 6;

  const memberStatusList = profiles.map((p) => {
    const picksForUser = allWeekPicks.filter((pick) => pick.user_id === p.id);
    const hasLock = picksForUser.some((pick) => pick.is_lock);
    const count = picksForUser.length;
    const isComplete = selectedWeek === 18 ? count === 16 : count === 6 && hasLock;

    return {
      profile: p,
      count,
      isComplete,
    };
  });

  const completedCount = memberStatusList.filter((m) => m.isComplete).length;

  return (
    <div className="flex flex-col gap-4 pb-28 max-w-2xl mx-auto px-4 pt-4 text-white">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">🛠️ League Admin</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPreviewRecapOpen(true)}
            className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <span>👁️</span> Preview Recap
          </button>
          <button
            onClick={handleExportCSV}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs font-bold text-emerald-400 py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <span>📥</span> Export CSV
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 border-b border-gray-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('status')}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'status' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Weekly Status
        </button>
        <button
          onClick={() => setActiveTab('picks')}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'picks' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Manage Picks
        </button>
        <button
          onClick={() => setActiveTab('invites')}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'invites' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Invites & Roster
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'schedule' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Schedule Sync
        </button>
      </div>

      {activeSubTab === 'status' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center bg-gray-900 p-3 rounded-xl border border-gray-800">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedWeek((prev) => Math.max(1, prev - 1))}
                disabled={selectedWeek <= 1}
                className="w-7 h-7 flex items-center justify-center bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-lg text-xs font-bold transition-colors"
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
                    Week {w} {w === 18 ? '(Chaos Week)' : ''}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setSelectedWeek((prev) => Math.min(18, prev + 1))}
                disabled={selectedWeek >= 18}
                className="w-7 h-7 flex items-center justify-center bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-lg text-xs font-bold transition-colors"
              >
                ▶
              </button>
            </div>

            <span className="text-xs font-mono font-bold text-emerald-400">
              {completedCount}/{profiles.length} Ready
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {memberStatusList.map(({ profile: p, count, isComplete }) => (
              <div
                key={p.id}
                className={`p-3 rounded-xl border flex justify-between items-center transition-all ${
                  isComplete
                    ? 'bg-emerald-950/20 border-emerald-500/50'
                    : 'bg-red-950/20 border-red-500/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center font-bold text-xs overflow-hidden">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      `${p.first_name?.slice(0, 1) || ''}${p.last_name?.slice(0, 1) || ''}`
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-xs text-white flex items-center gap-1">
                      {p.team_name} {p.championships && '🏆'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {p.first_name} {p.last_name}
                    </span>
                  </div>
                </div>

                <span
                  className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
                    isComplete
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-red-500/20 text-red-300 border-red-500/40'
                  }`}
                >
                  {count}/{requiredPicksCount} Picks {isComplete ? '✓' : '⚠️'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'picks' && (
        <div className="flex flex-col gap-4">
          <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col gap-3">
            <h3 className="text-sm font-bold text-emerald-400">Override / Edit User Picks</h3>
            <p className="text-xs text-gray-400">
              Select a member and a week to view or alter their submitted picks directly.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Select User</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-gray-800 text-xs font-bold text-white p-2 rounded-lg border border-gray-700 focus:outline-none"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.team_name} ({p.first_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Select Week</label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(Number(e.target.value))}
                  className="w-full bg-gray-800 text-xs font-bold text-white p-2 rounded-lg border border-gray-700 focus:outline-none"
                >
                  {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={w}>
                      Week {w}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {adminActionStatus && (
              <p className="text-xs font-mono bg-gray-800 text-emerald-400 p-2 rounded border border-gray-700">
                {adminActionStatus}
              </p>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col gap-2">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <span className="text-xs font-bold text-white">Current Submissions</span>
              <span className="text-[10px] font-mono text-emerald-400">
                {userPicks.length}/{selectedWeek === 18 ? '16' : '6'} Picks
              </span>
            </div>

            <div className="flex flex-col gap-1.5 mt-1">
              {userPicks.length === 0 ? (
                <p className="text-xs text-gray-500 py-2 text-center">No picks found for this week.</p>
              ) : (
                userPicks.map((pick) => (
                  <div
                    key={pick.id}
                    className={`p-2 rounded-lg border flex items-center justify-between text-xs ${
                      pick.is_lock
                        ? 'bg-amber-950/30 border-amber-500/60 text-amber-300'
                        : 'bg-gray-800/80 border-gray-700/80 text-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <img src={getTeamLogoUrl(pick.selected_team)} alt="" className="w-5 h-5 object-contain" />
                      <span className="font-bold">{getTeamNickname(pick.selected_team)}</span>
                    </div>

                    {selectedWeek !== 18 && (
                      <button
                        onClick={() => handleAdminToggleLock(pick.id, pick.is_lock)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${
                          pick.is_lock
                            ? 'bg-amber-500 text-black border-amber-400'
                            : 'bg-gray-700 text-gray-400 border-gray-600 hover:text-white'
                        }`}
                      >
                        {pick.is_lock ? '🔒 LOCK' : 'Set Lock'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-gray-400 px-1">Week {selectedWeek} Matchup Board</span>
            {weekGames.map((game) => {
              const currentPick = userPicks.find((p) => p.game_id === game.id);

              return (
                <div key={game.id} className="bg-gray-900 border border-gray-800 p-2.5 rounded-xl flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    {[game.away_team, game.home_team].map((team) => {
                      const isSelected = currentPick?.selected_team === team;
                      const isLock = isSelected && currentPick?.is_lock;

                      let colorClass = 'bg-gray-800 text-gray-300 border-gray-700';
                      if (isSelected) {
                        colorClass = isLock
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                          : 'bg-blue-600/30 border-blue-500 text-white font-bold';
                      }

                      return (
                        <button
                          key={team}
                          onClick={() => handleAdminSelectTeam(game.id, team)}
                          className={`p-2 rounded-lg border text-xs flex items-center justify-between transition-colors ${colorClass}`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <img src={getTeamLogoUrl(team)} alt="" className="w-5 h-5 object-contain" />
                            <span className="truncate">{getTeamNickname(team)}</span>
                          </div>
                          {isSelected && <span className="text-[10px] font-bold">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeSubTab === 'invites' && (
        <div className="flex flex-col gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-2">
            <h3 className="font-bold text-sm text-emerald-400">Copy League Invite Link</h3>
            <p className="text-xs text-gray-400">
              Share this link directly with league members so they can sign up and create their profile.
            </p>

            <button
              onClick={handleCopyInviteLink}
              className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs font-bold text-emerald-400 py-2.5 px-4 rounded-lg flex items-center justify-between transition-colors mt-1"
            >
              <span className="truncate font-mono">https://picksixleague.com</span>
              <span className="text-[11px] bg-emerald-500/20 px-2 py-1 rounded border border-emerald-500/40 text-emerald-300">
                {copiedLink ? '✓ Copied!' : 'Copy Link'}
              </span>
            </button>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
            <h3 className="font-bold text-sm text-emerald-400">Send Direct Email Invite</h3>

            {inviteStatus && (
              <p className="text-xs text-emerald-400 font-mono bg-emerald-950/60 p-2 rounded border border-emerald-500/40">
                {inviteStatus}
              </p>
            )}

            <form onSubmit={handleSendInvite} className="flex gap-2">
              <input
                type="email"
                placeholder="friend@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-xs font-bold px-4 py-2 rounded-lg transition-colors"
              >
                Invite
              </button>
            </form>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-white">Joined Roster ({profiles.length})</h3>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">Active League</span>
            </div>

            <div className="flex flex-col gap-1.5">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className="bg-gray-800/80 p-2.5 rounded-lg flex justify-between items-center text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-[10px] overflow-hidden">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        `${p.first_name?.slice(0, 1) || ''}${p.last_name?.slice(0, 1) || ''}`
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-white block">{p.team_name}</span>
                      <span className="text-[10px] text-gray-400">
                        {p.first_name} {p.last_name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 font-mono">
                      Joined {new Date(p.created_at || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                    <button
                      onClick={() => handleDeleteProfile(p.id, p.team_name)}
                      className="bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-500/50 text-[10px] font-bold px-2 py-1 rounded transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'schedule' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
          <div>
            <h3 className="font-bold text-sm text-emerald-400">Sync NFL Matchups & Scores</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Pull the latest NFL schedule, team W-L records, and final game scores from ESPN into Supabase.
            </p>
          </div>

          {syncMessage && (
            <div
              className={`p-3 rounded-lg text-xs font-mono ${
                syncMessage.startsWith('Error')
                  ? 'bg-red-950 text-red-200 border border-red-500/50'
                  : 'bg-emerald-950 text-emerald-200 border border-emerald-500/50'
              }`}
            >
              {syncMessage}
            </div>
          )}

          <button
            onClick={handleSyncSchedule}
            disabled={syncing}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-bold py-2.5 px-4 rounded-lg text-xs transition-colors self-start"
          >
            {syncing ? 'Syncing Weeks 1-18...' : 'Sync Schedule Now'}
          </button>
        </div>
      )}

      {/* Recap Preview Modal */}
      {selectedUserId && (
        <WeeklyRecapModal
          isOpen={isPreviewRecapOpen}
          onClose={() => setIsPreviewRecapOpen(false)}
          userId={selectedUserId}
          week={selectedWeek}
        />
      )}
    </div>
  );
}
