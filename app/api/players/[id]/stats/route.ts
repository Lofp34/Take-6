import { NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
  }
  try {
    const prisma = getPrisma();
    const { searchParams } = new URL(req.url);
    const lastN = Math.min(Number(searchParams.get("lastN")) || 5, 50);

    const scores = await prisma.score.findMany({
      where: {
        playerId: params.id,
        match: { status: "FINISHED" },
      },
      select: {
        points: true,
        matchId: true,
        match: { select: { endedAt: true } },
      },
    });

    const matchTotals = new Map<string, { points: number; endedAt: Date | null }>();
    for (const score of scores) {
      const existing = matchTotals.get(score.matchId) ?? {
        points: 0,
        endedAt: score.match.endedAt,
      };
      existing.points += score.points ?? 0;
      matchTotals.set(score.matchId, existing);
    }

    const entries = Array.from(matchTotals.values()).sort((a, b) => {
      const aTime = a.endedAt ? new Date(a.endedAt).getTime() : 0;
      const bTime = b.endedAt ? new Date(b.endedAt).getTime() : 0;
      return bTime - aTime;
    });

    const totalMatches = entries.length;
    const totalPoints = entries.reduce((sum, e) => sum + e.points, 0);
    const avgPoints = totalMatches ? Math.round((totalPoints / totalMatches) * 10) / 10 : 0;
    const bestScore = totalMatches ? Math.min(...entries.map((e) => e.points)) : 0;
    const worstScore = totalMatches ? Math.max(...entries.map((e) => e.points)) : 0;

    const recent = entries.slice(0, lastN).map((e) => ({
      points: e.points,
      endedAt: e.endedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({
      totalMatches,
      avgPoints,
      bestScore,
      worstScore,
      recent,
    });
  } catch (error) {
    console.error("db_error", { route: "players:id:stats:GET", error });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
