import { NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { playersSchema } from "@/lib/validation";
import { upsertPlayersByName } from "@/lib/db-helpers";
import { checkRateLimit } from "@/lib/rate-limit";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
  }
  const rate = checkRateLimit("matches:players");
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const prisma = getPrisma();
    const body = await req.json().catch(() => null);
    const players = playersSchema.safeParse(body?.players);
    if (!players.success) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const updatedPlayers = await upsertPlayersByName(players.data);

    await prisma.$transaction(
      updatedPlayers.map((player, seat) =>
        prisma.matchPlayer.update({
          where: { matchId_seat: { matchId: params.id, seat } },
          data: {
            playerId: player.id,
            displayName: players.data[seat],
          },
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("db_error", { route: "matches:id:players:PUT", error });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
