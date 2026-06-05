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

Routes protégées actuelles : `/api/projet/[slug]/{fields,publish,pdf}`, `/api/admin/users/[id]` et `/api/admin/apply-defaults` (admin only).

### Data flow (Airtable → app)

```
Airtable ──► lib/airtable/queries.ts (getProjets / getProjet)
                └─► lib/airtable/mappers.ts (recordToProjet)
                        └─► types/projet.ts (Projet)
                                └─► composants / API routes
```

- `getProjets` et `getProjet` sont cachées avec `'use cache'` (Next.js 16) avec des **tags granulaires** :
  - `getProjets()` → `cacheTag(PROJETS_LIST_TAG)` (`'projets:list'`) — partagé par toutes les vues liste (home, builder, tableau, API publique).
  - `getProjet(slug)` → `cacheTag(projetTag(slug))` (`'projet:<slug>'`) — un tag par fiche.
- **Stratégie d'invalidation** dans `/api/projet/[slug]/fields` :
  - Toujours `revalidateTag(projetTag(slug))` (et `revalidateTag(projetTag(newSlug))` si renommage).
  - `revalidateTag(PROJETS_LIST_TAG)` uniquement si un champ "indexé" change (nom, statut, programme, année, pôle, MOA, lieu, surface, budget…) ou si renommage. Pour un édit qui ne touche qu'une fiche (description, mise en page Str-Env, photoCrops, bandeauConfig, etc. — cf. `FICHE_ONLY_FIELDS` dans `route.ts`), la liste n'est PAS invalidée. C'est ce qui évite de brûler le quota ISR Vercel (avant : 1 save = N writes pour N fiches en cache ; après : 1 save = 1-2 writes dans le cas typique).
  - `PROJETS_TAG` reste exporté en alias deprecated de `PROJETS_LIST_TAG` pour rétro-compat.
- `formulaValue` / `linkedValue` / `selectValue` dans `lib/airtable/client.ts` gèrent les types de champs Airtable (formules, liaisons, sélecteurs) qui retournent des shapes différentes selon le contexte.
- `recordToProjet` est le seul endroit qui mappe les noms de colonnes Airtable → champs TypeScript. C'est ici qu'ajouter ou renommer un champ.

### Pièges Airtable à connaître

- **Le `Slug` est un champ formule** dérivé de `Nom du projet`. Renommer un projet change son slug. La route PATCH retourne le nouveau slug et l'éditeur fait un `router.replace('/projet/<nouveau-slug>/edit')` si nécessaire.
- **`Pitch` et `Chiffres clefs` sont des formules** (read-only en écriture). L'éditeur les expose en lecture seule — modifiables uniquement pour l'aperçu, jamais sauvegardés.
- **`Template` (anciennement `Sélectionner`) attend `Solo`, `Diptyque`, `Triptyque`, `Str-Env` ou `Dev`** (cf. `types/projet.ts → TemplateChoice`). `TEMPLATE_OPTIONS = ['Str-Env', 'Dev']` côté UI. Quand le champ `Template` Airtable est absent, `autoSelectTemplate` choisit selon la **Vignette pôle** : `DEV` → `Dev`, sinon (STR/ENV/vide) → `Str-Env` (il ne renvoie jamais Solo/Diptyque/Triptyque — ces variantes ne sont atteintes que par une valeur explicite dans Airtable). Le mapper lit `Template` puis `Sélectionner` en fallback. Le PAT n'a pas le scope `schema.bases:write` donc on ne peut pas créer de nouvelles options à la volée.
- **Description projet** (rich text Markdown GFM) et **Prestation Assemblage** (rich text, `flddrMLBDxOc8r4lJ`) — rendus via `lib/utils/markdown.ts` (`marked`).
- **Champs linked records vers la base CRM AI** (table synced `Sync CRM` dans la base portfolio) : `Maître d'ouvrage`, `Architecte`, `Mandataire`, `Entreprise` (`fldWsiJtKrOWyzRDr`), `BET associés`, `Bailleur` (`fldUYSS8DyqtT2gDJ`). En cellFormat=json, ces champs reviennent en arrays de record IDs (`recXXX`). La résolution des noms se fait via `lib/airtable/crm.ts → fetchCrmNames()` qui interroge `Sync CRM` avec un filter `OR(RECORD_ID()='rec1',…)` pour récupérer le champ `Nom`. **Toute extension à un nouveau linked record CRM doit aussi ajouter le nom de colonne dans `extractIds` (queries.ts) ET dans le mapper via `resolveCrm`.**
- **Multi-selects lus par field ID** (noms de colonnes pas garantis stables → `returnFieldsByFieldId: true`) :
  - `Programme principal` (`fldKNKtsZNpvmf695`) et `Programme secondaire` (`fldaTqKMNrIpeGBma`)
  - `Vignette pôle` (`fld1PZuYO8mz0sULA`) — STR / ENV / DEV
  - `Pôle` (`fldJyT3Lu0ZEH7EYE`) — single-select
  - `Rehab / Neuf` (`fldyD7L9E7cGL26vH`)
  - `Matériaux` (`fldC4SW9n1H2PZ3MH`)
  - `Statut` (`fldxXNdE0uNaomeby`) — multi-valeurs pour filtrage AND, fallback sur `État avancement` (single)
    - ⚠ **En écriture**, ce champ est en réalité un **single-select** Airtable (« État avancement »). `updateProjetFields()` envoie donc `statutValues[0]` (string ou `null`), pas l'array — envoyer un array déclenche `INVALID_VALUE_FOR_COLUMN: Cannot parse value`. La lecture (`allValues()`) tolère string OU array.
