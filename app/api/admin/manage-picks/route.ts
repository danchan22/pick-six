import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, userId, gameId, week, team, pickId, isLock } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    if (action === 'select_team') {
      // Check existing pick for game
      const { data: existing } = await supabaseAdmin
        .from('picks')
        .select('*')
        .eq('user_id', userId)
        .eq('game_id', gameId)
        .single();

      if (existing) {
        if (existing.selected_team === team) {
          await supabaseAdmin.from('picks').delete().eq('id', existing.id);
          return NextResponse.json({ success: true, message: 'Removed pick' });
        } else {
          await supabaseAdmin
            .from('picks')
            .update({ selected_team: team })
            .eq('id', existing.id);
          return NextResponse.json({ success: true, message: 'Updated pick' });
        }
      } else {
        // Verify current pick count
        const { data: userPicks } = await supabaseAdmin
          .from('picks')
          .select('is_lock')
          .eq('user_id', userId)
          .eq('week', week);

        const currentCount = userPicks?.length || 0;
        if (week !== 18 && currentCount >= 6) {
          return NextResponse.json({ error: 'User already has 6 picks' }, { status: 400 });
        }

        const hasLock = userPicks?.some((p) => p.is_lock);
        const shouldBeLock = week !== 18 && !hasLock && currentCount === 5;

        await supabaseAdmin.from('picks').insert({
          user_id: userId,
          game_id: gameId,
          week,
          selected_team: team,
          is_lock: shouldBeLock,
        });

        return NextResponse.json({ success: true, message: 'Added pick' });
      }
    } else if (action === 'toggle_lock') {
      if (!isLock) {
        // Clear existing locks for user in this week
        await supabaseAdmin
          .from('picks')
          .update({ is_lock: false })
          .eq('user_id', userId)
          .eq('week', week);
      }

      await supabaseAdmin
        .from('picks')
        .update({ is_lock: !isLock })
        .eq('id', pickId);

      return NextResponse.json({ success: true, message: 'Toggled lock' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
