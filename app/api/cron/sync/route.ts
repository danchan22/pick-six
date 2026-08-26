import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const seasonYear = 2026;
  let totalImported = 0;

  try {
    for (let w = 1; w <= 18; w++) {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${seasonYear}&seasontype=2&week=${w}`,
        { cache: 'no-store' }
      );

      if (!res.ok) continue;

      const data = await res.json();
      const events = data.events || [];

      if (events.length > 0) {
        const gamesToUpsert = events.map((event: any) => {
          const competition = event.competitions[0];
          const home = competition.competitors.find((c: any) => c.homeAway === 'home');
          const away = competition.competitors.find((c: any) => c.homeAway === 'away');

          const homeRecordObj = home.records?.find((r: any) => r.type === 'total') || home.records?.[0];
          const awayRecordObj = away.records?.find((r: any) => r.type === 'total') || away.records?.[0];

          const statusState = event.status?.type?.state || 'pre';
          let winnerTeam = null;

          if (statusState === 'post') {
            const homeScore = parseInt(home.score || 0);
            const awayScore = parseInt(away.score || 0);
            if (homeScore > awayScore) winnerTeam = home.team.displayName;
            else if (awayScore > homeScore) winnerTeam = away.team.displayName;
            else winnerTeam = 'TIE';
          }

          return {
            id: event.id,
            season_year: seasonYear,
            week: w,
            home_team: home.team.displayName,
            away_team: away.team.displayName,
            home_record: homeRecordObj?.summary || '0-0',
            away_record: awayRecordObj?.summary || '0-0',
            home_score: parseInt(home.score || 0),
            away_score: parseInt(away.score || 0),
            kickoff_time: event.date,
            status: statusState,
            winner_team: winnerTeam,
            updated_at: new Date().toISOString(),
          };
        });

        const { error } = await supabaseAdmin
          .from('games')
          .upsert(gamesToUpsert, { onConflict: 'id' });

        if (!error) totalImported += gamesToUpsert.length;
      }
    }

    return NextResponse.json({ success: true, message: `Synced ${totalImported} games.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
