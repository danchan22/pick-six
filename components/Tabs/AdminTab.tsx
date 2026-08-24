'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AdminTab() {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'add_picks' | 'invites'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [games, setGames] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [isLock, setIsLock] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchWeekGames();
  }, [selectedWeek]);

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*');
    setUsers(data || []);
  };

  const fetchWeekGames = async () => {
    const { data } = await supabase.from('games').select('*').eq('week', selectedWeek);
    setGames(data || []);
  };

  const handleUpdateUserProfile = async (userId: string, teamName: string, firstName: string, lastName: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ team_name: teamName, first_name: firstName, last_name: lastName })
      .eq('id', userId);

    if (error) setMessage({ type: 'error', text: error.message });
    else {
      setMessage({ type: 'success', text: 'User info updated!' });
      fetchUsers();
    }
  };

  const handleAdminAddPick = async () => {
    if (!selectedUser || !selectedGameId || !selectedTeam) return;

    const { error } = await supabase.from('picks').insert({
      user_id: selectedUser.id,
      game_id: selectedGameId,
      week: selectedWeek,
      selected_team: selectedTeam,
      is_lock: isLock,
    });

    if (error) setMessage({ type: 'error', text: error.message });
    else setMessage({ type: 'success', text: `Pick added for ${selectedUser.team_name}!` });
  };

  return (
    <div className="flex flex-col gap-4 pb-24 max-w-2xl mx-auto px-4 pt-4 text-white">
      <h2 className="text-xl font-bold">League Admin Control</h2>

      {message && (
        <div className="p-2 rounded text-xs bg-emerald-950 text-emerald-200 border border-emerald-500">
          {message.text}
        </div>
      )}

      {/* Sub tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        {(['users', 'add_picks', 'invites'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`text-xs font-bold px-3 py-1 rounded-lg capitalize ${
              activeSubTab === tab ? 'bg-emerald-600 text-white' : 'text-gray-400'
            }`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Edit User Info */}
      {activeSubTab === 'users' && (
        <div className="flex flex-col gap-3">
          {users.map((u) => (
            <div key={u.id} className="bg-gray-900 border border-gray-800 p-3 rounded-xl flex flex-col gap-2">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <input
                  type="text"
                  defaultValue={u.team_name}
                  onBlur={(e) => (u.team_name = e.target.value)}
                  className="bg-gray-800 p-1.5 rounded border border-gray-700 text-white"
                />
                <input
                  type="text"
                  defaultValue={u.first_name}
                  onBlur={(e) => (u.first_name = e.target.value)}
                  className="bg-gray-800 p-1.5 rounded border border-gray-700 text-white"
                />
                <input
                  type="text"
                  defaultValue={u.last_name}
                  onBlur={(e) => (u.last_name = e.target.value)}
                  className="bg-gray-800 p-1.5 rounded border border-gray-700 text-white"
                />
              </div>
              <button
                onClick={() => handleUpdateUserProfile(u.id, u.team_name, u.first_name, u.last_name)}
                className="bg-emerald-600 text-xs font-bold py-1 rounded text-white"
              >
                Save Changes
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Admin Add Picks for Users */}
      {activeSubTab === 'add_picks' && (
        <div className="flex flex-col gap-3 bg-gray-900 border border-gray-800 p-4 rounded-xl">
          <label className="text-xs text-gray-400">Select User</label>
          <select
            onChange={(e) => setSelectedUser(users.find((u) => u.id === e.target.value))}
            className="bg-gray-800 text-xs p-2 rounded text-white border border-gray-700"
          >
            <option value="">Select Member</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.team_name} ({u.first_name})
              </option>
            ))}
          </select>

          <label className="text-xs text-gray-400">Select Week</label>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
            className="bg-gray-800 text-xs p-2 rounded text-white border border-gray-700"
          >
            {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>

          <label className="text-xs text-gray-400">Select Game</label>
          <select
            onChange={(e) => {
              setSelectedGameId(e.target.value);
              const g = games.find((item) => item.id === e.target.value);
              if (g) setSelectedTeam(g.home_team);
            }}
            className="bg-gray-800 text-xs p-2 rounded text-white border border-gray-700"
          >
            <option value="">Select Matchup</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.away_team} @ {g.home_team}
              </option>
            ))}
          </select>

          {selectedGameId && (
            <div className="flex items-center gap-4 py-2">
              <label className="text-xs text-gray-400">Team:</label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="bg-gray-800 text-xs p-2 rounded text-white border border-gray-700"
              >
                {games
                  .filter((g) => g.id === selectedGameId)
                  .map((g) => (
                    <>
                      <option key={g.away_team} value={g.away_team}>
                        {g.away_team}
                      </option>
                      <option key={g.home_team} value={g.home_team}>
                        {g.home_team}
                      </option>
                    </>
                  ))}
              </select>

              <label className="flex items-center gap-1.5 text-xs text-amber-400 font-bold">
                <input
                  type="checkbox"
                  checked={isLock}
                  onChange={(e) => setIsLock(e.target.checked)}
                />
                Lock?
              </label>
            </div>
          )}

          <button
            onClick={handleAdminAddPick}
            className="bg-emerald-600 text-xs font-bold py-2 rounded text-white mt-2"
          >
            Force Add Pick
          </button>
        </div>
      )}
    </div>
  );
}
