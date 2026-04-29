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

**Portfolio interne** d'Assemblage ingénierie. Airtable est la source de vérité ; l'app lit, édite et publie les projets sur WordPress. L'accès est protégé par Supabase Auth (Google OAuth + magic link + email/password) avec validation manuelle par un administrateur.

### Authentification (Supabase, 100% client-side)

```
layout.tsx ──► AuthGate ──► useAuth ─► Supabase JS (implicit flow)
                                  │
                                  └─► portfolio_profiles (RLS)
```

- **`lib/supabase/client.ts`** : singleton `getSupabaseClient()` configuré avec `flowType: 'implicit'`. Le token OAuth revient dans le hash fragment de l'URL — jamais lu côté serveur.
- **`lib/supabase/useAuth.ts`** : hook React qui retourne `{ authState, session, profile, logout }`. États : `'loading' | 'loggedout' | 'waiting' | 'approved'`. Cache localStorage du profil sous la clé `_portfolio_profile` (uniquement quand `is_approved: true` — sinon on attend toujours un fetch frais pour éviter d'afficher "waiting" depuis du cache périmé).
- **`app/components/AuthGate.tsx`** : wrappe `{children}` dans `app/layout.tsx`. Affiche login / page d'attente / spinner selon `authState`. Quand approuvé, rend les enfants + un bouton de déconnexion fixe en bas à droite.
- **`proxy.ts`** : ne fait plus de gate d'accès — il transmet juste les requêtes (`NextResponse.next()`). Toute la logique auth est côté client.
- **Table `portfolio_profiles`** dans Supabase (projet INTERNAL `hhkofvbptnrtwbazftlm`, eu-west-2) : colonnes `id, email, role ('admin'|'user'), is_approved, created_at`. Trigger `handle_new_user` insert auto à chaque signup.
- **RLS** : policies "own profile" (`auth.uid() = id`) + "Admin reads all" / "Admin updates" via la fonction `is_admin()` `SECURITY DEFINER` (évite la récursion infinie qu'on aurait avec un `EXISTS` direct sur la même table dans la policy).
- **`/admin`** : page client-side qui liste les profils et permet d'approuver / changer de rôle. La route `/api/admin/users/[id]` (PATCH) valide côté serveur que l'appelant est admin avant d'écrire.
- **Variables d'env** : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Le redirect OAuth pointe vers `window.location.origin` (pas de route `/auth/callback` séparée).

### Protection des routes API (gate auth serveur)

`AuthGate` est purement UX côté client — il ne protège **rien** au niveau serveur. **Toute route API qui touche Airtable, WordPress, Supabase admin ou tout autre ressource sensible doit appeler `requireApprovedUser(req)` au tout début du handler.**

```ts
// app/api/.../route.ts
import { requireApprovedUser } from '@/lib/supabase/requireApprovedUser';

export async function POST(req: NextRequest, ...) {
  const auth = await requireApprovedUser(req);
  if (auth instanceof NextResponse) return auth; // 401 ou 403
  // ... auth.user.id, auth.profile.role disponibles
}
```

Le helper lit le JWT dans cet ordre :
1. **Header `Authorization: Bearer <jwt>`** — utilisé par les fetch côté client (le flow OAuth implicit stocke le token en localStorage, pas en cookie)
2. **Cookie de session** (fallback Server Components)

Puis il vérifie que `portfolio_profiles.is_approved = true`. Sinon → 401/403.

**Côté client**, tout fetch vers une route protégée doit attacher l'header :

```ts
import { authHeaders } from '@/lib/supabase/authHeaders';

await fetch('/api/projet/foo/fields', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
  body: JSON.stringify({...}),
});
```

**Pas de `<a href>` direct** vers une route protégée (impossible d'attacher un header à un lien) — utiliser un bouton + fetch + `URL.createObjectURL(blob)` pour les téléchargements (cf. `handleDownloadPdf` dans `ProjetEditor.tsx` / `ProjetToolbar.tsx`).

Routes protégées actuelles : `/api/projet/[slug]/{fields,publish,pdf}` et `/api/admin/users/[id]`.

### Data flow (Airtable → app)

```
Airtable ──► lib/airtable/queries.ts (getProjets / getProjet)
                └─► lib/airtable/mappers.ts (recordToProjet)
                        └─► types/projet.ts (Projet)
                                └─► composants / API routes
```

- `getProjets` et `getProjet` sont cachées avec `'use cache'` (Next.js 16) **et taggées** `cacheTag(PROJETS_TAG)`. Le tag `'projets'` est exporté depuis `queries.ts`.
- **Toute mutation Airtable doit appeler `revalidateTag(PROJETS_TAG, 'max')`** depuis le route handler — sinon la home et les autres fiches restent sur les anciennes données après un renommage (résultat : 404 sur l'ancien slug).
- `formulaValue` / `linkedValue` / `selectValue` dans `lib/airtable/client.ts` gèrent les types de champs Airtable (formules, liaisons, sélecteurs) qui retournent des shapes différentes selon le contexte.
- `recordToProjet` est le seul endroit qui mappe les noms de colonnes Airtable → champs TypeScript. C'est ici qu'ajouter ou renommer un champ.

### Pièges Airtable à connaître

- **Le `Slug` est un champ formule** dérivé de `Nom du projet`. Renommer un projet change son slug. La route PATCH retourne le nouveau slug et l'éditeur fait un `router.replace('/projet/<nouveau-slug>/edit')` si nécessaire.
- **`Pitch` et `Chiffres clefs` sont des formules** (read-only en écriture). L'éditeur les expose en lecture seule — modifiables uniquement pour l'aperçu, jamais sauvegardés.
- **`Rehab / Neuf` est un multi-select** : on l'envoie comme array (`[value]`), pas comme string.
- **`Sélectionner` (champ layout) attend `Editorial` ou `Magazine`** — pas d'accent sur "Editorial" car c'est l'option exacte créée dans Airtable. Le PAT n'a pas le scope `schema.bases:write` donc on ne peut pas créer de nouvelles options à la volée.
- Tous les `update()` Airtable utilisent `{ typecast: true }` pour gérer gracieusement les conversions (number depuis string, etc.).
- Le slug en entrée est validé avec `/^[a-zA-Z0-9_-]+$/` dans toutes les fonctions Airtable (queries + mutations).

### Routes API

| Route | Méthode | Rôle |
|-------|---------|------|
| `/api/projet/[slug]/fields` | PATCH | Sauvegarde les champs éditables dans Airtable. Retourne `{ ok, slug }` (le nouveau slug si renommage). Invalide le cache `projets`. |
| `/api/projet/[slug]/pdf` | GET | Génère un PDF A4 via Puppeteer (navigue vers `?print=true`) |
| `/api/projet/[slug]/publish` | POST | Upload médias → WordPress, crée/met à jour le post en draft, write-back URL dans Airtable |
| `/api/admin/users/[id]` | PATCH | Met à jour `role` / `is_approved` dans `portfolio_profiles` (vérifie le rôle admin côté serveur) |

### Layouts de rendu

Chaque projet a un `layout: 'Editorial' | 'Magazine'` (sans accent) stocké dans Airtable (champ `Sélectionner`). Ce choix contrôle :
- l'affichage dans `components/layouts/LayoutEditorial.tsx` / `LayoutMagazine.tsx`
- le HTML généré dans `lib/wordpress/builders.ts` pour la publication WordPress

Les deux builders produisent du HTML inline-stylé autonome (pas de classes CSS externes) pour être embarqué dans WordPress tel quel.

### WordPress

- `lib/wordpress/client.ts` : upload media (stream binaire depuis l'URL Airtable) + create/update post via REST API
- **Authentification : Basic auth** avec `WP_USER` + `WP_APP_PASSWORD` (Application Password WordPress, espaces retirés)
- `extractWpPostId` parse `?p=<id>` dans l'URL WordPress pour détecter un post existant à mettre à jour
- Seules les URLs d'images provenant de `*.airtable.com` / `*.airtableusercontent.com` sont autorisées (SSRF guard dans `publish/route.ts`)

### PDF

En développement : Puppeteer bundled. En production / Lambda : `@sparticuz/chromium` + `puppeteer-core` (activé par `NODE_ENV=production` ou `USE_CHROMIUM_LAMBDA=true`).

### Styles

- `styles/tokens.css` — variables CSS Assemblage (`--ai-rouge`, `--ai-violet`, `--serif`, `--sans`, …) à utiliser dans tout nouveau composant
- CSS Modules pour les layouts (`layout-editorial.module.css`, `layout-magazine.module.css`)
- Tailwind v4 disponible mais peu utilisé — préférer les CSS custom properties pour rester cohérent

### Variables d'environnement requises

Voir `.env.example` à la racine.

| Variable | Usage |
|----------|-------|
| `AIRTABLE_API_KEY` | PAT Airtable avec scopes `data.records:read` + `data.records:write` sur la base portfolio |
| `AIRTABLE_BASE_ID` | ID de la base Airtable |
| `AIRTABLE_TABLE_NAME` | Nom de la table projets |
| `WP_BASE_URL` | URL de base de l'API WordPress (ex: `https://www.assemblage.net/wp-json/wp/v2`) |
| `WP_USER` | Utilisateur WordPress |
| `WP_APP_PASSWORD` | Application password WordPress (Basic auth) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL projet Supabase INTERNAL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon Supabase |
| `NEXT_PUBLIC_APP_URL` | URL publique de l'app (utilisée nulle part de critique) |
| `USE_CHROMIUM_LAMBDA` | Optionnel — `true` pour forcer `@sparticuz/chromium` en local |
