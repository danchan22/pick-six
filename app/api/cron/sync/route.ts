import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  const fullSeason = searchParams.get('full') === 'true';

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const seasonYear = 2026;
  let totalImported = 0;

  try {
    if (fullSeason) {
      // Full 18-week sweep (Run on Tuesdays/Admin sync)
      for (let w = 1; w <= 18; w++) {
        const res = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${seasonYear}&seasontype=2&week=${w}`,
          { cache: 'no-store' }
        );
        if (!res.ok) continue;
        const data = await res.json();
        totalImported += await upsertGames(data.events || [], w, seasonYear);
      }
    } else {
      // Fast live scoreboard sync (Only fetches active week in ~300ms)
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`,
        { cache: 'no-store' }
      );

      if (res.ok) {
        const data = await res.json();
        const activeWeek = data.week?.number || 1;
        totalImported += await upsertGames(data.events || [], activeWeek, seasonYear);
      }
    }

    return NextResponse.json({
      success: true,
      mode: fullSeason ? 'full_season' : 'live_scoreboard',
      importedGames: totalImported,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function upsertGames(events: any[], weekNum: number, seasonYear: number) {
  if (!events || events.length === 0) return 0;

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
      week: weekNum,
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

  return error ? 0 : gamesToUpsert.length;
}
