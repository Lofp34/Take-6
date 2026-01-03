import { NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { playersSchema, scoresSchema, targetSchema } from "@/lib/validation";
import { upsertPlayersByName } from "@/lib/db-helpers";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
  }
  const rate = checkRateLimit("matches:import", 10, 60_000);
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  try {
    const prisma = getPrisma();
    const body = await req.json().catch(() => null);
    const games = Array.isArray(body?.games) ? body.games : [];

    for (const game of games) {
      const players = playersSchema.safeParse(game?.players);
      const target = targetSchema.safeParse(game?.target ?? 66);
      const rounds = Array.isArray(game?.rounds) ? game.rounds : [];
      const endedAt = game?.endedAt ? new Date(game.endedAt) : new Date();

      if (!players.success || !target.success) {
        continue;
      }

      const createdPlayers = await upsertPlayersByName(players.data);

      const match = await prisma.match.create({
        data: {
          target: target.data,
          playerCount: createdPlayers.length,
          status: "FINISHED",
          endedAt,
          matchPlayers: {
            create: createdPlayers.map((player, seat) => ({
              playerId: player.id,
              seat,
              displayName: players.data[seat],
            })),
          },
        },
      });

      for (const [roundIndex, round] of rounds.entries()) {
        const parsed = scoresSchema.safeParse(round);
        const scores = parsed.success ? parsed.data : [null, null, null, null];

        const roundRow = await prisma.round.create({
          data: { matchId: match.id, roundIndex },
        });

        const createScores = createdPlayers
          .map((player, seat) => {
            const points = scores[seat];
            if (points === null || points === undefined) return null;
            return {
              roundId: roundRow.id,
              matchId: match.id,
              playerId: player.id,
              seat,
              points,
            };
          })
          .filter(Boolean) as Array<{
          roundId: string;
          matchId: string;
          playerId: string;
          seat: number;
          points: number;
        }>;

        if (createScores.length) {
          await prisma.score.createMany({ data: createScores });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("db_error", { route: "import:POST", error });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
