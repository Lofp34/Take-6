import { NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { scoresSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";

function hasReachedTarget(
  totals: Array<{ points: number }>,
  target: number
) {
  return totals.some((t) => t.points >= target);
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string; roundId: string } }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
  }
  const rate = checkRateLimit("rounds:update");
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const prisma = getPrisma();
    const body = await req.json().catch(() => null);
    const scores = scoresSchema.safeParse(body?.scores);
    if (!scores.success) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }
    const finalizeRound = body?.finalizeRound === true;

    const round = await prisma.round.findUnique({
      where: { id: params.roundId },
    });
    if (!round || round.matchId !== params.id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const match = await prisma.match.findUnique({
      where: { id: params.id },
      select: { status: true, target: true, playerCount: true },
    });
    if (!match) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const matchPlayers = await prisma.matchPlayer.findMany({
      where: { matchId: params.id },
      orderBy: { seat: "asc" },
    });

    const ops = matchPlayers.map((player, seat) => {
      const points = scores.data[seat];
      if (points === null || points === undefined) {
        return prisma.score.deleteMany({
          where: { roundId: params.roundId, playerId: player.playerId },
        });
      }
      return prisma.score.upsert({
        where: {
          roundId_playerId: { roundId: params.roundId, playerId: player.playerId },
        },
        update: { points },
        create: {
          roundId: params.roundId,
          matchId: params.id,
          playerId: player.playerId,
          seat: player.seat,
          points,
        },
      });
    });

    await prisma.$transaction(ops);

    let matchEnded = false;
    let endedAt: Date | null = null;
    if (match.status === "ACTIVE" && finalizeRound) {
      const roundScoreCount = await prisma.score.count({
        where: { roundId: params.roundId },
      });
      if (roundScoreCount === match.playerCount) {
        const totals = await prisma.score.groupBy({
          by: ["playerId"],
          where: { matchId: params.id },
          _sum: { points: true },
        });
        const normalizedTotals = totals.map((row) => ({
          points: row._sum.points ?? 0,
        }));
        if (hasReachedTarget(normalizedTotals, match.target)) {
          const endedAtValue = new Date();
          const update = await prisma.match.updateMany({
            where: { id: params.id, status: "ACTIVE" },
            data: { status: "FINISHED", endedAt: endedAtValue },
          });
          if (update.count > 0) {
            matchEnded = true;
            endedAt = endedAtValue;
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      matchEnded,
      endedAt: endedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("db_error", { route: "matches:id:rounds:id:PUT", error });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
