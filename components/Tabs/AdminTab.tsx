'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AdminTab() {
  const [activeSubTab, setActiveTab] = useState<'schedule' | 'invites'>('schedule');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Invites State
  const [profiles, setProfiles] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setProfiles(data || []);
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
    const inviteUrl = `${window.location.origin}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const subject = encodeURIComponent('Join our Pick Six NFL League!');
    const body = encodeURIComponent(
      `Hey! You've been invited to join our Pick Six NFL league.\n\nClick here to register and set up your team:\n${window.location.origin}`
    );
    window.location.href = `mailto:${inviteEmail}?subject=${subject}&body=${body}`;

    setInviteStatus(`Opened email client to send invite to ${inviteEmail}`);
    setInviteEmail('');
  };

  return (
    <div className="flex flex-col gap-4 pb-28 max-w-2xl mx-auto px-4 pt-4 text-white">
      <h2 className="text-xl font-bold flex items-center gap-2">🛠️ League Admin</h2>

      {/* Admin Subtabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
            activeSubTab === 'schedule' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Schedule Sync
        </button>
        <button
          onClick={() => setActiveTab('invites')}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
            activeSubTab === 'invites' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          League Invites
        </button>
      </div>

      {activeSubTab === 'schedule' ? (
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
      ) : (
        <div className="flex flex-col gap-4">
          {/* Shareable Invite Link Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-2">
            <h3 className="font-bold text-sm text-emerald-400">Copy League Invite Link</h3>
            <p className="text-xs text-gray-400">
              Share this link directly with league members so they can sign up and create their profile.
            </p>

            <button
              onClick={handleCopyInviteLink}
              className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs font-bold text-emerald-400 py-2.5 px-4 rounded-lg flex items-center justify-between transition-colors mt-1"
            >
              <span className="truncate font-mono">{typeof window !== 'undefined' ? window.location.origin : ''}</span>
              <span className="text-[11px] bg-emerald-500/20 px-2 py-1 rounded border border-emerald-500/40 text-emerald-300">
                {copiedLink ? '✓ Copied!' : 'Copy Link'}
              </span>
            </button>
          </div>

          {/* Direct Email Invite Card */}
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

          {/* Current Roster Table */}
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

                  <span className="text-[10px] text-gray-400 font-mono">
                    Joined {new Date(p.created_at || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
