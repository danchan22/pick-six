'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Game {
  id: string;
  week: number;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: string;
  winner_team: string | null;
}

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  team_name: string;
  is_admin: boolean;
}

interface UserPick {
  id: string;
  game_id: string;
  selected_team: string;
  is_lock: boolean;
  points_awarded: number;
}

interface InviteCode {
  code: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminTab() {
  const [activeSubTab, setActiveSubTab] = useState<'games' | 'picks' | 'invites' | 'users'>('games');
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [games, setGames] = useState<Game[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userPicks, setUserPicks] = useState<UserPick[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [newCode, setNewCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchWeekGames();
    fetchUsers();
    fetchInviteCodes();
  }, [selectedWeek]);

  useEffect(() => {
    if (selectedUserId) {
      fetchUserPicks(selectedUserId, selectedWeek);
    }
  }, [selectedUserId, selectedWeek]);

  // 1. Fetch Games for Selected Week
  const fetchWeekGames = async () => {
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('week', selectedWeek)
      .order('kickoff_time', { ascending: true });
    setGames(data || []);
  };

  // 2. Fetch League Users
  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('team_name', { ascending: true });
    setUsers(data || []);
  };

  // 3. Fetch Invites
  const fetchInviteCodes = async () => {
    const { data } = await supabase.from('invite_codes').select('*').order('created_at', { ascending: false });
    setInviteCodes(data || []);
  };

  // 4. Fetch Picks for User Adjustment
  const fetchUserPicks = async (userId: string, week: number) => {
    const { data } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', userId)
      .eq('week', week);
    setUserPicks(data || []);
  };

  // Admin Action: Manual Score / Winner Override
  const handleUpdateGameScore = async (gameId: string, homeScore: number, awayScore: number, status: string, winner: string | null) => {
    setLoading(true);
    setMessage(null);

    const { error } = await supabase
      .from('games')
      .update({
        home_score: homeScore,
        away_score: awayScore,
        status: status,
        winner_team: winner,
      })
      .eq('id', gameId);

    if (error) {
      setMessage({ type: 'error', text: 'Failed to update game: ' + error.message });
    } else {
      setMessage({ type: 'success', text: 'Game updated successfully!' });
      fetchWeekGames();
    }
    setLoading(false);
  };

  // Admin Action: Override User Pick
  const handleUpdateUserPick = async (pickId: string, newTeam: string, isLock: boolean, points: number) => {
    setLoading(true);
    setMessage(null);

    const { error } = await supabase
      .from('picks')
      .update({
        selected_team: newTeam,
        is_lock: isLock,
        points_awarded: points,
      })
      .eq('id', pickId);

    if (error) {
      setMessage({ type: 'error', text: 'Failed to update pick: ' + error.message });
    } else {
      setMessage({ type: 'success', text: 'User pick adjusted successfully!' });
      if (selectedUserId) fetchUserPicks(selectedUserId, selectedWeek);
    }
    setLoading(false);
  };

  // Admin Action: Create Invite Code
  const handleCreateInviteCode = async () => {
    if (!newCode.trim()) return;
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.from('invite_codes').insert([
      { code: newCode.trim().toUpperCase(), is_active: true }
    ]);

    if (error) {
      setMessage({ type: 'error', text: 'Failed to create code: ' + error.message });
    } else {
      setMessage({ type: 'success', text: `Invite code "${newCode.toUpperCase()}" created!` });
      setNewCode('');
      fetchInviteCodes();
    }
    setLoading(false);
  };

