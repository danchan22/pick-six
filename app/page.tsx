'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import PicksTab from '@/components/Tabs/PicksTab';
import LeaderboardTab from '@/components/Tabs/LeaderboardTab';
import RulesTab from '@/components/Tabs/RulesTab'; // <-- Added Import
import PickAlertBanner from '@/components/Shared/PickAlertBanner';
import AuthModal from '@/components/Modals/AuthModal';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'picks' | 'leaderboard' | 'rules'>('picks'); // <-- Updated State
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [userPicksCount, setUserPicksCount] = useState(0);
  const [hasLock, setHasLock] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    fetchCurrentWeek();

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      checkUserPicksStatus();
    }
  }, [session, currentWeek]);

  const fetchCurrentWeek = async () => {
    const { data } = await supabase
      .from('games')
      .select('week')
      .order('kickoff_time', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setCurrentWeek(data[0].week);
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

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Top Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-30 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏈</span>
            <h1 className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              PICK SIX
            </h1>
          </div>

          {session ? (
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-800 rounded-lg px-2.5 py-1"
            >
              Sign Out
            </button>
          ) : null}
        </div>
      </header>

      {/* Alert Banner if picks are missing */}
      {session && activeTab !== 'rules' && (
        <PickAlertBanner
          currentWeek={currentWeek}
          picksCount={userPicksCount}
          hasLock={hasLock}
          onNavigateToPicks={() => setActiveTab('picks')}
        />
      )}

      {/* Dynamic Tab Content */}
      <div className="flex-1">
        {session ? (
          activeTab === 'picks' ? (
            <PicksTab userId={session.user.id} currentWeek={currentWeek} />
          ) : activeTab === 'leaderboard' ? (
            <LeaderboardTab />
          ) : (
            <RulesTab /> // <-- Added View Rendering
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

      {/* Authentication Modal */}
      <AuthModal isOpen={!session} onSuccess={() => checkUserPicksStatus()} />

      {/* Mobile-Optimized Bottom Navigation */}
      {session && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 px-6 py-2">
          <div className="max-w-md mx-auto flex items-center justify-around">
            <button
              onClick={() => setActiveTab('picks')}
              className={`flex flex-col items-center gap-1 transition-colors ${
                activeTab === 'picks' ? 'text-emerald-400 font-bold' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="text-lg">🎯</span>
              <span className="text-[11px]">Picks</span>
            </button>

            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex flex-col items-center gap-1 transition-colors ${
                activeTab === 'leaderboard' ? 'text-emerald-400 font-bold' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="text-lg">🏆</span>
              <span className="text-[11px]">Standings</span>
            </button>

            {/* Added Navigation Item */}
            <button
              onClick={() => setActiveTab('rules')}
              className={`flex flex-col items-center gap-1 transition-colors ${
                activeTab === 'rules' ? 'text-emerald-400 font-bold' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="text-lg">📖</span>
              <span className="text-[11px]">Rules</span>
            </button>
          </div>
        </nav>
      )}
    </main>
  );
}
