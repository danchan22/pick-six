import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  try {
    // 1. Verify Secret Key (for cron security)
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const targetWeek = searchParams.get('week');
    const authHeader = request.headers.get('authorization');

    if (
      process.env.CRON_SECRET &&
      secret !== process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch regular season (seasontype=2) scoreboard from ESPN
    let espnUrl =
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2';
    if (targetWeek) {
      espnUrl += `&week=${targetWeek}`;
    }

    const espnRes = await fetch(espnUrl, { cache: 'no-store' });
    const espnData = await espnRes.json();

    const weekNumber = targetWeek
      ? parseInt(targetWeek, 10)
      : espnData.week?.number || 1;
    const seasonYear = espnData.season?.year || 2026;
    const events = espnData.events || [];

    if (!events.length) {
      return NextResponse.json({ message: 'No events found for this week' });
    }

    // 3. Map ESPN events to Supabase games structure
    const gamesToUpsert = events.map((event: any) => {
      const competition = event.competitions[0];
      const home = competition.competitors.find((c: any) => c.homeAway === 'home');
      const away = competition.competitors.find((c: any) => c.homeAway === 'away');
      const statusState = event.status?.type?.state;
      const statusName = event.status?.type?.name;
      const isCompleted =
        event.status?.type?.completed ||
        statusState === 'post' ||
        statusName === 'STATUS_FINAL';

      let gameStatus = statusState;
      if (isCompleted) gameStatus = 'post';
      if (statusName === 'STATUS_POSTPONED') gameStatus = 'postponed';
      if (statusName === 'STATUS_CANCELED') gameStatus = 'canceled';

      // Extract records
      const homeRecordObj = home.records?.find(
        (r: any) => r.type === 'total' || r.name === 'overall'
      );
      const awayRecordObj = away.records?.find(
        (r: any) => r.type === 'total' || r.name === 'overall'
      );
      const homeRecordStr = homeRecordObj?.summary || home.record || '0-0';
      const awayRecordStr = awayRecordObj?.summary || away.record || '0-0';

      const homeScoreNum = parseInt(home.score ?? '0', 10);
      const awayScoreNum = parseInt(away.score ?? '0', 10);

      let winnerTeam = null;
      if (gameStatus === 'post') {
        if (homeScoreNum > awayScoreNum) winnerTeam = home.team.displayName;
        else if (awayScoreNum > homeScoreNum) winnerTeam = away.team.displayName;
        else winnerTeam = 'TIE';
      }

      return {
        id: event.id,
        season_year: seasonYear,
        week: weekNumber,
        home_team: home.team.displayName,
        away_team: away.team.displayName,
        home_record: homeRecordStr,
        away_record: awayRecordStr,
        home_score: homeScoreNum,
        away_score: awayScoreNum,
        kickoff_time: event.date,
        status: gameStatus,
        winner_team: winnerTeam,
        updated_at: new Date().toISOString(),
      };
    });

    // 4. Upsert games into Supabase
    const { error: gamesError } = await supabaseAdmin
      .from('games')
      .upsert(gamesToUpsert, { onConflict: 'id' });

    if (gamesError) throw gamesError;

    // 5. Fetch all picks for finished or canceled games to update scoring
    const completedGameIds = gamesToUpsert
      .filter((g: any) => g.status === 'post' || g.status === 'canceled')
      .map((g: any) => g.id);

    let scoredPicksCount = 0;

    if (completedGameIds.length > 0) {
      const { data: picksToScore } = await supabaseAdmin
        .from('picks')
        .select('*, games(*)')
        .in('game_id', completedGameIds);

      if (picksToScore && picksToScore.length > 0) {
        scoredPicksCount = picksToScore.length;
        for (const pick of picksToScore) {
          const game = pick.games;
          let points = 0.0;

          if (game.status === 'canceled') {
            points = 0.0;
          } else if (game.status === 'post') {
            const isWin = pick.selected_team === game.winner_team;

            if (pick.is_lock) {
              points = isWin ? 2.0 : -1.0;
            } else {
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

    return NextResponse.json({
      success: true,
      week: weekNumber,
      syncedGames: gamesToUpsert.length,
      scoredPicks: scoredPicksCount,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
