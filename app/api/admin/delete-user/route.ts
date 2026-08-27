import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // 1. Delete user picks
    await supabaseAdmin.from('picks').delete().eq('user_id', userId);

    // 2. Delete public profile
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    // 3. Delete Supabase Auth account
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      console.warn('Auth user deletion notice:', authError.message);
    }

    return NextResponse.json({ success: true, message: 'User completely removed' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