  // Admin Action: Delete User
  const handleRemoveUser = async (userId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to remove ${teamName}? This will delete all their picks.`)) return;
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.from('profiles').delete().eq('id', userId);

    if (error) {
      setMessage({ type: 'error', text: 'Failed to remove user: ' + error.message });
    } else {
      setMessage({ type: 'success', text: 'User removed from league.' });
      fetchUsers();
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-4 pb-24 max-w-3xl mx-auto px-4 pt-4">
      {/* Admin Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🛠️ League Admin Control
          </h2>
          <p className="text-xs text-gray-400">Override scores, adjust picks, and manage access</p>
        </div>

        {/* Week Selector */}
        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 text-white text-xs font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500"
        >
          {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
            <option key={w} value={w}>
              Week {w}
            </option>
          ))}
        </select>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-2 overflow-x-auto">
        {(['games', 'picks', 'invites', 'users'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
              activeSubTab === tab
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Alert Messages */}
      {message && (
        <div
          className={`p-3 rounded-lg text-xs border ${
            message.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : 'bg-red-950/80 border-red-500/50 text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* TAB 1: GAMES & SCORE OVERRIDES */}
      {activeSubTab === 'games' && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-gray-300">Week {selectedWeek} Game Overrides</h3>
          {games.map((game) => (
            <div key={game.id} className="bg-gray-800/80 border border-gray-700 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs font-bold text-gray-300">
                <span>{game.away_team} @ {game.home_team}</span>
                <span className="text-[10px] bg-gray-900 px-2 py-0.5 rounded font-mono uppercase">{game.status}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400">{game.away_team} Score</label>
                  <input
                    type="number"
                    defaultValue={game.away_score}
                    onBlur={(e) => (game.away_score = Number(e.target.value))}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400">{game.home_team} Score</label>
                  <input
                    type="number"
                    defaultValue={game.home_score}
                    onBlur={(e) => (game.home_score = Number(e.target.value))}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <select
                  defaultValue={game.winner_team || ''}
                  onChange={(e) => (game.winner_team = e.target.value || null)}
                  className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white flex-1"
                >
                  <option value="">No Winner Set</option>
                  <option value={game.away_team}>{game.away_team}</option>
                  <option value={game.home_team}>{game.home_team}</option>
                  <option value="TIE">TIE</option>
                </select>

                <button
                  disabled={loading}
                  onClick={() => handleUpdateGameScore(game.id, game.home_score, game.away_score, 'post', game.winner_team)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded transition-colors"
                >
                  Save Override
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: USER PICK ADJUSTMENTS */}
      {activeSubTab === 'picks' && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-gray-300">Adjust User Picks</h3>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-xs text-white"
          >
            <option value="">Select User to Edit</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.team_name} ({u.first_name} {u.last_name})
              </option>
            ))}
          </select>

          {selectedUserId && userPicks.map((pick) => (
            <div key={pick.id} className="bg-gray-800/80 border border-gray-700 rounded-xl p-3 flex justify-between items-center gap-2">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">Pick: {pick.selected_team}</span>
                <span className="text-[10px] text-gray-400">{pick.is_lock ? '🔒 Lock of the Week' : 'Standard Pick'}</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  defaultValue={pick.points_awarded}
                  onBlur={(e) => handleUpdateUserPick(pick.id, pick.selected_team, pick.is_lock, Number(e.target.value))}
                  className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono"
                />
                <span className="text-xs text-gray-400">pts</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: INVITE CODES */}
      {activeSubTab === 'invites' && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-gray-300">Generate Invite Codes</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. PICKSIX2025"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white flex-1 uppercase"
            />
            <button
              onClick={handleCreateInviteCode}
              disabled={loading || !newCode.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg"
            >
              Add Code
            </button>
          </div>

          <div className="flex flex-col gap-1.5 mt-2">
            {inviteCodes.map((inv) => (
              <div key={inv.code} className="bg-gray-800/60 border border-gray-700/60 rounded-lg p-2.5 flex justify-between items-center text-xs">
                <span className="font-mono font-bold text-emerald-400">{inv.code}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${inv.is_active ? 'bg-emerald-950 text-emerald-300' : 'bg-gray-900 text-gray-500'}`}>
                  {inv.is_active ? 'Active' : 'Used/Inactive'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: USER MANAGEMENT */}
      {activeSubTab === 'users' && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-gray-300">League Members</h3>
          {users.map((u) => (
            <div key={u.id} className="bg-gray-800/80 border border-gray-700 rounded-xl p-3 flex justify-between items-center">
              <div>
                <p className="font-bold text-xs text-white">{u.team_name}</p>
                <p className="text-[11px] text-gray-400">{u.first_name} {u.last_name}</p>
              </div>

              {!u.is_admin && (
                <button
                  onClick={() => handleRemoveUser(u.id, u.team_name)}
                  className="bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-500/50 text-[10px] font-bold px-2.5 py-1 rounded"
                >
                  Remove User
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
