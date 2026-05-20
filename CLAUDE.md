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

> ⚠ **Export PDF ≠ Export WordPress.** Les deux pipelines de rendu sont volontairement séparés :
> - **PDF** : `lib/pdf/templates/{solo,diptyque,triptyque,manuel,dev}.ts` + helpers `shared.ts`. Sortie A4 via Puppeteer + chromium. (Note : `manuel.ts` est utilisé pour le template `Str-Env` — le fichier garde son nom historique.)
> - **WordPress** : `lib/wordpress/{builders.ts,buildersV2.ts}`. HTML inline-stylé pour être embarqué dans un post WordPress.
>
> **Si la demande utilisateur ne mentionne pas explicitement WordPress / l'export WP / le builder WP, NE PAS modifier `lib/wordpress/`.** Une modification de mise en page côté PDF n'a pas à être répliquée côté WP par défaut — chaque pipeline a son propre style et ses propres compromis. Demander confirmation si ambigu.

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
- **`Template` (anciennement `Sélectionner`) attend `Solo`, `Diptyque`, `Triptyque`, `Str-Env` ou `Dev`** (cf. `types/projet.ts → TemplateChoice`). `TEMPLATE_OPTIONS = ['Str-Env', 'Dev']` côté UI : les variantes Solo/Diptyque/Triptyque sont auto-sélectionnées par `autoSelectTemplate` selon le nombre de photos. Le mapper lit `Template` puis `Sélectionner` en fallback. Le PAT n'a pas le scope `schema.bases:write` donc on ne peut pas créer de nouvelles options à la volée.
- **Description projet** (rich text Markdown GFM) et **Prestation Assemblage** (rich text, `flddrMLBDxOc8r4lJ`) — rendus via `lib/utils/markdown.ts` (`marked`).
- **Champs linked records vers la base CRM AI** (table synced `Sync CRM` dans la base portfolio) : `Maître d'ouvrage`, `Architecte`, `Mandataire`, `Entreprise` (`fldWsiJtKrOWyzRDr`), `BET associés`, `Bailleur` (`fldUYSS8DyqtT2gDJ`). En cellFormat=json, ces champs reviennent en arrays de record IDs (`recXXX`). La résolution des noms se fait via `lib/airtable/crm.ts → fetchCrmNames()` qui interroge `Sync CRM` avec un filter `OR(RECORD_ID()='rec1',…)` pour récupérer le champ `Nom`. **Toute extension à un nouveau linked record CRM doit aussi ajouter le nom de colonne dans `extractIds` (queries.ts) ET dans le mapper via `resolveCrm`.**
- **Multi-selects lus par field ID** (noms de colonnes pas garantis stables → `returnFieldsByFieldId: true`) :
  - `Programme principal` (`fldKNKtsZNpvmf695`) et `Programme secondaire` (`fldaTqKMNrIpeGBma`)
  - `Vignette pôle` (`fld1PZuYO8mz0sULA`) — STR / ENV / DEV
  - `Pôle` (`fldJyT3Lu0ZEH7EYE`) — single-select
  - `Rehab / Neuf` (`fldyD7L9E7cGL26vH`)
  - `Matériaux` (`fldC4SW9n1H2PZ3MH`)
  - `Statut` (`fldxXNdE0uNaomeby`) — multi-valeurs pour filtrage AND, fallback sur `État avancement` (single)
- **`Certification`** (`fldnb9rfM4C3m9Pcu`) — depuis 2026 c'est un champ rich text (Markdown GFM). Le mapper split sur newlines et strip les marqueurs de liste (`- `, `* `, `+ `, `1. `…) pour produire un `string[]`. Rétro-compat array si Airtable renvoie l'ancien format multi-select.
- **Les linked records ne traversent jamais les bases** dans Airtable : un sync depuis une base externe crée une table locale dans la base destination, avec des record IDs différents de la base source. Les field IDs aussi sont réattribués (les noms sont préservés). C'est pour ça que `fetchCrmNames` lit le champ `Nom` par nom et pas par ID.
- Tous les `update()` Airtable utilisent `{ typecast: true }` pour gérer gracieusement les conversions (number depuis string, etc.).
- Le slug en entrée est validé avec `/^[a-zA-Z0-9_-]+$/` dans toutes les fonctions Airtable (queries + mutations).

