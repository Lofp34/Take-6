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
- Cloture automatique de partie quand le seuil est atteint en fin de manche.
- Ajustements UI pour une meilleure experience responsive.
- Ajout automatique de la manche suivante apres saisie complete d'une manche.
- Reset leaderboard pour remettre les scores courants a zero.

## Decisions prises
- Prisma choisi pour migrations et access DB.
- Stockage des rounds/scores pour calculer les stats a la demande.
- API renvoie 503 si `DATABASE_URL` absent (deploiement initial sans DB).
- La partie se cloture automatiquement a la fin d'une manche si un joueur atteint le seuil.

## Risques / Blocages
- A valider: configuration Vercel/Neon (env vars preview/prod).
- Volume de stats a surveiller si historique long (pagination par 200).
- Validation UX: comportement auto-fin en saisie progressive (manche incomplete).

## Prochaine etape (proposee)
1) Tester le flux complet (manche -> seuil 66 -> cloture auto -> nouvelle partie).
2) Verifier l'affichage responsive sur mobile (scores, stats, actions).
3) Confirmer la compatibilite import/export avec la nouvelle logique.

## Journal des evolutions
- 2026-01-02: Initialisation backend Prisma + API + doc.
- 2026-01-02: Guard DB pour deploy initial Vercel sans base.
- 2026-01-04: Auto-fin de partie a 66 en fin de manche + ajustements responsive.
- 2026-01-04: Ouverture auto d'une nouvelle manche apres saisie complete.
- 2026-01-04: Bouton reset leaderboard pour vider les manches en cours.