- **Multi-selects et champs renommables écrits par field ID** dans `lib/airtable/mutations.ts → updateProjetFields()`. Les noms de colonnes Airtable ne sont pas garantis stables — toute écriture par nom risque un `UNKNOWN_FIELD_NAME` après un rename côté Airtable. Concerne : `Programme principal/secondaire`, `Mission AI`, `Pôle`, `Rehab/Neuf`, `Statut` (`État avancement`), `Matériaux`, `Certification`, `Prestation Assemblage`. Les constantes sont exportées depuis `lib/airtable/mappers.ts` (`FIELD_PROGRAMME_PRINCIPAL`, `FIELD_MISSION_AI`, `FIELD_CERTIFICATION`, …). **Ajouter un nouveau champ renommable = exporter sa constante `FIELD_*` dans `mappers.ts` et l'utiliser dans `mutations.ts`.**
- **`Certification`** (`fldnb9rfM4C3m9Pcu`) — depuis 2026 c'est un champ rich text (Markdown GFM). Le mapper split sur newlines et strip les marqueurs de liste (`- `, `* `, `+ `, `1. `…) pour produire un `string[]`. Rétro-compat array si Airtable renvoie l'ancien format multi-select.
- **Les linked records ne traversent jamais les bases** dans Airtable : un sync depuis une base externe crée une table locale dans la base destination, avec des record IDs différents de la base source. Les field IDs aussi sont réattribués (les noms sont préservés). C'est pour ça que `fetchCrmNames` lit le champ `Nom` par nom et pas par ID.
- Tous les `update()` Airtable utilisent `{ typecast: true }` pour gérer gracieusement les conversions (number depuis string, etc.).
- Le slug en entrée est validé avec `/^[a-zA-Z0-9_-]+$/` dans toutes les fonctions Airtable (queries + mutations).

### Routes API