### Routes API

| Route | Méthode | Rôle |
|-------|---------|------|
| `/api/projet/[slug]/fields` | PATCH | Sauvegarde les champs éditables dans Airtable. Retourne `{ ok, slug }` (le nouveau slug si renommage). Invalide le cache `projets`. |
| `/api/projet/[slug]/pdf` | GET | Génère un PDF A4 via Puppeteer (navigue vers `?print=true`) |
| `/api/projet/[slug]/publish` | POST | Upload médias → WordPress, crée/met à jour le post en draft, write-back URL dans Airtable |
| `/api/admin/users/[id]` | PATCH | Met à jour `role` / `is_approved` dans `portfolio_profiles` (vérifie le rôle admin côté serveur) |

### Templates de rendu PDF

Chaque projet a un `template: 'Solo' | 'Diptyque' | 'Triptyque' | 'Str-Env' | 'Dev'` (champ Airtable `Template`). Côté UI seuls **Str-Env** et **Dev** sont exposés à l'utilisateur (`TEMPLATE_OPTIONS`) ; les variantes Solo/Diptyque/Triptyque sont auto-sélectionnées par `autoSelectTemplate` selon le nombre de photos quand `template` est absent. Ce choix contrôle uniquement le rendu **PDF** (`lib/pdf/templates/{solo,diptyque,triptyque,manuel,dev}.ts`).

- **Solo** : photo unique pleine largeur + description compacte. Utilise `descriptionHtml(projet, 1, true)` (singleParagraph).
- **Diptyque** : 2 photos + description 2 colonnes. Utilise `descriptionHtml(projet, 2)`.
- **Triptyque** : 1 photo héro + 2-3 photos secondaires + texte 2 colonnes. **A son propre rendu de description** (utilise `renderMarkdown()` directement, pas `descriptionHtml`) car il calcule la 3ᵉ photo en bas de col 2 selon la longueur du texte.
- **Str-Env** : layout libre rendu par `renderManuel` (le fichier `manuel.ts` garde son nom historique). L'utilisateur ajuste taille/position des photos et split du texte via la sidebar de mise en page. **A son propre `paragraphsToHtml()`** qui appelle `renderMarkdown()`.
- **Dev** : layout dédié au pôle Développement. Rendu par `renderDev` (`templates/dev.ts`). Bandeau réordonné (MOA · Bailleur · Architecte · Budget · Programme · Mission AI · BET associés), liste flottante de certifications, bloc "Prestation Assemblage" superposable, en-tête "Période : YYYY – YYYY" au lieu du statut.

⚠ Quand on modifie le rendu de description, **les 5 templates doivent être touchés** (pas seulement `descriptionHtml` dans `shared.ts`).

Le helper `metaGridHtml(projet, options)` dans `shared.ts` rend le bandeau commun. Deux variantes :
- **Str-Env** (défaut) — MOA · Architecte · BET associés · Budget · Surface · Entreprise · Mission AI · Programme
- **Dev** (`options.isDev: true`) — MOA · Bailleur · Architecte · Budget · Programme · Mission AI · BET associés

