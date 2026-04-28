# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # dev server on http://localhost:3000
npm run build    # production build
npm run lint     # ESLint
```

No test suite is configured.

## Architecture

**Portfolio interne** d'Assemblage ingénierie. Airtable est la source de vérité ; l'app lit, édite et publie les projets sur WordPress.

### Data flow

```
Airtable ──► lib/airtable/queries.ts (getProjets / getProjet)
                └─► lib/airtable/mappers.ts (recordToProjet)
                        └─► types/projet.ts (Projet)
                                └─► composants / API routes
```

- `getProjets` et `getProjet` sont cachées avec la directive `'use cache'` (Next.js 16). Invalider le cache manuellement si besoin.
- `formulaValue` / `linkedValue` / `selectValue` dans `lib/airtable/client.ts` gèrent les types de champs Airtable (formules, liaisons, sélecteurs) qui retournent des shapes différentes selon le contexte.
- `recordToProjet` est le seul endroit qui mappe les noms de colonnes Airtable → champs TypeScript. C'est ici qu'ajouter ou renommer un champ.

### Routes API

| Route | Méthode | Rôle |
|-------|---------|------|
| `/api/projet/[slug]/fields` | PATCH | Sauvegarde les champs éditables dans Airtable |
| `/api/projet/[slug]/pdf` | GET | Génère un PDF A4 via Puppeteer (navigue vers `?print=true`) |
| `/api/projet/[slug]/publish` | POST | Upload médias → WordPress, crée/met à jour le post en draft, write-back URL dans Airtable |

Le slug est validé avec `/^[a-zA-Z0-9_-]+$/` en entrée de toutes les fonctions Airtable.

### Layouts de rendu

Chaque projet a un `layout: 'Éditorial' | 'Magazine'` stocké dans Airtable. Ce choix contrôle :
- l'affichage dans `components/layouts/LayoutEditorial.tsx` / `LayoutMagazine.tsx`
- le HTML généré dans `lib/wordpress/builders.ts` pour la publication WordPress

Les deux builders produisent du HTML inline-stylé autonome (pas de classes CSS externes) pour être embarqué dans WordPress tel quel.

### WordPress

- `lib/wordpress/client.ts` : upload media (stream binaire depuis l'URL Airtable) + create/update post via REST API
- Authentification : header `X-Api-Key`
- `extractWpPostId` parse `?p=<id>` dans l'URL WordPress pour détecter un post existant à mettre à jour
- Seules les URLs d'images provenant de `*.airtable.com` / `*.airtableusercontent.com` sont autorisées (SSRF guard dans `publish/route.ts`)

### PDF

En développement : Puppeteer bundled. En production / Lambda : `@sparticuz/chromium` + `puppeteer-core` (activé par `NODE_ENV=production` ou `USE_CHROMIUM_LAMBDA=true`).

### Styles

- `styles/tokens.css` — variables CSS Assemblage (`--ai-rouge`, `--ai-violet`, `--serif`, `--sans`, …) à utiliser dans tout nouveau composant
- CSS Modules pour les layouts (`layout-editorial.module.css`, `layout-magazine.module.css`)
- Tailwind v4 disponible mais peu utilisé — préférer les CSS custom properties pour rester cohérent

### Variables d'environnement requises

Voir `.env.example` à la racine. Les cinq variables sont obligatoires au démarrage : `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`, `AIRTABLE_TABLE_NAME`, `WP_BASE_URL`, `WP_API_KEY`.