| Route | Méthode | Rôle |
|-------|---------|------|
| `/api/projet/[slug]/fields` | PATCH | Sauvegarde les champs éditables dans Airtable. Retourne `{ ok, slug }` (le nouveau slug si renommage). Invalide le cache `projets`. |
| `/api/projet/[slug]/pdf` | GET | Génère un PDF A4 via Puppeteer (navigue vers `?print=true`) |
| `/api/projet/[slug]/publish` | POST | Upload médias → WordPress, crée **toujours** un nouveau draft (jamais d'UPDATE sur post existant), write-back URL dans Airtable |
| `/api/projet/[slug]/update-prod` | POST | Promeut le contenu du dernier draft tracké dans Airtable vers le post publié existant (lookup par slug + status=publish) |
| `/api/admin/users/[id]` | PATCH | Met à jour `role` / `is_approved` dans `portfolio_profiles` (vérifie le rôle admin côté serveur) |
| `/api/admin/apply-defaults` | POST | **Admin only.** Écrit `ASSEMBLAGE_DEFAULT_BANDEAU` + `ASSEMBLAGE_DEFAULT_MANUAL` dans le champ « Config template manuel » de toutes les fiches `ficheStatus === 'Pas faite'` (écrase bandeau+manuel, préserve le reste). Invalide les tags `projet:<slug>` concernés. |
| `/api/airtable/select-options` | GET | Lit les options canoniques des multi-selects via l'API Metadata Airtable (scope `schema.bases:read`). Alimente les `MultiSelectField` de l'éditeur. Cache 5 min via `next: { revalidate: 300 }`. |
| `/api/public/portfolio` | GET | Endpoint public lecture seule (extranet) : liste sanitisée des fiches `visiblePortfolio`. Filtres optionnels en query params. |

> ⚠ **Next 16 + `cacheComponents`** : toute route API qui lit `req.nextUrl.searchParams` doit appeler `await connection()` (`next/server`) en tête de handler, sinon le build échoue avec `NEXT_PRERENDER_INTERRUPTED` (le runtime tente de prerender la route). C'est l'équivalent moderne et compatible de `export const dynamic = 'force-dynamic'`. Cf. `/api/public/portfolio`.

### Templates de rendu PDF

Chaque projet a un `template: 'Solo' | 'Diptyque' | 'Triptyque' | 'Str-Env' | 'Dev'` (champ Airtable `Template`). Côté UI seuls **Str-Env** et **Dev** sont exposés à l'utilisateur (`TEMPLATE_OPTIONS`) ; quand `template` est absent, `autoSelectTemplate` choisit `Dev` ou `Str-Env` selon la Vignette pôle (cf. *Pièges Airtable*). Ce choix contrôle uniquement le rendu **PDF** (`lib/pdf/templates/{solo,diptyque,triptyque,manuel,dev}.ts`).

- **Solo** : photo unique pleine largeur + description compacte. Utilise `descriptionHtml(projet, 1, true)` (singleParagraph).
- **Diptyque** : 2 photos + description 2 colonnes. Utilise `descriptionHtml(projet, 2)`.
- **Triptyque** : 1 photo héro + 2-3 photos secondaires + texte 2 colonnes. **A son propre rendu de description** (utilise `renderMarkdown()` directement, pas `descriptionHtml`) car il calcule la 3ᵉ photo en bas de col 2 selon la longueur du texte.
- **Str-Env** : layout libre rendu par `renderManuel` (le fichier `manuel.ts` garde son nom historique). L'utilisateur ajuste taille/position des photos et split du texte via la sidebar de mise en page. **A son propre `paragraphsToHtml()`** qui appelle `renderMarkdown()`.
- **Dev** : layout dédié au pôle Développement. Rendu par `renderDev` (`templates/dev.ts`). Bandeau réordonné (MOA · Bailleur · Architecte · Budget · Programme · Mission AI · BET associés), liste flottante de certifications, bloc "Prestation Assemblage" superposable, en-tête "Période : YYYY – YYYY" au lieu du statut.

⚠ Quand on modifie le rendu de description, **les 5 templates doivent être touchés** (pas seulement `descriptionHtml` dans `shared.ts`).

Le helper `metaGridHtml(projet, options)` dans `shared.ts` rend le bandeau commun. Deux variantes :
- **Str-Env** (défaut) — MOA · Architecte · BET associés · Budget/Surface · Entreprise · Mission AI · Programme · Matériaux
- **Dev** (`options.isDev: true`) — MOA · Bailleur · Architecte · Budget/Surface · Programme · Matériaux · Mission AI · BET associés

Le label du champ Maître d'ouvrage est affiché **`MOA`** dans le PDF (le nom Airtable reste `Maître d'ouvrage`, mais le rendu utilise le sigle court).

#### Spécificités des cellules du bandeau

- **`Budget/Surface`** : cellule fusionnée (depuis 2026) à **deux lignes** — budget en ligne 1, surface en ligne 2 — pour gagner de la largeur. Le saut de ligne entre les deux est **forcé** dans `breaksOf()` (`set.add(0)`), non configurable par l'utilisateur. Si une seule des deux valeurs est renseignée, la cellule l'affiche seule. Les anciennes cellules `Budget` et `Surface` n'existent plus dans `CANONICAL_META_LABELS` (configs `weights`/`breaks` qui les référencent encore = ignorées silencieusement).
- **`Matériaux`** : multi-select rendu après Programme dans les deux templates, même mécanique multi-valeurs que les autres cellules (sauts de ligne configurables).
- **`Mission AI` — collapse AMO** : `collapseAmoMissionAi()` dans `shared.ts` remplace `AMO ENV` et/ou `AMO DEV` par un unique `AMO` **au rendu** (les données Airtable restent intactes). Ex. `["AMO DEV", "AMO ENV"]` → `["AMO"]`, `["MOE", "AMO ENV"]` → `["MOE", "AMO"]`. La même transformation est dupliquée dans `BandeauConfigPanel.multiValueCellsFromProjet()` pour que les indices de sauts de ligne correspondent au rendu.

#### Sauts de ligne dans les cellules (`bandeauConfig.cells`)

- **Multi-valeurs (`breaks`)** : `Partial<Record<MetaLabel, number[]>>` — indices de valeur après lesquels insérer un `<br>` au lieu d'une virgule. UI : section *Sauts de ligne* du panneau bandeau (clic sur le séparateur entre deux valeurs).
- **Intra-valeur (`wordBreaks`)** : `Partial<Record<MetaLabel, number[]>>` — indices de **token (mot)** après lesquels insérer un `<br>`, pour wrapper une cellule **single-value longue** (ex. MOA = « Ministère de l'Éducation nationale »). Tokens = `value.split(/\s+/)`. UI : section *Sauts de ligne intra-valeur*, visible uniquement pour les cellules single-value > 10 caractères + ≥ 2 tokens (MOA, Bailleur, Architecte, BET associés, Entreprise). Rendu dans `renderValues()` (branche `values.length === 1`).
- ⚠ Les toggles de sauts de ligne reconstruisent toujours un **nouvel objet** `cells` (pas de `delete` mutatif) pour garantir que React détecte le changement — sinon l'aperçu ne se mettait pas à jour à l'annulation d'un saut. `TemplatePreview` porte aussi une `key` (hash du HTML) sur l'`<iframe>` pour forcer le remount au changement de contenu.

#### Mots-clés (position figée dans le bandeau d'en-tête)

Les mots-clés (`Projet.motsCles`, depuis Airtable « Mots-clés ») sont rendus **dans le bandeau d'en-tête, sous le statut**, par `headerHtml()` dans `lib/pdf/templates/shared.ts` — pour **tous** les templates (Solo / Diptyque / Triptyque / Str-Env / Dev).

- Format : `#tag#tag` concaténé, sans séparateur.
- Couleur : `#30323E`. Style : classe CSS `.t-header-keywords`.
- L'overlay flottant historique (`ManualConfig.keywords` avec sliders X/Y) est **désactivé** dans `manuel.ts` et `dev.ts`. La section "Mots-clés" a aussi été retirée de `LayoutSidebar` (cf. *Éditeur de fiche* plus bas). La config legacy `ManualConfig.keywords` reste chargée depuis Airtable pour rétro-compat des fiches existantes, mais elle n'est plus ni modifiable depuis l'UI ni rendue dans le PDF — à considérer comme `@deprecated` côté `manualConfig.ts`.

### Éditeur de fiche (`ProjetView` + `ProjetToolbar` + `LayoutSidebar`)

- **Sidebar gauche** (`components/projet/LayoutSidebar.tsx`) : uniquement affichée pour les templates **Str-Env** et **Dev**. En haut de la nav : boutons **Éditer les champs** (lien vers `/projet/[slug]/edit`) + **Recadrer les photos** (toggle `cropEditMode`). En dessous, les sections accordion (Mise en page typographique, Photo principale, Texte description, Photos additionnelles, Certifications, [Dev] Prestation Assemblage).
- Pour les templates **Solo / Diptyque / Triptyque** : pas de sidebar — le bouton "Éditer les champs" reste dans la toolbar du haut (`ProjetToolbar`).
- **Modale unsaved-changes** : `ProjetView` calcule `isDirty = JSON.stringify({manualConfig, bandeauConfig, photoCrops}) !== initialSnapshot` (via `useRef` + `useMemo`). Le clic sur "← Portfolio" déclenche une modale dans `ProjetToolbar` si `isDirty`, avec deux options : *Quitter sans sauvegarder* / *Sauvegarder la mise en page*. Le snapshot est réinitialisé après chaque save réussi (callback `onSave`).
- **Préréglages auto sur fiches "Pas faite"** : si `ficheStatus === 'Pas faite'` ET aucune config sauvegardée (`savedManualConfig` + `bandeauConfig` absents/vides), `ProjetView` charge `ASSEMBLAGE_DEFAULT_MANUAL` + `ASSEMBLAGE_DEFAULT_BANDEAU` (`lib/pdf/assemblageDefaults.ts`) comme state initial. Le snapshot `isDirty` est initialisé avec ces mêmes valeurs → pas de "modifications non sauvegardées" parasite à l'ouverture. Rien n'est écrit en Airtable tant que l'utilisateur ne sauvegarde pas. (Le défaut du statut PDF est font-size 10pt.) Les valeurs précises des préréglages vivent **en dur** dans `assemblageDefaults.ts` (pas d'édition runtime) ; le bouton « Réinitialiser » du panneau de mise en page les applique en aperçu. Pour les **propager en masse** dans Airtable sur toutes les fiches « Pas faite », l'admin dispose du bouton dédié dans `/admin` (cf. `/api/admin/apply-defaults`).
- **Slider de taille photo grisé à saturation** : `LayoutSidebar` mesure la taille naturelle de chaque photo (`useImageNaturalSize`) ; si la photo est plus petite que son conteneur (≈186mm de large), le slider Taille est grisé au-delà du % où la photo atteint sa taille naturelle (helper `photoSaturationPercent`, conversion px→mm à 96 DPI). Couvre la photo principale paysage + les photos additionnelles.
- **Prestation Assemblage (Dev) en 2 colonnes** : `PrestationAssemblageConfig` expose `col1Percent`/`col2Percent` (sliders en mode 2-col). `col1=100` + `col2=0` → tout le texte dans la colonne 1 (largeur = demi-page, col 2 vide). Rendu via `splitDescription` dans `dev.ts` (grille `dev-presta--2col-split`).