Le label du champ Maître d'ouvrage est affiché **`MOA`** dans le PDF (le nom Airtable reste `Maître d'ouvrage`, mais le rendu utilise le sigle court).

### Builders WordPress

Indépendants du système de templates PDF. `lib/wordpress/builders.ts` (Editorial — utilisé en production) + `buildersV2.ts` (Magazine — variante en parallèle, archivée). HTML inline-stylé autonome (pas de classes CSS externes) pour être embarqué dans WordPress tel quel.

⚠ **Ne pas modifier ces fichiers sans demande explicite portant sur l'export WordPress.**

### WordPress

- `lib/wordpress/client.ts` : upload media (stream binaire depuis l'URL Airtable) + create/update post via REST API
- **Authentification : Basic auth** avec `WP_USER` + `WP_APP_PASSWORD` (Application Password WordPress, espaces retirés)
- `extractWpPostId` parse `?p=<id>` dans l'URL WordPress pour détecter un post existant à mettre à jour
- Seules les URLs d'images provenant de `*.airtable.com` / `*.airtableusercontent.com` sont autorisées (SSRF guard dans `publish/route.ts`)

### PDF

En développement : Puppeteer bundled. En production / Lambda : `@sparticuz/chromium` + `puppeteer-core` (activé par `NODE_ENV=production` ou `USE_CHROMIUM_LAMBDA=true`).

L'aperçu en ligne (`/projet/[slug]`) utilise le **même HTML** que l'export PDF, rendu dans une iframe via `srcDoc` (cf. `components/TemplatePreview.tsx`). Donc tout changement dans `lib/pdf/templates/` se voit dans le preview ET dans le PDF téléchargé.

### Description rich text (Markdown)

Le champ Airtable `Description projet` est en mode "Texte enrichi" depuis 2026 — Airtable retourne du Markdown GFM (`**gras**`, `*italique*`, listes `-`, liens, etc.).

- **Rendu** : `lib/utils/markdown.ts` exporte `renderMarkdown(md)` qui utilise l'instance globale `marked` (avec `gfm: true, breaks: true`). Tous les templates PDF + builders WP passent par cette fonction.
- **Édition** : `components/projet/RichTextEditor.tsx` est un contenteditable avec toolbar B/I/U/listes/lien. Convertit HTML→Markdown au save via `turndown` (avec `keep:['u']` pour préserver le `<u>` souligné non standard), Markdown→HTML à l'init via `marked`.
- **Round-trip** : le markdown est stocké tel quel dans Airtable. Pas de transformation lossy entre l'édition et la lecture.

### Résolution CRM (linked records)

Les champs `Maître d'ouvrage`, `Architecte`, `Mandataire`, `Entreprise`, `BET associés` et `Bailleur` pointent tous vers une table synchronisée `Sync CRM` dans la base portfolio (sync depuis la base externe `CRM AI`).

`lib/airtable/crm.ts → fetchCrmNames(recordIds)` interroge la table définie par `AIRTABLE_CRM_TABLE_NAME` (par défaut sur `AIRTABLE_BASE_ID`, fallback `AIRTABLE_CRM_BASE_ID`) avec un filter `OR(RECORD_ID()='rec1', …)` et retourne une `Map<id → nom>`. Le mapper résout chaque champ via `resolveCrm(field, crmNames)` avec un **fallback string** sur l'ancien format texte (rétro-compat avec les fiches non encore migrées).

`queries.ts` collecte les record IDs CRM des **6 champs ci-dessus** via `extractIds` avant d'appeler `fetchCrmNames`. **Ajouter un nouveau champ linked CRM = ajouter à 2 endroits :** la collecte dans `queries.ts` ET la résolution dans `mappers.ts`.

⚠ Les linked records ne traversent pas les bases : la table interrogée doit être la table **synced locale** dans la base portfolio (typiquement `Sync CRM`), pas la table source dans `CRM AI`.

`Programme principal`/`Programme secondaire` sont eux des **multi-selects** dans la table portfolio elle-même, lus via une requête auxiliaire avec `returnFieldsByFieldId: true` (cf. `fetchAuxByFieldId` dans `queries.ts`).

### Pages de portfolio & filtres

Quatre pages partagent un même ensemble de filtres :

| Page | Composant | Rôle |
|---|---|---|
| Home interne (`/`) | `components/portfolio/PortfolioGrid.tsx` | Grille/liste de toutes les références, recherche + filtres |
| Constituer un portfolio (`/portfolio/builder`) | `components/portfolio/PortfolioBuilder.tsx` | Sélection + ordre + export PDF de plusieurs fiches |
| Constituer un tableau (`/portfolio/tableau`) | `components/portfolio/TableauBuilder.tsx` | Sélection + ordre + tableau récap |
| Portfolio public (`/public/portfolio`) | `app/public/portfolio/PublicPortfolioTable.tsx` | Tableau paginé public (extranet) |

**Layout filtres unifié** (page publique = référence) en 3 rangées :
1. Pôle · Statut · Type
2. Programme (pleine largeur)
3. Matériaux (flex, gauche) · Année slider (`marginLeft: auto`, droite)

**Sémantique** :
- **0 valeur cochée** → tous les projets
- **1 valeur cochée** → projets contenant cette valeur
- **2+ valeurs cochées** → projets contenant **toutes** les valeurs (logique AND)

