import { NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { scoresSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
  }
  const rate = checkRateLimit("rounds:create");
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const prisma = getPrisma();
    const body = await req.json().catch(() => null);
    const scores = scoresSchema.safeParse(body?.scores ?? [null, null, null, null]);
    if (!scores.success) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: { matchPlayers: true },
    });

    if (!match) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (match.status !== "ACTIVE") {
      return NextResponse.json({ error: "match_closed" }, { status: 400 });
    }

    const roundIndex = await prisma.round.count({ where: { matchId: params.id } });

    const createScores = match.matchPlayers
      .slice()
      .sort((a, b) => a.seat - b.seat)
      .map((player, seat) => {
        const points = scores.data[seat];
        if (points === null || points === undefined) return null;
        return {
          matchId: params.id,
          playerId: player.playerId,
          seat: player.seat,
          points,
        };
      })
      .filter(Boolean) as Array<{ matchId: string; playerId: string; seat: number; points: number }>;

    const round = await prisma.round.create({
      data: {
        matchId: params.id,
        roundIndex,
        scores: createScores.length ? { create: createScores } : undefined,
      },
    });

    return NextResponse.json({ roundId: round.id });
  } catch (error) {
    console.error("db_error", { route: "matches:id:rounds:POST", error });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
