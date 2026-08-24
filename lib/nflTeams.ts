export const NFL_TEAMS: Record<string, { name: string; abbr: string }> = {
  'Arizona Cardinals': { name: 'Cardinals', abbr: 'ari' },
  'Atlanta Falcons': { name: 'Falcons', abbr: 'atl' },
  'Baltimore Ravens': { name: 'Ravens', abbr: 'bal' },
  'Buffalo Bills': { name: 'Bills', abbr: 'buf' },
  'Carolina Panthers': { name: 'Panthers', abbr: 'car' },
  'Chicago Bears': { name: 'Bears', abbr: 'chi' },
  'Cincinnati Bengals': { name: 'Bengals', abbr: 'cin' },
  'Cleveland Browns': { name: 'Browns', abbr: 'cle' },
  'Dallas Cowboys': { name: 'Cowboys', abbr: 'dal' },
  'Denver Broncos': { name: 'Broncos', abbr: 'den' },
  'Detroit Lions': { name: 'Lions', abbr: 'det' },
  'Green Bay Packers': { name: 'Packers', abbr: 'gb' },
  'Houston Texans': { name: 'Texans', abbr: 'hou' },
  'Indianapolis Colts': { name: 'Colts', abbr: 'ind' },
  'Jacksonville Jaguars': { name: 'Jaguars', abbr: 'jax' },
  'Kansas City Chiefs': { name: 'Chiefs', abbr: 'kc' },
  'Las Vegas Raiders': { name: 'Raiders', abbr: 'lv' },
  'Los Angeles Chargers': { name: 'Chargers', abbr: 'lac' },
  'Los Angeles Rams': { name: 'Rams', abbr: 'lar' },
  'Miami Dolphins': { name: 'Dolphins', abbr: 'mia' },
  'Minnesota Vikings': { name: 'Vikings', abbr: 'min' },
  'New England Patriots': { name: 'Patriots', abbr: 'ne' },
  'New Orleans Saints': { name: 'Saints', abbr: 'no' },
  'New York Giants': { name: 'Giants', abbr: 'nyg' },
  'New York Jets': { name: 'Jets', abbr: 'nyj' },
  'Philadelphia Eagles': { name: 'Eagles', abbr: 'phi' },
  'Pittsburgh Steelers': { name: 'Steelers', abbr: 'pit' },
  'San Francisco 49ers': { name: '49ers', abbr: 'sf' },
  'Seattle Seahawks': { name: 'Seahawks', abbr: 'sea' },
  'Tampa Bay Buccaneers': { name: 'Buccaneers', abbr: 'tb' },
  'Tennessee Titans': { name: 'Titans', abbr: 'ten' },
  'Washington Commanders': { name: 'Commanders', abbr: 'was' },
};

export function getTeamNickname(fullTeamName: string): string {
  return NFL_TEAMS[fullTeamName]?.name || fullTeamName;
}

export function getTeamLogoUrl(fullTeamName: string): string {
  const abbr = NFL_TEAMS[fullTeamName]?.abbr;
  if (!abbr) return 'https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/nfl.png';
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr}.png`;
}
