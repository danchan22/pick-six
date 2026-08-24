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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (isOpen && userId) {
      loadUserProfile();
    }
  }, [isOpen, userId]);

  const loadUserProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('first_name, last_name, team_name, avatar_url')
      .eq('id', userId)
      .single();

    if (data && !error) {
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setTeamName(data.team_name || '');
      setAvatarUrl(data.avatar_url || null);
    }
  };

  // Upload Avatar Image to Supabase Storage Bucket ('avatars')
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setMessage(null);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Please select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/${Math.random()}.${fileExt}`;

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get Public URL for uploaded image
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

      setAvatarUrl(data.publicUrl);
      setMessage({ type: 'success', text: 'Image uploaded! Click Save to apply changes.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error uploading image.' });
    } finally {
      setUploading(false);
    }
  };

  // Save Profile Details
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

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

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      onProfileUpdated();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold text-white text-center mb-1">Edit Team Profile</h2>
        <p className="text-xs text-gray-400 text-center mb-6">
          Update your avatar and team branding
        </p>

        {/* Success/Error Feedback */}
        {message && (
          <div
            className={`p-3 rounded-lg text-xs mb-4 border ${
              message.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                : 'bg-red-950/80 border-red-500/50 text-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
          {/* Avatar Preview & Upload Button */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-20 h-20 rounded-full bg-gray-800 border-2 border-emerald-500/60 overflow-hidden flex items-center justify-center shadow-lg">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Team Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-gray-400">
                  {teamName ? teamName.slice(0, 2).toUpperCase() : 'PS'}
                </span>
              )}
            </div>

            <label className="cursor-pointer bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-700 transition-colors">
              {uploading ? 'Uploading...' : 'Upload Team Picture'}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>

          {/* Form Fields */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-400 mb-1 block">
                Team Name
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-gray-400 mb-1 block">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 mb-1 block">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={saving || uploading}
            className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg text-sm transition-colors shadow-lg shadow-emerald-950"
          >
            {saving ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