### Vue admin / user (`lib/auth/useViewMode.ts`)

Hook `useViewMode()` → `{ viewMode: 'admin' | 'user', setViewMode, canSwitch }`.
- Les profils Supabase `role: 'user'` sont **forcés** sur `'user'` (`canSwitch: false`).
- Les admins ont `'admin'` par défaut mais peuvent basculer vers `'user'` (prévisualisation), choix persisté dans `localStorage` sous `_portfolio_view_mode`. Toggle "Vue : Admin/User" dans `ProjetToolbar`, visible uniquement si `canSwitch`.
- **Restriction côté UI uniquement** (pas de gate serveur — les routes restent protégées par `requireApprovedUser` + RLS).

#### Structure du panneau bandeau (`BandeauConfigPanel`)

Le panneau (rendu dans la section « Mise en page typographique » de la sidebar) est organisé ainsi :
- **Premier niveau (admin uniquement)** : bouton Réinitialiser + sections typo hors bandeau — *Titre de la fiche*, *Statut*, *Description projet*, *Prestation Assemblage* (`TOP_SECTION_KEYS`).
- **Sous-menu déroulant « Bandeau »** (`<details open>`) :
  - **admin** : *Libellés* / *Valeurs* / *Sous-titre du Programme* (`BANDEAU_SECTION_KEYS`) + *Cellules du bandeau* + *Cellule Programme* + *Lignes horizontales* + *Espacement titre ↔ bandeau* + *Espacement photo ↔ description* + *Espacement photo ↔ bandeau* + *Activer/désactiver les champs*.
  - **user** : uniquement *Cellules du bandeau* + *Cellule Programme* + les 3 espacements + *Activer/désactiver les champs* (pas de sections typo, pas de lignes horizontales, pas de Réinitialiser).
