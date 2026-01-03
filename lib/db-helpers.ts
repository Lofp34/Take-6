import { getPrisma } from "./db";
import { normalizeName } from "./validation";

export async function upsertPlayersByName(names: string[]) {
  const prisma = getPrisma();
  const players = [];
  for (const name of names) {
    const normalized = normalizeName(name);
    const player = await prisma.player.upsert({
      where: { normalizedName: normalized },
      update: { name },
      create: { name, normalizedName: normalized },
    });
    players.push(player);
  }
  return players;
}
