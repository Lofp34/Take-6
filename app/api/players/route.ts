import { NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
  }
  try {
    const prisma = getPrisma();
    const players = await prisma.player.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ players });
  } catch (error) {
    console.error("db_error", { route: "players:GET", error });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
