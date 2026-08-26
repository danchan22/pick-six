import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
  }

  try {
    // 1. Determine active week
    const now = new Date().toISOString();
    const { data: activeGames } = await supabaseAdmin
      .from('games')
      .select('week')
      .gte('kickoff_time', now)
      .order('kickoff_time', { ascending: true })
      .limit(1);

    const currentWeek = activeGames?.[0]?.week || 1;
    const requiredPicks = currentWeek === 18 ? 16 : 6;

    // 2. Fetch profiles, auth users (for emails), and picks
    const { data: profiles } = await supabaseAdmin.from('profiles').select('*');
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
    const { data: weekPicks } = await supabaseAdmin
      .from('picks')
      .select('user_id')
      .eq('week', currentWeek);

    if (!profiles || !authData?.users) {
      return NextResponse.json({ message: 'No profiles or auth users found' });
    }

    // Map user ID to email address
    const emailMap: Record<string, string> = {};
    authData.users.forEach((u) => {
      if (u.email) emailMap[u.id] = u.email;
    });

    // Count picks per user
    const userPickCounts: Record<string, number> = {};
    (weekPicks || []).forEach((p) => {
      userPickCounts[p.user_id] = (userPickCounts[p.user_id] || 0) + 1;
    });

    // 3. Filter members who still need to complete picks
    const incompleteUsers = profiles.filter((u) => {
      const count = userPickCounts[u.id] || 0;
      return count < requiredPicks && !!emailMap[u.id];
    });

    let sentCount = 0;

    for (const user of incompleteUsers) {
      const userEmail = emailMap[user.id];
      const userPicksDone = userPickCounts[user.id] || 0;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Pick Six League <onboarding@resend.dev>', // Change to reminders@picksixleague.com once domain DNS verifies
          to: userEmail,
          subject: `🏈 Week ${currentWeek} Pick Reminder!`,
          html: `
            <div style="font-family: sans-serif; background-color: #030712; color: #ffffff; padding: 24px; border-radius: 12px;">
              <h2 style="color: #10b981; margin-bottom: 8px;">Hey ${user.first_name || 'Player'}!</h2>
              <p style="color: #d1d5db; font-size: 14px;">
                You currently have <strong>${userPicksDone} of ${requiredPicks}</strong> picks submitted for <strong>Week ${currentWeek}</strong>.
              </p>
              <p style="color: #9ca3af; font-size: 13px;">
                Don't leave points on the table—games lock at kickoff!
              </p>
              <div style="margin-top: 20px;">
                <a href="https://picksixleague.com" style="background-color: #059669; color: #ffffff; text-decoration: none; font-weight: bold; padding: 10px 20px; border-radius: 8px; display: inline-block;">
                  Make Your Picks Now
                </a>
              </div>
            </div>
          `,
        }),
      });

      sentCount++;
    }

    return NextResponse.json({ success: true, remindersSent: sentCount, week: currentWeek });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
