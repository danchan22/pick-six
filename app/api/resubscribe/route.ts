import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return new NextResponse('Invalid request: Missing user ID', { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ email_notifications: true })
    .eq('id', userId);

  if (error) {
    return new NextResponse('Failed to update email preferences', { status: 500 });
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Resubscribed - Pick Six</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style="background-color: #030712; color: #ffffff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box;">
        <div style="background-color: #111827; border: 1px solid #1f2937; padding: 32px; border-radius: 16px; max-width: 400px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <div style="font-size: 40px; margin-bottom: 12px;">🔔</div>
          <h1 style="font-size: 20px; font-weight: 800; margin-bottom: 8px; color: #10b981;">Subscribed!</h1>
          <p style="color: #9ca3af; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
            You are back on the list and will receive weekly pick reminder emails for Pick Six.
          </p>
          <a href="https://picksixleague.com" style="background-color: #059669; color: #ffffff; text-decoration: none; font-weight: bold; padding: 10px 20px; border-radius: 8px; display: inline-block; font-size: 14px;">
            Return to App
          </a>
        </div>
      </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