- **Espacement photo ↔ bandeau** : `BandeauConfig.bandeauPhotoGap` (0..100, 50 neutre) → `bandeauPhotoGapCss` applique un `margin-bottom` sur `.t-bandeau-wrap` (écart bandeau↔photo). Pendant la même famille que `titleMetaGap`/`photoTextGap`.
- **Activer/désactiver les champs** : `BandeauConfig.hiddenCells: MetaLabel[]` — libellés masqués au rendu (filtrés dans `metaGridHtml`). L'UI ne propose que **BET associés**, **Programme**, **Matériaux** (pour réduire la largeur du bandeau), mais le modèle accepte n'importe quel `MetaLabel`.

### Builders WordPress

Indépendants du système de templates PDF. `lib/wordpress/builders.ts` (Editorial — utilisé en production) + `buildersV2.ts` (Magazine — endpoint vivant côté serveur via `variant: 'v2'` dans `publish/route.ts`, mais bouton UI masqué dans `ProjetToolbar` ; gardé pour ré-activation rapide). HTML inline-stylé autonome (pas de classes CSS externes) pour être embarqué dans WordPress tel quel.

⚠ **Ne pas modifier ces fichiers sans demande explicite portant sur l'export WordPress.**

#### Aperçu & stylisation WordPress (`WpConfig`)

