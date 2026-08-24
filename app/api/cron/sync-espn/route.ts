import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  try {
    // 1. Verify Secret Key (for cron security)
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const authHeader = request.headers.get('authorization');

    if (
      process.env.CRON_SECRET &&
      secret !== process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch current NFL scoreboard from ESPN Public API
    const espnRes = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
      { cache: 'no-store' }
    );
    const espnData = await espnRes.json();

    const weekNumber = espnData.week?.number;
    const seasonYear = espnData.season?.year;
    const events = espnData.events || [];

    if (!events.length) {
      return NextResponse.json({ message: 'No events found' });
    }

    // 3. Map ESPN events to Supabase games structure
    const gamesToUpsert = events.map((event: any) => {
      const competition = event.competitions[0];
      const home = competition.competitors.find((c: any) => c.homeAway === 'home');
      const away = competition.competitors.find((c: any) => c.homeAway === 'away');
      const statusState = event.status.type.state;
      const statusName = event.status.type.name;

      let gameStatus = statusState;
      if (statusName === 'STATUS_POSTPONED') gameStatus = 'postponed';
      if (statusName === 'STATUS_CANCELED') gameStatus = 'canceled';

      let winnerTeam = null;
      if (gameStatus === 'post') {
        if (parseInt(home.score) > parseInt(away.score)) winnerTeam = home.team.displayName;
        else if (parseInt(away.score) > parseInt(home.score)) winnerTeam = away.team.displayName;
        else winnerTeam = 'TIE';
      }

      return {
        id: event.id,
        season_year: seasonYear,
        week: weekNumber,
        home_team: home.team.displayName,
        away_team: away.team.displayName,
        home_score: parseInt(home.score || 0),
        away_score: parseInt(away.score || 0),
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

    return NextResponse.json({
      success: true,
      syncedGames: gamesToUpsert.length,
      week: weekNumber,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
