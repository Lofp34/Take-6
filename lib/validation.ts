import { z } from "zod";

export const playersSchema = z
  .array(z.string().min(1).max(60))
  .length(4);

export const scoresSchema = z
  .array(z.number().int().min(0).nullable())
  .length(4);

export const targetSchema = z.number().int().min(1).max(200);

export function normalizeName(name: string) {
  return name.trim().toLowerCase();
}
