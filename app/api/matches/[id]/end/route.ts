import { NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
  }
  const rate = checkRateLimit("matches:end");
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const prisma = getPrisma();
    const match = await prisma.match.update({
      where: { id: params.id },
      data: { status: "FINISHED", endedAt: new Date() },
    });

    return NextResponse.json({ id: match.id, status: match.status });
  } catch (error) {
    console.error("db_error", { route: "matches:id:end:POST", error });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
