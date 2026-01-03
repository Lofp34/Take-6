export function totalsFromRounds(rounds: Array<Array<number | null>>) {
  return [0, 1, 2, 3].map((i) =>
    rounds.reduce((sum, r) => sum + (typeof r?.[i] === "number" ? (r[i] as number) : 0), 0)
  );
}

export function ranksFromTotals(totals: number[]) {
  return totals.map((t) => 1 + totals.filter((x) => x < t).length);
}

export function computePlayerSummary(
  games: Array<{ totals: number[]; endedAt: string }>,
  playerIndex: number,
  lastN = 5
) {
  const totals = games.map((g) => g.totals[playerIndex] ?? 0);
  const totalMatches = totals.length;
  const totalPoints = totals.reduce((a, b) => a + b, 0);
  const avgPoints = totalMatches ? Math.round((totalPoints / totalMatches) * 10) / 10 : 0;
  const bestScore = totalMatches ? Math.min(...totals) : 0;
  const worstScore = totalMatches ? Math.max(...totals) : 0;
  const recent = games.slice(0, lastN).map((g) => ({
    endedAt: g.endedAt,
    points: g.totals[playerIndex] ?? 0,
  }));
  return {
    totalMatches,
    avgPoints,
    bestScore,
    worstScore,
    recent,
  };
}
