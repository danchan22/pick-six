'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onProfileUpdated: () => void;
}

export default function ProfileModal({
  isOpen,
  onClose,
  userId,
  onProfileUpdated,
}: ProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'history'>('profile');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userPicks, setUserPicks] = useState<any[]>([]);
  const [selectedWeekHistory, setSelectedWeekHistory] = useState<number>(1);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      loadUserProfile();
      loadPickHistory();
    }
  }, [isOpen, userId, selectedWeekHistory]);

  const loadUserProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('first_name, last_name, team_name, avatar_url')
      .eq('id', userId)
      .single();

    if (data) {
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setTeamName(data.team_name || '');
      setAvatarUrl(data.avatar_url || null);
    }
  };

  const loadPickHistory = async () => {
    const { data } = await supabase
      .from('picks')
      .select('*, games(*)')
      .eq('user_id', userId)
      .eq('week', selectedWeekHistory);

    setUserPicks(data || []);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) return;

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setAvatarUrl(data.publicUrl);
      setMessage({ type: 'success', text: 'Image uploaded!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          team_name: teamName.trim(),
          avatar_url: avatarUrl,
        })
        .eq('id', userId);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Profile updated!' });
      onProfileUpdated();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const initials = `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase() || 'PS';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold"
        >
          ✕
        </button>

        {/* Sub Navigation */}
        <div className="flex gap-2 mb-4 border-b border-gray-800 pb-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`text-xs font-bold px-3 py-1 rounded-lg ${
              activeTab === 'profile' ? 'bg-emerald-600 text-white' : 'text-gray-400'
            }`}
          >
            Profile Info
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`text-xs font-bold px-3 py-1 rounded-lg ${
              activeTab === 'history' ? 'bg-emerald-600 text-white' : 'text-gray-400'
            }`}
          >
            Pick History
          </button>
        </div>

        {message && (
          <div className="p-2 rounded text-xs mb-3 bg-emerald-950 text-emerald-200 border border-emerald-500/50">
            {message.text}
          </div>
        )}

        {activeTab === 'profile' ? (
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-600 to-indigo-600 border-2 border-emerald-500 flex items-center justify-center overflow-hidden font-bold text-lg text-white">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <label className="cursor-pointer text-[11px] text-emerald-400 font-semibold hover:underline">
                {uploading ? 'Uploading...' : 'Change Profile Picture'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Team Name</label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-sm mt-2"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-gray-300">Select Week</span>
              <select
                value={selectedWeekHistory}
                onChange={(e) => setSelectedWeekHistory(Number(e.target.value))}
                className="bg-gray-800 text-xs text-white p-1 rounded border border-gray-700"
              >
                {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>
                    Week {w}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
              {userPicks.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No picks for Week {selectedWeekHistory}</p>
              ) : (
                userPicks.map((pick) => (
                  <div key={pick.id} className="bg-gray-800/80 p-2.5 rounded-lg flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-white">{pick.selected_team}</span>
                      {pick.is_lock && <span className="ml-2 text-[10px] text-amber-400 font-bold">🔒 LOCK</span>}
                    </div>
                    <span className="font-mono font-bold text-emerald-400">+{pick.points_awarded || 0} pts</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

/* Scale control snippet for ProfileModal.tsx */
const [zoom, setZoom] = useState(1);

<div className="w-20 h-20 rounded-full border-2 border-emerald-500 overflow-hidden flex items-center justify-center">
  <img 
    src={avatarUrl} 
    style={{ transform: `scale(${zoom})` }}
    className="w-full h-full object-cover transition-transform" 
  />
</div>

<div className="flex items-center gap-2 mt-2">
  <span className="text-[10px] text-gray-400">Zoom:</span>
  <input 
    type="range" 
    min="1" 
    max="2.5" 
    step="0.1" 
    value={zoom} 
    onChange={(e) => setZoom(parseFloat(e.target.value))} 
    className="w-24 accent-emerald-500"
  />
</div>
  
}
