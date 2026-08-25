'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import PicksTab from '@/components/Tabs/PicksTab';
import LeaderboardTab from '@/components/Tabs/LeaderboardTab';
import RulesTab from '@/components/Tabs/RulesTab';
import AdminTab from '@/components/Tabs/AdminTab';
import PickAlertBanner from '@/components/Shared/PickAlertBanner';
import AuthModal from '@/components/Modals/AuthModal';
import ProfileModal from '@/components/Modals/ProfileModal';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'picks' | 'leaderboard' | 'rules' | 'admin'>('picks');
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [userPicksCount, setUserPicksCount] = useState(0);
  const [hasLock, setHasLock] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadProfile(session.user.id);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) loadProfile(session.user.id);
      else setProfile(null);
    });

    fetchCurrentWeek();
    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
  };

const fetchCurrentWeek = async () => {
  const now = new Date().toISOString();
  
  // Find the earliest game that hasn't finished yet, or default to 1
  const { data } = await supabase
    .from('games')
    .select('week')
    .gte('kickoff_time', now)
    .order('kickoff_time', { ascending: true })
    .limit(1);

  if (data && data.length > 0) {
    setCurrentWeek(data[0].week);
  } else {
    setCurrentWeek(1);
  }
};

  const checkUserPicksStatus = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('picks')
      .select('is_lock')
      .eq('user_id', session.user.id)
      .eq('week', currentWeek);

    const picks = data || [];
    setUserPicksCount(picks.length);
    setHasLock(picks.some((p) => p.is_lock));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <span className="text-gray-400 text-sm">Loading Pick Six...</span>
      </div>
    );
  }

  const initials = profile
    ? `${profile.first_name?.slice(0, 1) || ''}${profile.last_name?.slice(0, 1) || ''}`.toUpperCase()
    : 'PS';

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col font-sans">
      {/* Header with User Avatar Dropdown */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-30 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏈</span>
            <h1 className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              PICK SIX
            </h1>
          </div>

          {session && profile ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-2.5 py-1 rounded-full border border-gray-700 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-600 to-indigo-600 flex items-center justify-center font-bold text-[10px] text-white overflow-hidden">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <span className="text-xs font-bold text-gray-200">{profile.first_name}</span>
              </button>

              {/* User Menu Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl py-1 z-50">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      setIsProfileOpen(true);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={() => supabase.auth.signOut()}
                    className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-gray-800"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </header>

      {session && activeTab !== 'rules' && activeTab !== 'admin' && (
        <PickAlertBanner
          currentWeek={currentWeek}
          picksCount={userPicksCount}
          hasLock={hasLock}
          onNavigateToPicks={() => setActiveTab('picks')}
        />
      )}

      <div className="flex-1">
        {session ? (
          activeTab === 'picks' ? (
            <PicksTab userId={session.user.id} currentWeek={currentWeek} />
          ) : activeTab === 'leaderboard' ? (
            <LeaderboardTab />
          ) : activeTab === 'rules' ? (
            <RulesTab />
          ) : (
            <AdminTab />
          )
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Welcome to Pick Six</h2>
            <p className="text-sm text-gray-400 max-w-sm mb-6">
              Pick 6 NFL winners each week, set your Lock of the Week, and compete on the leaderboard.
            </p>
          </div>
        )}
      </div>

      <AuthModal isOpen={!session} onSuccess={() => checkUserPicksStatus()} />
      {session && (
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          userId={session.user.id}
          onProfileUpdated={() => loadProfile(session.user.id)}
        />
      )}

      {/* Bottom Navigation */}
      {session && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 px-6 py-2">
          <div className="max-w-md mx-auto flex items-center justify-around">
            <button
              onClick={() => setActiveTab('picks')}
              className={`flex flex-col items-center gap-1 ${
                activeTab === 'picks' ? 'text-emerald-400 font-bold' : 'text-gray-500'
              }`}
            >
              <span className="text-lg">🎯</span>
              <span className="text-[11px]">Picks</span>
            </button>

            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex flex-col items-center gap-1 ${
                activeTab === 'leaderboard' ? 'text-emerald-400 font-bold' : 'text-gray-500'
              }`}
            >
              <span className="text-lg">🏆</span>
              <span className="text-[11px]">Standings</span>
            </button>

            <button
              onClick={() => setActiveTab('rules')}
              className={`flex flex-col items-center gap-1 ${
                activeTab === 'rules' ? 'text-emerald-400 font-bold' : 'text-gray-500'
              }`}
            >
              <span className="text-lg">📖</span>
              <span className="text-[11px]">Rules</span>
            </button>

            {profile?.is_admin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex flex-col items-center gap-1 ${
                  activeTab === 'admin' ? 'text-emerald-400 font-bold' : 'text-gray-500'
                }`}
              >
                <span className="text-lg">🛠️</span>
                <span className="text-[11px]">Admin</span>
              </button>
            )}
          </div>
        </nav>
      )}
    </main>
  );
}
