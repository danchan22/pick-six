'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ResetPasswordModal({ isOpen, onClose }: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('Password updated successfully!');
      setTimeout(() => {
        onClose();
      }, 1500);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-emerald-500/50 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative text-white flex flex-col gap-4">
        <h2 className="text-lg font-bold text-white">Reset Your Password</h2>
        <p className="text-xs text-gray-400">Please enter your new password below to complete the reset.</p>

        {error && <div className="text-xs text-red-400 bg-red-950/50 p-2.5 rounded-lg border border-red-500/50">{error}</div>}
        {message && <div className="text-xs text-emerald-400 bg-emerald-950/50 p-2.5 rounded-lg border border-emerald-500/50">{message}</div>}

        <form onSubmit={handleUpdatePassword} className="flex flex-col gap-3">
          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-lg disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Save New Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
