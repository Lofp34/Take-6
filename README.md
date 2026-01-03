# Take-6 Score + Stats

MVP compteur de score et statistiques pour Take-6, avec persistance Neon Postgres via Prisma, et deploiement Vercel.

## Stack
- Next.js (App Router)
- Prisma + Neon Postgres
- API routes serverless

## Setup local
1) Installer les dependances
```
npm install
```

2) Configurer les variables d'environnement
```
cp .env.example .env
```
Renseigner `DATABASE_URL` (pooled) et `DIRECT_URL` (unpooled pour migrations).

3) Migrer la base
```
npm run prisma:migrate
```

4) Lancer le projet
```
npm run dev
```

## Commandes utiles
- `npm run dev` : dev server
- `npm run build` : build + migrate (si `DATABASE_URL` present)
- `npm run start` : server prod local
- `npm run prisma:migrate` : migrations dev
- `npm run prisma:deploy` : appliquer les migrations en prod
- `npm test` : tests basiques des stats

## Deploiement Vercel + Neon
1) Premier deploy Vercel sans DB
   - Laisser `DATABASE_URL` vide.
   - Le build passe (migrations ignorees).

2) Creer un projet Neon (Postgres) et recuperer :
   - `DATABASE_URL` (pooled / pgbouncer)
   - `DIRECT_URL` (unpooled)

3) Dans Vercel, definir les variables d'environnement :
   - Preview + Production : `DATABASE_URL`
   - Production (au minimum) : `DIRECT_URL`

4) Redeployer. Le build execute :
   - `prisma generate`
   - `prisma migrate deploy` si `DATABASE_URL` est present

## Troubleshooting
- Build Vercel sans DB : `DATABASE_URL` absent => migrations ignorees.
- App sans DB : l'API renvoie `db_unconfigured` (503).
- P1001/P1012 : verifier `DATABASE_URL`/`DIRECT_URL` et la version Prisma.
- Tables manquantes : verifier que `prisma/migrations` est committe et que `migrate deploy` s'executa.

## Documentation projet
- `documentation/project-status.md`

## Conventions branches / PR
Aucune convention imposee. Proposer une nomenclature si besoin (ex: `feature/xxx`, `fix/xxx`).