Le slider d'année `components/portfolio/RangeSlider.tsx` est un composant partagé entre les 4 pages.

### Tableau de références (`TableauBuilder`)

Workflow en 3 étapes : sélection des références → ordre → preview & export.

- **Colonnes cochables** (`lib/pdf/tableauTemplate.ts → TABLEAU_FIELDS`) : Projet, Architecte, MOA, Mission AI, Programme (multi-select joint), Budget, Surface, Lieu, Année, Statut, Matériaux, Certification, Champ libre.
- **Mode** `Str-Env` ou `Dev` — pré-sélectionne un jeu de colonnes par défaut et un ordre canonique (`TABLEAU_ORDER_BY_MODE` / `TABLEAU_DEFAULTS_BY_MODE`). `champLibre` reste impérativement en dernière position.
- **Champ libre** : checkbox dans la sidebar → modal "Configurer le champ libre" avec input pour le nom de colonne + textarea long par référence sélectionnée → bouton Confirmer ajoute la colonne au tableau. Décocher conserve les valeurs en mémoire. Édition possible via le bouton "Éditer" à côté de la checkbox.
- **Auto-pagination paysage** : quand `measureOverflow` détecte un dépassement vertical, `TableauBuilder` calcule un `rowsPerPage` qui fait tenir le contenu en mesurant directement le DOM (hauteur moyenne d'une ligne, non-tbody height = title + thead + footer + paddings). `renderTableau` chunk les projets en plusieurs `.tab-page` ; header de colonnes + footer logo/count répétés sur chaque page. Direction-lock anti-oscillation entre incrément (`spacer.height > avgRowHeight`) et décrément (overflow persistant).
- **Critique pour la mesure** : la décision de pagination doit se faire dans le **même callback async** que `measureOverflow` (après `iframe.load` + `fonts.ready` + 2× `rAF`), sinon le DOM lu peut être périmé et on cascade vers un état incorrect.
- **Export** : URL `/portfolio/tableau/print?items=...&fields=...&orient=...&mode=...&cln=...&clv=...&rpp=...` — `cln` (nom du champ libre), `clv` (JSON `{ slug: description }`), `rpp` (rows per page pour le chunking).

### Styles

- `styles/tokens.css` — variables CSS Assemblage (`--ai-rouge`, `--ai-violet`, `--serif`, `--sans`, …) à utiliser dans tout nouveau composant
- CSS Modules pour les layouts (`layout-editorial.module.css`, `layout-magazine.module.css`)
- Tailwind v4 disponible mais peu utilisé — préférer les CSS custom properties pour rester cohérent

### Variables d'environnement requises

Voir `.env.example` à la racine.

| Variable | Usage |
|----------|-------|
| `AIRTABLE_API_KEY` | PAT Airtable avec scopes `data.records:read` + `data.records:write` sur la base portfolio **et la base CRM AI** (la table `Sync CRM` héritant des permissions de la source) |
| `AIRTABLE_BASE_ID` | ID de la base Airtable portfolio |
| `AIRTABLE_TABLE_NAME` | Nom de la table projets (ex. `Affaire`) |
| `AIRTABLE_CRM_TABLE_NAME` | Nom de la table synchronisée du CRM dans la base portfolio (ex. `Sync CRM`). Utilisée par `fetchCrmNames` pour résoudre MOA/Architecte/Mandataire/Entreprise. |
| `AIRTABLE_CRM_BASE_ID` | Optionnel — fallback si on veut interroger directement la base CRM AI au lieu de la table synced. Normalement non nécessaire. |
| `WP_BASE_URL` | URL de base de l'API WordPress (ex: `https://www.assemblage.net/wp-json/wp/v2`) |
| `WP_USER` | Utilisateur WordPress |
| `WP_APP_PASSWORD` | Application password WordPress (Basic auth) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL projet Supabase INTERNAL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon Supabase |
| `NEXT_PUBLIC_APP_URL` | URL publique de l'app (utilisée nulle part de critique) |
| `USE_CHROMIUM_LAMBDA` | Optionnel — `true` pour forcer `@sparticuz/chromium` en local |
