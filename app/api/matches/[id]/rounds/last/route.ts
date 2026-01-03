import { NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
  }
  const rate = checkRateLimit("rounds:delete");
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const prisma = getPrisma();
    const lastRound = await prisma.round.findFirst({
      where: { matchId: params.id },
      orderBy: { roundIndex: "desc" },
    });

    if (!lastRound) {
      return NextResponse.json({ deleted: false });
    }

    await prisma.round.delete({ where: { id: lastRound.id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("db_error", { route: "matches:id:rounds:last:DELETE", error });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
