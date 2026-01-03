import { NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { targetSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
  }
  try {
    const prisma = getPrisma();
    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: {
        matchPlayers: true,
        rounds: {
          include: { scores: true },
          orderBy: { roundIndex: "asc" },
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const players = match.matchPlayers
      .slice()
      .sort((a, b) => a.seat - b.seat)
      .map((p) => p.displayName);

    const rounds = match.rounds.map((round) => {
      const row = Array(players.length).fill(null) as Array<number | null>;
      round.scores
        .slice()
        .sort((a, b) => a.seat - b.seat)
        .forEach((score) => {
          row[score.seat] = score.points ?? null;
        });
      return row;
    });

    const roundIds = match.rounds.map((round) => round.id);

    return NextResponse.json({
      id: match.id,
      target: match.target,
      players,
      rounds,
      roundIds,
    });
  } catch (error) {
    console.error("db_error", { route: "matches:id:GET", error });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
  }
  const rate = checkRateLimit("matches:update");
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const prisma = getPrisma();
    const body = await req.json().catch(() => null);
    const target = targetSchema.safeParse(body?.target);
    if (!target.success) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const match = await prisma.match.update({
      where: { id: params.id },
      data: { target: target.data },
    });

    return NextResponse.json({ id: match.id, target: match.target });
  } catch (error) {
    console.error("db_error", { route: "matches:id:PATCH", error });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
  }
  const rate = checkRateLimit("matches:delete");
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const prisma = getPrisma();
    await prisma.match.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("db_error", { route: "matches:id:DELETE", error });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
