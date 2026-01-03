# Project Status (MVP)

## Objectif
Ajouter une base Neon Postgres avec persistance et stats joueurs pour Take-6, deploye sur Vercel.

## Perimetre (scope)
- In: schema DB, migrations, API, stats, config Vercel/Neon, documentation.
- Out: mode offline avance, refonte UI majeure, authentification.

## Ce qui est en place
- MVP front (score + stats) porte par Next.js.
- Schema Prisma + migrations versionnees.
- API routes serverless pour match/rounds/stats.

## Decisions prises
- Prisma choisi pour migrations et access DB.
- Stockage des rounds/scores pour calculer les stats a la demande.
- API renvoie 503 si `DATABASE_URL` absent (deploiement initial sans DB).

## Risques / Blocages
- A valider: configuration Vercel/Neon (env vars preview/prod).
- Volume de stats a surveiller si historique long (pagination par 200).

## Prochaine etape (proposee)
1) Creer les migrations Prisma et verifier localement.
2) Configurer Neon/Vercel avec `DATABASE_URL` + `DIRECT_URL`.
3) Tester le flux complet (partie -> rounds -> fin -> stats).

## Journal des evolutions
- 2026-01-02: Initialisation backend Prisma + API + doc.
- 2026-01-02: Guard DB pour deploy initial Vercel sans base.