`buildWpContent(projet, coverUrl, photoUrls, wpConfig?)` accepte une config optionnelle **`WpConfig`** (`lib/wordpress/wpConfig.ts`) qui pilote :
- **deux templates WP** dérivés de la **Vignette pôle** (`fld1PZuYO8mz0sULA`) via `wpTemplateFor(projet.vignettePoles)` : `DEV` ⇒ **Dev**, sinon **Str-Env**. Le bandeau et l'ordre des champs **miroir du bandeau PDF** (`metaGridHtml`), mais **Budget et Surface restent deux cellules distinctes** : `WP_FIELDS_STR_ENV` (MOA · Architecte · BET associés · Budget · Surface · Entreprise · Mission AI · Programme · Matériaux) et `WP_FIELDS_DEV` (MOA · Bailleur · Architecte · Budget · Surface · Programme · Matériaux · Mission AI · BET associés). Le template Dev rend en plus le bloc « Prestation Assemblage » ;
- **typographie globale** (tailles description / champs clés / pitch / titre section, interlignage) ;
- **typographie par champ du bandeau** (`fields`) : libellé et valeur stylés **indépendamment** (gras, **couleur**, **taille `sizePt`**, **petites capitales `smallCaps`** et **grandes capitales `upperCase`** sur la valeur — ex. Mission AI), via défauts globaux (`labelBold:false`, `valueBold:true`) + surcharges par clé `WpFieldKey` (`overrides`). Défaut : libellé « Mission AI » en rouge, valeur en noir. Couleurs = **palette Assemblage** (`ASSEMBLAGE_PALETTE`). Helper `effectiveFieldStyle(resolved, key)`. Rendu en deux `<span>` (resets `!important` anti-thème ; `text-transform` et `font-variant` définis par span). La clé **`programmeSecondaire`** n'est PAS une cellule autonome : sa valeur est rendue dans la cellule **Programme principal**, après le principal, séparée d'un **point médian `·`**, avec sa propre typo (gras/couleur/taille/caps) — elle apparaît dans l'UI uniquement pour exposer ces options ;
- **espacements** (`spacing`) : titre ↔ accroche (marge au-dessus du contenu — le titre est rendu par le thème WP), accroche ↔ photo, photo ↔ description. Sliders dans la section « Espacements » de la sidebar ;
- **catégories WordPress (taxonomie)** : depuis le champ Airtable multi-select **« Tags export WP »** (`fld2y9rIk9DVEf9eo` → `projet.tagsExportWp`, lu par field ID dans `fetchAuxByFieldId`). À l'export, `ensureCategoryIds()` résout chaque nom en ID de catégorie WP (créée si absente) et `publish/route.ts` envoie `categories` dans le payload → le post a ses catégories cochées (le thème les affiche au-dessus du titre). **Plus de rendu de catégories dans le HTML du contenu** ;
- **disposition photos** (`photos`) — ratio couverture, pleine largeur, **choix de la photo couverture par filename** (sinon défaut Airtable), **cadrage horizontal/vertical** de la couverture (`object-position`, sliders 5 %), colonnes galerie (0–4, 0 = auto), ratio et gap galerie, **slots ordonnés de galerie** (`gallery[]` : photoIndex pointant vers `[cover, ...photosProjet]` + `sizePercent` + `offsetX/Y` + `enabled`, modèle calqué sur « Photos additionnelles » des fiches PDF), **position du bloc « Prestation Assemblage »** pour le template Dev (`prestationPosition` : `before-description` / `after-description` (défaut) / `after-photos`). `buildWpContent(projet, cover, gallery, wpConfig?)` reçoit des objets `WpPhoto = { url, filename }` — le filename est préservé après upload WP. Si `photos.gallery` est vide → fallback historique (toutes les photos sauf la couverture).

