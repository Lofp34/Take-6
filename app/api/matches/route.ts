import { NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { playersSchema, targetSchema } from "@/lib/validation";
import { upsertPlayersByName } from "@/lib/db-helpers";
import { totalsFromRounds, ranksFromTotals } from "@/lib/stats";
import { checkRateLimit } from "@/lib/rate-limit";

function buildGame(match: {
  id: string;
  endedAt: Date | null;
  target: number;
  matchPlayers: Array<{ seat: number; displayName: string }>;
  rounds: Array<{ roundIndex: number; scores: Array<{ seat: number; points: number | null }> }>;
}) {
  const players = match.matchPlayers
    .slice()
    .sort((a, b) => a.seat - b.seat)
    .map((p) => p.displayName);

  const rounds = match.rounds
    .slice()
    .sort((a, b) => a.roundIndex - b.roundIndex)
    .map((round) => {
      const row = Array(players.length).fill(null) as Array<number | null>;
      round.scores
        .slice()
        .sort((a, b) => a.seat - b.seat)
        .forEach((score) => {
          row[score.seat] = score.points ?? null;
        });
      return row;
    });

  const totals = totalsFromRounds(rounds);
  const ranks = ranksFromTotals(totals);

  return {
    id: match.id,
    endedAt: match.endedAt?.toISOString() ?? null,
    target: match.target,
    players,
    rounds,
    totals,
    ranks,
  };
}

export async function GET(req: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
  }
  try {
    const prisma = getPrisma();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

    const matches = await prisma.match.findMany({
      where: { status: "FINISHED" },
      orderBy: { endedAt: "desc" },
      take: limit,
      include: {
        matchPlayers: true,
        rounds: {
          include: { scores: true },
          orderBy: { roundIndex: "asc" },
        },
      },
    });

    const games = matches.map(buildGame);
    return NextResponse.json({ games });
  } catch (error) {
    console.error("db_error", { route: "matches:GET", error });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
  }
  const rate = checkRateLimit("matches:create");
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const prisma = getPrisma();
    const body = await req.json().catch(() => null);
    const players = playersSchema.safeParse(body?.players);
    const target = targetSchema.safeParse(body?.target ?? 66);

    if (!players.success || !target.success) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const createdPlayers = await upsertPlayersByName(players.data);

    const match = await prisma.match.create({
      data: {
        target: target.data,
        playerCount: createdPlayers.length,
        status: "ACTIVE",
        matchPlayers: {
          create: createdPlayers.map((player, seat) => ({
            playerId: player.id,
            seat,
            displayName: players.data[seat],
          })),
        },
      },
    });

    return NextResponse.json({
      id: match.id,
      target: match.target,
      players: players.data,
      rounds: [],
      roundIds: [],
    });
  } catch (error) {
    console.error("db_error", { route: "matches:POST", error });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
