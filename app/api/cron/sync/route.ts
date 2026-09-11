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
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2`,
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
    const statusName = event.status?.type?.name;
    const statusDetail = event.status?.type?.detail || '';
    const isCompleted = event.status?.type?.completed || statusState === 'post' || statusName === 'STATUS_FINAL';

    let gameStatus = statusState;
    if (isCompleted) gameStatus = 'post';

    let winnerTeam = null;

    if (gameStatus === 'post') {
      const homeScore = parseInt(home.score || 0, 10);
      const awayScore = parseInt(away.score || 0, 10);
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
      home_score: parseInt(home.score || 0, 10),
      away_score: parseInt(away.score || 0, 10),
      kickoff_time: event.date,
      status: gameStatus,
      game_detail: statusDetail,
      winner_team: winnerTeam,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabaseAdmin
    .from('games')
    .upsert(gamesToUpsert, { onConflict: 'id' });

  if (error) return 0;

  // Score picks for finished games
  const completedGameIds = gamesToUpsert
    .filter((g: any) => g.status === 'post' || g.status === 'canceled')
    .map((g: any) => g.id);

  if (completedGameIds.length > 0) {
    const { data: picksToScore } = await supabaseAdmin
      .from('picks')
      .select('*, games(*)')
      .in('game_id', completedGameIds);

    if (picksToScore && picksToScore.length > 0) {
      for (const pick of picksToScore) {
        const game = pick.games;
        let points = 0.0;

        if (game.status === 'canceled') {
          points = 0.0;
        } else if (game.status === 'post') {
          const isWin = pick.selected_team === game.winner_team;

          if (pick.is_lock) {
            // Lock of the Week: Win (+2), Tie (-1), Loss (-1)
            points = isWin ? 2.0 : -1.0;
          } else {
            // Standard Pick: Win (+1), Tie (+0.5), Loss (0)
            if (isWin) points = 1.0;
            else if (game.winner_team === 'TIE') points = 0.5;
            else points = 0.0;
          }
        }

        await supabaseAdmin
          .from('picks')
          .update({ points_awarded: points })
          .eq('id', pick.id);
      }
    }
  }

  return gamesToUpsert.length;
}