`DEFAULT_WP_CONFIG` est le **rendu de référence** (libellés non gras, valeurs en gras, « Mission AI » libellé rouge).

- **Persistance** : `WpConfig` vit sous la clé `wp` du `ProjectConfig` unifié (même champ Airtable « Config template manuel » que `bandeau`/`manuel`), exposé en `Projet.wpConfig`. Écrit via la route `/fields` (`wpConfig` ∈ `FICHE_ONLY_FIELDS`). `publish/route.ts` passe `projet.wpConfig` au builder.
- **Page de preview dédiée** : `/projet/[slug]/wordpress` (`components/projet/WordpressView` + `WpLayoutSidebar` + `WordpressPreview`). L'aperçu exécute `buildWpContent` **côté client** avec les URLs Airtable et l'injecte en `srcDoc` (pas d'export PDF, pas d'upload WP pour l'aperçu). Bouton « Aperçu WordPress » dans `ProjetToolbar` ; « Éditer les champs » (rich-text Description projet → `/projet/[slug]/edit`) est dans la **sidebar WP**.
- **Liens CRM** : `crmCellHtml()` rend MOA / Architecte / BET associés / Entreprise / Bailleur en `<a target="_blank">` **sans soulignement** quand l'`URL site` existe (cf. `Projet.crmLinks`), fallback texte sinon. `safeHref()` n'autorise que http(s).

### WordPress

- `lib/wordpress/client.ts` : upload media (stream binaire depuis l'URL Airtable) + create/update post via REST API + helpers `findPublishedPostBySlug`, `getPostContent`, `extractWpPostId`
- **Authentification : Basic auth** avec `WP_USER` + `WP_APP_PASSWORD` (Application Password WordPress, espaces retirés)
- Seules les URLs d'images provenant de `*.airtable.com` / `*.airtableusercontent.com` sont autorisées (SSRF guard dans `publish/route.ts`)

#### Workflow draft → preview → promotion en production

L'export ne touche **jamais** à un post WordPress existant — il crée systématiquement un nouveau brouillon. La promotion vers la production est une action explicite, séparée.

1. **Export WP 1** (`/api/projet/[slug]/publish`) — crée un nouveau draft. WP suffixe automatiquement les slugs en collision (`la-maison-sur-le-fleuve` → `-2` → `-3`…). Le post apparaît systématiquement dans `/wp-admin/edit.php`. L'URL Airtable `urlWordpress` est mise à jour pour pointer sur ce dernier draft. Réponse inclut `previousUrl` pour rappeler à l'utilisateur l'ancien draft à nettoyer manuellement.
2. **Itération** — l'utilisateur peut relancer Export WP 1 autant de fois qu'il veut. Chaque export = un nouveau draft. Les drafts précédents restent en place et doivent être supprimés manuellement par l'utilisateur depuis WP admin.
3. **Mettre à jour la production** (`/api/projet/[slug]/update-prod`) — quand un draft est validé visuellement, ce bouton lit le contenu du dernier draft (URL trackée dans `urlWordpress`), recherche le post de production par slug (`GET /posts?slug=<slug>&status=publish&per_page=1`), et fait un `POST /posts/{prodId}` pour remplacer title/content/excerpt/featured_media. Le statut publish est préservé, l'URL SEO de la production est préservée. Si aucune version publiée n'existe (404), l'utilisateur doit publier un draft manuellement dans WP admin avant de pouvoir utiliser ce bouton.

**Important** : par construction, le code n'envoie **jamais** `status: 'trash'` ni `DELETE`. Aucun export ne peut mettre un post existant à la corbeille.

### PDF

En développement : Puppeteer bundled. En production / Lambda : `@sparticuz/chromium` + `puppeteer-core` (activé par `NODE_ENV=production` ou `USE_CHROMIUM_LAMBDA=true`).

L'aperçu en ligne (`/projet/[slug]`) utilise le **même HTML** que l'export PDF, rendu dans une iframe via `srcDoc` (cf. `components/TemplatePreview.tsx`). Donc tout changement dans `lib/pdf/templates/` se voit dans le preview ET dans le PDF téléchargé.

### Description rich text (Markdown)

Le champ Airtable `Description projet` est en mode "Texte enrichi" depuis 2026 — Airtable retourne du Markdown GFM (`**gras**`, `*italique*`, listes `-`, liens, etc.).

- **Rendu** : `lib/utils/markdown.ts` exporte `renderMarkdown(md)` qui utilise l'instance globale `marked` (avec `gfm: true, breaks: true`). Tous les templates PDF + builders WP passent par cette fonction.
- **Édition** : `components/projet/RichTextEditor.tsx` est un contenteditable avec toolbar B/I/U/listes/lien. Convertit HTML→Markdown au save via `turndown` (avec `keep:['u']` pour préserver le `<u>` souligné non standard), Markdown→HTML à l'init via `marked`.
- **Round-trip** : le markdown est stocké tel quel dans Airtable. Pas de transformation lossy entre l'édition et la lecture.
- **Césure contrôlée** : `injectSoftHyphensFr(html)` insère un soft hyphen (U+00AD) à 2 caractères de la fin de chaque mot ≥ 6 lettres, en respectant les balises HTML. Combiné à `hyphens: manual` sur `.t-texte-md`, le navigateur ne coupe les mots **que** sur ces marqueurs → l'orphelin laissé sur la ligne suivante fait toujours exactement 2 caractères. Appliqué sur **tous les templates** qui rendent la description (`descriptionHtml` dans `shared.ts` + `triptyque.ts` + `paragraphsToHtml` de `manuel.ts`/`dev.ts`).

### Résolution CRM (linked records)

Les champs `Maître d'ouvrage`, `Architecte`, `Mandataire`, `Entreprise`, `BET associés` et `Bailleur` pointent tous vers une table synchronisée `Sync CRM` dans la base portfolio (sync depuis la base externe `CRM AI`).

`lib/airtable/crm.ts → fetchCrmNames(recordIds)` interroge la table définie par `AIRTABLE_CRM_TABLE_NAME` (par défaut sur `AIRTABLE_BASE_ID`, fallback `AIRTABLE_CRM_BASE_ID`) avec un filter `OR(RECORD_ID()='rec1', …)` et retourne une `Map<id → { nom, url }>` (le `url` vient de la colonne **`URL site`**, lue **par nom** — la table synced réattribue les field IDs, le field id source `fldzJMJZ4fTx3JgOu` est inutilisable ici). Le mapper résout chaque champ via `resolveCrm(field, crmNames)` (string jointe des noms, **fallback string** legacy) et, en parallèle, `resolveCrmLinks(field, crmNames)` qui produit `Projet.crmLinks` (`{ name, url }[]` par champ) pour les **liens hypertexte** de l'export WordPress.

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

**Style des tuiles & panneaux (home)** : la vue grille rend des tuiles uniformes — zone image en `aspect-ratio: 16/10`, `height: 100%` sur le `<Link>` + `flex-direction: column` sur la carte pour égaliser les hauteurs d'une même rangée, année/pôle poussés en pied via `margin-top: auto`. Hiérarchie d'arrondis : conteneurs (panneau filtres, sidebar « État de publication », vue liste, tuiles) = **12px** ; boutons d'action + input recherche = **8px** ; pills de filtre + badges de statut = **6px**.

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
