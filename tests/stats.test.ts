import { describe, expect, it } from "vitest";
import { computePlayerSummary, ranksFromTotals, totalsFromRounds } from "../lib/stats";

describe("stats helpers", () => {
  it("computes totals from rounds with nulls", () => {
    const rounds = [
      [1, null, 3, 4],
      [2, 2, null, 0],
    ];
    expect(totalsFromRounds(rounds)).toEqual([3, 2, 3, 4]);
  });

  it("computes ranks with ties", () => {
    const totals = [10, 5, 10, 2];
    expect(ranksFromTotals(totals)).toEqual([3, 2, 3, 1]);
  });

  it("computes player summary", () => {
    const games = [
      { totals: [10, 5, 12, 7], endedAt: "2024-01-01T10:00:00.000Z" },
      { totals: [8, 6, 9, 11], endedAt: "2024-01-02T10:00:00.000Z" },
    ];
    const summary = computePlayerSummary(games, 1, 1);
    expect(summary.totalMatches).toBe(2);
    expect(summary.avgPoints).toBe(5.5);
    expect(summary.bestScore).toBe(5);
    expect(summary.worstScore).toBe(6);
    expect(summary.recent.length).toBe(1);
  });
});
