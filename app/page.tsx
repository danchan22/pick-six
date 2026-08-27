'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import PicksTab from '@/components/Tabs/PicksTab';
import LeaderboardTab from '@/components/Tabs/LeaderboardTab';
import StatsTab from '@/components/Tabs/StatsTab';
import RulesTab from '@/components/Tabs/RulesTab';
import AdminTab from '@/components/Tabs/AdminTab';
import PickAlertBanner from '@/components/Shared/PickAlertBanner';
import SkeletonLoader from '@/components/Shared/SkeletonLoader';
import AuthModal from '@/components/Modals/AuthModal';
import ProfileModal from '@/components/Modals/ProfileModal';
import PickHistoryModal from '@/components/Modals/PickHistoryModal';
import TeamsAvailableModal from '@/components/Modals/TeamsAvailableModal';
import HelpModal from '@/components/Modals/HelpModal';
import WeeklyRecapModal from '@/components/Modals/WeeklyRecapModal';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'picks' | 'leaderboard' | 'stats' | 'rules' | 'admin'>('picks');
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isTeamsAvailableOpen, setIsTeamsAvailableOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isRecapOpen, setIsRecapOpen] = useState(false);
  const [recapWeek, setRecapWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [userPicksCount, setUserPicksCount] = useState(0);
  const [hasLock, setHasLock] = useState(false);

  useEffect(() => {
    // Explicitly guarantee user menu starts closed
    setUserMenuOpen(false);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadProfile(session.user.id);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserMenuOpen(false);
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

    // Query specifically for regular season games
    const { data } = await supabase
      .from('games')
      .select('week')
      .eq('season_year', 2026)
      .gte('kickoff_time', now)
      .order('kickoff_time', { ascending: true })
      .limit(1);

    const activeW = data && data.length > 0 ? data[0].week : 1;
    setCurrentWeek(activeW);

    // Only trigger auto-recap if regular season is underway (e.g. activeW > 1)
    if (activeW > 1) {
      const prevW = activeW - 1;
      const seenKey = `picksix_recap_seen_week_${prevW}`;
      if (typeof window !== 'undefined' && localStorage.getItem(seenKey) !== 'true') {
        setRecapWeek(prevW);
        setIsRecapOpen(true);
      }
    }
  };

  const handleCloseRecap = () => {
    if (typeof window !== 'undefined' && recapWeek) {
      localStorage.setItem(`picksix_recap_seen_week_${recapWeek}`, 'true');
    }
    setIsRecapOpen(false);
  };

  const handlePicksChanged = (count: number, lockStatus: boolean) => {
    setUserPicksCount(count);
    setHasLock(lockStatus);
  };

  const handleAuthSuccess = (isNewSignUp?: boolean) => {
    if (isNewSignUp) {
      setIsHelpOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <img src="/pick-six-logo.png" alt="Pick Six" className="w-7 h-7 object-contain" />
            <h1 className="font-extrabold text-lg tracking-tight text-white">PICK SIX</h1>
          </div>
        </header>
        <SkeletonLoader />
      </div>
    );
  }

  const initials = profile
    ? `${profile.first_name?.slice(0, 1) || ''}${profile.last_name?.slice(0, 1) || ''}`.toUpperCase()
    : 'PS';

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col font-sans">
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-30 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/pick-six-logo.png" alt="Pick Six" className="w-7 h-7 object-contain" />
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
                <span className="text-xs font-bold text-gray-200">
                  {profile.first_name} {profile.championships && '🏆'}
                </span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl py-1 z-50">
                  {currentWeek > 1 && (
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        setRecapWeek(currentWeek - 1);
                        setIsRecapOpen(true);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2.5"
                    >
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Week {currentWeek - 1} Recap</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      setIsHistoryOpen(true);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2.5"
                  >
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
                      <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" />
                      <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" />
                      <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
                    </svg>
                    <span>My Pick History</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      setIsTeamsAvailableOpen(true);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2.5"
                  >
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth="2" />
                      <path d="M9 12l2 2 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Team Pick Frequency</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      setIsHelpOpen(true);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2.5"
                  >
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" strokeWidth="2" />
                      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="12" cy="17" r="1" fill="currentColor" />
                    </svg>
                    <span>Help & How to Play</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      setIsProfileOpen(true);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2.5"
                  >
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="3" strokeWidth="2" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                    </svg>
                    <span>Edit Profile</span>
                  </button>

                  <div className="border-t border-gray-800 my-1" />

                  <button
                    onClick={() => supabase.auth.signOut()}
                    className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-gray-800 flex items-center gap-2.5"
                  >
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </header>

      {session && activeTab !== 'rules' && activeTab !== 'admin' && activeTab !== 'stats' && (
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
            <PicksTab
              userId={session.user.id}
              currentWeek={currentWeek}
              onPicksChanged={handlePicksChanged}
            />
          ) : activeTab === 'leaderboard' ? (
            <LeaderboardTab />
          ) : activeTab === 'stats' ? (
            <StatsTab />
          ) : activeTab === 'rules' ? (
            <RulesTab />
          ) : (
            <AdminTab currentWeek={currentWeek} />
          )
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
            <img src="/pick-six-logo.png" alt="Pick Six Logo" className="w-16 h-16 object-contain mb-3" />
            <h2 className="text-2xl font-bold text-white mb-2">Welcome to Pick Six</h2>
            <p className="text-sm text-gray-400 max-w-sm mb-6">
              Pick 6 NFL winners each week, set your Lock of the Week, and compete on the leaderboard.
            </p>
          </div>
        )}
      </div>

      <AuthModal isOpen={!session} onSuccess={handleAuthSuccess} />

      {session && (
        <>
          <ProfileModal
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            userId={session.user.id}
            onProfileUpdated={() => loadProfile(session.user.id)}
          />

          <PickHistoryModal
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            userId={session.user.id}
            profile={profile}
            currentWeek={currentWeek}
          />

          <TeamsAvailableModal
            isOpen={isTeamsAvailableOpen}
            onClose={() => setIsTeamsAvailableOpen(false)}
            userId={session.user.id}
            profile={profile}
          />

          <HelpModal
            isOpen={isHelpOpen}
            onClose={() => setIsHelpOpen(false)}
          />

          <WeeklyRecapModal
            isOpen={isRecapOpen}
            onClose={handleCloseRecap}
            userId={session.user.id}
            week={recapWeek}
          />
        </>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 px-4 py-2">
        <div className="max-w-md mx-auto flex items-center justify-around">
          <button
            onClick={() => setActiveTab('picks')}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'picks' ? 'text-emerald-400 font-bold' : 'text-gray-400'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth="2" />
              <circle cx="12" cy="12" r="5" strokeWidth="2" />
              <circle cx="12" cy="12" r="1" fill="currentColor" />
            </svg>
            <span className="text-[11px]">Picks</span>
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'leaderboard' ? 'text-emerald-400 font-bold' : 'text-gray-400'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 21h8m-4-4v4M6 4h12s1 0 1 1v3c0 3.314-2.686 6-6 6s-6-2.686-6-6V5c0-1 1-1 1-1z" />
            </svg>
            <span className="text-[11px]">Standings</span>
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'stats' ? 'text-emerald-400 font-bold' : 'text-gray-400'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-[11px]">Stats</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`flex flex-col items-center gap-1 ${
              activeTab === 'rules' ? 'text-emerald-400 font-bold' : 'text-gray-400'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="text-[11px]">Rules</span>
          </button>

          {profile?.is_admin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex flex-col items-center gap-1 ${
                activeTab === 'admin' ? 'text-emerald-400 font-bold' : 'text-gray-400'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-[11px]">Admin</span>
            </button>
          )}
        </div>
      </nav>
    </main>
  );
}
