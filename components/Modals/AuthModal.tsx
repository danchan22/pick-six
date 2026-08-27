'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: (isNewSignUp?: boolean) => void;
}

const DAN_TEAM_NAMES = [
  'Dan is the Best',
  'The Danimals',
  'Dan is the Man',
  'Wow, Dan is So Cool',
  "Dan, Dan, He's Our Man",
  'The Philadelphi-Dans',
  'Dan Dan Dan Dan Dan',
  'I Love Dan',
  '<3 Dan <3',
  'Dan is Cooler Than Me',
  'Dan is My Hero',
  'Dan is Better Than Me at Pick Em',
];

export default function AuthModal({ isOpen, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerateRandomTeamName = () => {
    const randomName = DAN_TEAM_NAMES[Math.floor(Math.random() * DAN_TEAM_NAMES.length)];
    setTeamName(randomName);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}`,
    });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccessMsg('Password reset link sent! Check your email inbox.');
    }
    setLoading(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setErrorMsg(error.message);
      } else {
        onSuccess(false);
      }
    } else {
      const trimmedFirst = firstName.trim();
      const trimmedLast = lastName.trim();
      const trimmedTeam = teamName.trim() || 'Pick Six Competitor';

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: trimmedFirst,
            last_name: trimmedLast,
            team_name: trimmedTeam,
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
      } else if (data.user) {
        await supabase.from('profiles').upsert(
          {
            id: data.user.id,
            first_name: trimmedFirst,
            last_name: trimmedLast,
            team_name: trimmedTeam,
            email_notifications: true,
          },
          { onConflict: 'id' }
        );

        onSuccess(true);
      }
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col gap-4">
        <div className="text-center flex flex-col items-center">
          <img
            src="/pick-six-logo.png"
            alt="Pick Six Logo"
            className="w-14 h-14 object-contain mb-2"
          />
          <h2 className="text-xl font-extrabold text-white">
            {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Join Pick Six' : 'Reset Password'}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {mode === 'forgot'
              ? 'Enter your email to receive a password reset link.'
              : mode === 'signup'
              ? 'Enter your information to sign up'
              : 'Enter your credentials to continue'}
          </p>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-medium">
            {successMsg}
          </div>
        )}

        {mode === 'forgot' ? (
          <form onSubmit={handleResetPassword} className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-xs transition-colors mt-1"
            >
              {loading ? 'Sending Link...' : 'Send Reset Link'}
            </button>
            <button
              type="button"
              onClick={() => setMode('login')}
              className="text-xs text-gray-400 hover:text-white mt-2 text-center"
            >
              ← Back to Sign In
            </button>
          </form>
        ) : (
          <form onSubmit={handleAuth} className="flex flex-col gap-3">
            {mode === 'signup' && (
              <>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] text-gray-400">Team Name</label>
                    <span className="text-[10px] text-emerald-400">You can change this anytime</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="e.g. Gridiron Gurus"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] text-gray-500">Need a suggestion?</span>
                    <button
                      type="button"
                      onClick={handleGenerateRandomTeamName}
                      className="text-[10px] font-bold text-amber-400 hover:text-amber-300 underline"
                    >
                      Generate a Random Team Name
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Last Name</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] text-gray-400">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-[10px] text-emerald-400 hover:underline"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-xs transition-colors mt-2"
            >
              {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>

            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-xs text-gray-400 hover:text-white mt-1 text-center"
            >
              {mode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
