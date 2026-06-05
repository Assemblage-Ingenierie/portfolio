import type { Projet } from '@/types/projet';
import { renderMarkdown, injectSoftHyphensFr } from '@/lib/utils/markdown';
import { styleToCss, linesToCss, titleMetaGapCss } from '@/lib/pdf/bandeauConfig';
import { croppedPhotoHtml, isMeaningfulCrop, photoCropKey } from '@/lib/pdf/photoCrop';

export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const FONTS_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,300;1,6..72,400;1,6..72,500&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet">`;

/**
 * CSS commun à tous les templates :
 * - règle @page A4 sans marge (les marges sont gérées par chaque template)
 * - reset, variables couleurs/fonts
 * - photo-frame / photo-img : contraintes images (jamais agrandir, ratio préservé)
 */
export const SHARED_CSS = `
@page { size: A4; margin: 0; }

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: white; }

:root {
  --ai-rouge: #E30513;
  --ai-violet: #30323E;
  --ai-gris: #DFE4E8;
  --ai-gris-tres-clair: #F2F2F2;
  --ai-noir70: #4D4D4D;
  --ai-noir: #000000;
  --serif: 'Newsreader', Georgia, serif;
  --sans: 'Open Sans', system-ui, sans-serif;
}

/* Page A4 fixe : 210 × 297 mm. Tout le contenu d'un template doit tenir
   strictement dans cette boîte (footer inclus). overflow: hidden garantit
   qu'aucun débordement n'engendre une 2e page à l'impression. */
.page {
  width: 210mm;
  height: 297mm;
  background: white;
  position: relative;
  overflow: hidden;
  /* Pas de saut après cette page : éviter la page blanche surnuméraire */
  page-break-after: avoid;
  break-after: avoid;
  page-break-inside: avoid;
  break-inside: avoid;
}

/* Photo : ratio préservé, shrink-only, jamais d'agrandissement.
   Fond transparent pour que les éventuelles marges (différences de ratio)
   se fondent dans la page sans bandes grises visibles. */
.photo-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  overflow: hidden;
}
.photo-img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  display: block;
  object-fit: contain;
}

/* Wrapper bandeau (Manuel / Dev uniquement) : regroupe header + titre +
   meta-grid pour leur appliquer un translateY commun via slider. Préserve
   l'espacement interne 4mm identique au flex .man-page / .dev-page. */
.t-bandeau-wrap {
  display: flex;
  flex-direction: column;
  gap: 4mm;
  flex: 0 0 auto;
}

/* Header / Footer communs */
.t-header {
  display: flex;
  justify-content: space-between;
  /* flex-end : les vignettes (gauche) sont alignées en bas, donc sur la
     même ligne que les mots-clés (ligne basse de la colonne droite).
     La hauteur du bandeau reste pilotée par la hauteur des vignettes
     (10mm) — la colonne droite est plus courte, pas d'augmentation. */
  align-items: flex-end;
  border-bottom: 1px solid var(--ai-rouge);
  padding-bottom: 3mm;
  font-family: var(--sans);
}
/* Colonne droite du bandeau : statut + mots-clés, alignés à droite. */
.t-header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}
/* Bandeau d'en-tête : 3 vignettes pôle (STR / ENV / DEV) à gauche,
   statut + année à droite. La vignette correspondant au pôle du projet
   est colorée, les autres restent en blanc (silhouette). */
.t-header-vignettes {
  display: flex;
  align-items: center;
  gap: 1.5mm;
}
.t-header-vignette {
  height: 10mm;
  width: auto;
  display: block;
}
/* Vignettes inactives : un seul état visuel, gris à intensité réglable.
   Le filtre grayscale neutralise les couleurs SVG d'origine ; la brightness
   contrôle l'intensité du gris obtenu. La variable CSS permet un slider de
   réglage temporaire dans l'aperçu (à supprimer une fois la valeur
   définitive choisie). */
.t-header-vignette--inactive {
  filter: grayscale(100%) brightness(1.90);
}
/* Libellé Réhabilitation / Neuf à droite de la vignette correspondante */
.t-header-rn-label {
  font-family: var(--sans);
  font-size: 10pt;
  font-weight: 600;
  color: var(--ai-noir);
  letter-spacing: 0.02em;
  margin-left: 1mm;
}
/* Variante 2 lignes quand "Neuf" ET "Rehab" sont cochés : Neuf au-dessus
   de Réhabilitation, taille réduite et interligne serré pour rester dans
   la hauteur des vignettes (~10mm). */
.t-header-rn-label--stacked {
  font-size: 8.5pt;
  line-height: 1.1;
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  gap: 2.2mm;
}
.t-header-meta {
  font-size: 9pt; font-weight: 400;
  letter-spacing: 0.06em; font-variant: small-caps;
  color: var(--ai-noir70);
}
.t-header-statut {
  font-size: 9pt; font-weight: 500;
  letter-spacing: 0.06em;
  color: var(--ai-rouge);
}
/* Mots-clés sous le statut — position figée pour toutes les fiches.
   Format : #tag#tag concaténé sans séparateur. Couleur #30323E. */
.t-header-keywords {
  font-family: var(--sans); font-size: 8.5pt; font-weight: 400;
  letter-spacing: 0.02em; color: #30323E;
  margin-top: 1mm;
  text-align: right;
}

/* Footer retiré du template — fonction footerHtml() renvoie '' désormais.
   On garde les classes vides au cas où on réintroduirait un footer plus tard. */
.t-footer { display: none; }

/* Titre + identité */
.t-surtitre {
  font-family: var(--sans); font-size: 9pt; font-weight: 600;
  color: var(--ai-noir70); letter-spacing: 0.05em;
  margin-bottom: 2mm;
}
/* Rangée Lieu (gauche) + Mission AI (droite) — Str-Env / Dev uniquement.
   Mission AI sort du bandeau et s'inscrit en face du Lieu, au-dessus du titre. */
.t-surtitre-row {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-bottom: 2mm;
}
.t-surtitre-row .t-surtitre { margin-bottom: 0; }
.t-surtitre-mission {
  font-family: var(--sans); font-size: 9pt; font-weight: 600;
  color: var(--ai-rouge); letter-spacing: 0.05em;
  margin-left: auto; white-space: nowrap;
}
.t-h1 {
  font-family: var(--serif); font-weight: 500;
  color: var(--ai-noir); letter-spacing: -0.015em;
  margin-bottom: 2.5mm;
}
.t-pitch {
  font-family: var(--serif); font-size: 12pt; font-weight: 300;
  line-height: 1.35; color: var(--ai-noir70);
  font-style: italic;
}

/* Bandeau métadonnées (MOA, architecte, budget, surface, année) */
.t-meta-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  border-top: 1px solid var(--ai-noir);
  border-bottom: 1px solid var(--ai-noir);
  padding: 2.5mm 0;
}
.t-meta-item {
  padding: 0 3mm;
}
.t-meta-item:first-child { padding-left: 0; }
.t-meta-item:last-child { padding-right: 0; }
.t-meta-label {
  font-family: var(--sans); font-size: 8.5pt; font-weight: 400;
  letter-spacing: 0.06em;
  color: var(--ai-rouge);
  margin-bottom: 1mm; display: block;
}
.t-meta-value {
  font-family: var(--serif); font-size: 11pt; font-weight: 400;
  line-height: 1.25; color: var(--ai-noir);
}
.t-meta-sub {
  font-family: var(--sans); font-size: 8pt; font-weight: 400;
  color: var(--ai-noir70); margin-top: 0.5mm;
}

/* Description / texte courant */
.t-texte-p {
  font-family: var(--sans); font-size: 9.5pt; font-weight: 400;
  line-height: 1.5; color: var(--ai-noir);
  margin-bottom: 2.5mm;
}
/* Bloc markdown rendu (description rich text Airtable) — défaut design
   system : Open Sans 9pt (modifiable via BandeauConfig.description). */
/* Description : césure limitée. hyphens:manual n'autorise les coupures
   QUE sur les soft hyphens (U+00AD) injectés par injectSoftHyphensFr() — qui
   place un seul soft hyphen à 2 caractères de la fin de chaque mot >= 6
   lettres. Résultat : le navigateur ne coupe un mot que si nécessaire et
   toujours en laissant un orphelin de 2 caractères max sur la ligne suivante. */
.t-texte-md { font-family: var(--sans); font-size: 9pt; line-height: 1.5; color: var(--ai-noir); hyphens: manual; -webkit-hyphens: manual; }
.t-texte-md p { margin: 0 0 2.5mm; }
.t-texte-md p:last-child { margin-bottom: 0; }
.t-texte-md strong { font-weight: 700; }
.t-texte-md em { font-style: italic; }
.t-texte-md a { color: var(--ai-rouge); text-decoration: underline; }
.t-texte-md ul, .t-texte-md ol { margin: 0 0 2.5mm 5mm; padding: 0; }
.t-texte-md li { margin-bottom: 0.8mm; }
.t-texte-md h1, .t-texte-md h2, .t-texte-md h3 {
  font-family: var(--serif); font-weight: 600; margin: 3mm 0 1.5mm;
}
.t-texte-md h1 { font-size: 13pt; }
.t-texte-md h2 { font-size: 12pt; }
.t-texte-md h3 { font-size: 11pt; }
.t-texte-md blockquote {
  border-left: 2px solid var(--ai-rouge);
  padding-left: 3mm; margin: 0 0 2.5mm; font-style: italic; color: var(--ai-noir70);
}
.t-texte-md code {
  font-family: monospace; font-size: 9pt;
  background: var(--ai-gris-tres-clair); padding: 0.5mm 1mm;
}
.t-texte-md--inline p { display: inline; margin: 0; }
.t-texte-cols-2 { column-count: 2; column-gap: 6mm; column-rule: 1px solid var(--ai-gris); }
.t-texte-cols-2 p, .t-texte-cols-2 .t-texte-p { break-inside: avoid; }
`;

// Vignettes pôle hébergées sur Supabase Storage (bucket public "Branding",
// sous-dossier "vignettes svg"). Un seul fichier SVG par pôle : les états
// "blanc" et "grisé" sont obtenus par filtre CSS (cf. CSS ci-dessus).
// Ordre fixe STR · ENV · DEV.
const VIGNETTE_BASE =
  'https://hhkofvbptnrtwbazftlm.supabase.co/storage/v1/object/public/Branding/vignettes%20svg';
const VIGNETTE_PNG_BASE =
  'https://hhkofvbptnrtwbazftlm.supabase.co/storage/v1/object/public/Branding/vignettes';
const VIGNETTES: ReadonlyArray<{ code: string; url: string }> = [
  { code: 'STR', url: `${VIGNETTE_BASE}/STR.svg` },
  { code: 'ENV', url: `${VIGNETTE_BASE}/ENV.svg` },
  { code: 'DEV', url: `${VIGNETTE_BASE}/DEV.svg` },
];

// Vignettes Rehab / Neuf — affichées à droite des 3 vignettes pôle.
// SVG dans le même sous-dossier "vignettes svg" du bucket Branding.
// Comportement d'affichage (selon le champ multi-select "Rehab / Neuf") :
//   - "Neuf" seul → vignette Neuf + label "Neuf"
//   - "Rehab" seul → vignette Réhabilitation + label "Réhabilitation"
//   - les deux → vignette Neuf + vignette Réhabilitation côte à côte, puis
//     un label sur 2 lignes (Neuf au-dessus de Réhabilitation).
const REHAB_NEUF_VIGNETTE: Record<'rehab' | 'neuf', { url: string; label: string }> = {
  rehab: { url: `${VIGNETTE_BASE}/Rehabilitation.svg`, label: 'Réhabilitation' },
  neuf:  { url: `${VIGNETTE_BASE}/Neuf.svg`,           label: 'Neuf' },
};

/**
 * Formate une période "YYYY - YYYY" à partir de deux dates ISO (YYYY-MM-DD).
 * Si les deux années sont identiques, affine au mois : "MM/YYYY - MM/YYYY".
 * Retourne `null` si aucune des deux dates n'est utilisable.
 */
function formatPortfolioPeriod(start?: string, end?: string): string | null {
  const re = /^(\d{4})-(\d{2})-\d{2}/;
  const ms = start ? re.exec(start) : null;
  const me = end ? re.exec(end) : null;
  if (!ms && !me) return null;
  const ys = ms?.[1];
  const ye = me?.[1];
  // Si une seule borne est connue, on l'affiche seule (pas de séparateur).
  if (ys && !ye) return ys;
  if (ye && !ys) return ye;
  if (ys && ye) {
    if (ys === ye && ms && me) {
      return `${ms[2]}/${ys} – ${me[2]}/${ye}`;
    }
    return `${ys} – ${ye}`;
  }
  return null;
}

/** Construit l'HTML des vignettes pôle (STR/ENV/DEV) + Rehab/Neuf — partagé
 *  entre le rendu header standard et le rendu Dev (période). */
function buildHeaderVignettes(projet: Projet): string {
  // Source de vérité : champ multi-select "Vignette pôle". Si absent ou vide,
  // on retombe sur le champ legacy `pole` (single-select) pour rétro-compat.
  const selectedRaw = (projet.vignettePoles && projet.vignettePoles.length > 0)
    ? projet.vignettePoles
    : projet.pole ? [projet.pole] : [];
  const selected = new Set(selectedRaw.map((s) => s.toUpperCase()));

  const vignettes = VIGNETTES.map((v) => {
    const active = selected.has(v.code);
    const cls = active
      ? 't-header-vignette'
      : 't-header-vignette t-header-vignette--inactive';
    return `<img class="${cls}" src="${v.url}" alt="${v.code}" />`;
  }).join('');

  const rn = (projet.rehabNeuf ?? '').toLowerCase();
  const hasRehab = rn.includes('rehab') || rn.includes('réhab');
  const hasNeuf = rn.includes('neuf');
  const rnKeys: ('neuf' | 'rehab')[] = [];
  if (hasNeuf)  rnKeys.push('neuf');
  if (hasRehab) rnKeys.push('rehab');
  const rehabNeufHtml = rnKeys.length > 0
    ? `${rnKeys.map((k) => `<img class="t-header-vignette" src="${REHAB_NEUF_VIGNETTE[k].url}" alt="${REHAB_NEUF_VIGNETTE[k].label}" />`).join('')}
       <span class="t-header-rn-label${rnKeys.length > 1 ? ' t-header-rn-label--stacked' : ''}">${rnKeys.map((k) => `<span>${esc(REHAB_NEUF_VIGNETTE[k].label)}</span>`).join('')}</span>`
    : '';

  return `${vignettes}${rehabNeufHtml}`;
}

export function headerHtml(projet: Projet, options?: { isDev?: boolean }): string {
  const statusStyle = styleToCss(projet.bandeauConfig?.status);
  const vignettesHtml = buildHeaderVignettes(projet);

  // Mots-clés en position figée sous le statut. Le « # » sert de séparateur
  // entre les tags (pas de # en tête), en couleur #30323E. Ex. tag1#tag2#tag3.
  // Affiché pour toutes les fiches.
  const keywordsHtml = (projet.motsCles && projet.motsCles.length > 0)
    ? `<div class="t-header-keywords">${projet.motsCles.map((k) => esc(k)).join('#')}</div>`
    : '';

  // Template Dev : affiche la période de prestation au lieu du statut + année.
  // Source : ProjectConfig.portfolio.{date_demarrage,date_fin_estimee}
  // (champ Airtable "Config template manuel"). Si absente, on retombe sur
  // le rendu historique (statut + année).
  if (options?.isDev) {
    const period = formatPortfolioPeriod(
      projet.portfolioPeriod?.dateDemarrage,
      projet.portfolioPeriod?.dateFinEstimee,
    );
    if (period) {
      return `<header class="t-header">
        <div class="t-header-vignettes">${vignettesHtml}</div>
        <div class="t-header-right">
          <div class="t-header-statut"${statusStyle ? ` style="${statusStyle}"` : ''}>Période : ${esc(period)}</div>
          ${keywordsHtml}
        </div>
      </header>`;
    }
  }

  // Année placée dans le bandeau de statut, à la suite de l'état du chantier.
  const annee = projet.anneeLivraison ? ` · ${esc(String(projet.anneeLivraison))}` : '';
  return `<header class="t-header">
    <div class="t-header-vignettes">${vignettesHtml}</div>
    <div class="t-header-right">
      <div class="t-header-statut"${statusStyle ? ` style="${statusStyle}"` : ''}>● ${esc(projet.statut)}${annee}</div>
      ${keywordsHtml}
    </div>
  </header>`;
}

/**
 * Footer désactivé : retourne une chaîne vide. La fonction est conservée
 * (signature inchangée) pour ne pas avoir à modifier chaque template — un
 * footer plus tard pourra être réintroduit ici si besoin.
 */
export function footerHtml(_projet: Projet): string {
  return '';
}

/** Split un CSV CRM ("Studio A, Studio B") en array. NB : si un nom CRM
 *  contient une virgule (rare), il sera coupé — tradeoff accepté. Pour
 *  un split sûr, exposer un *Values array depuis le mapper. */
function splitCsv(v: string | undefined): string[] {
  if (!v) return [];
  return v.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
}

/** Collapse "AMO ENV" / "AMO DEV" → "AMO" dans une liste de Mission AI.
 *  Si l'une de ces deux valeurs (ou les deux) est présente, on les retire
 *  et on insère un seul "AMO" à leur place (en préservant l'ordre relatif).
 *  Les autres valeurs (ex. "MOE", "OPC") passent inchangées. */
function collapseAmoMissionAi(values: string[]): string[] {
  const out: string[] = [];
  let amoInserted = false;
  for (const v of values) {
    if (v === 'AMO ENV' || v === 'AMO DEV') {
      if (!amoInserted) { out.push('AMO'); amoInserted = true; }
      continue;
    }
    out.push(v);
  }
  return out;
}

/** Valeurs Mission AI résolues (collapse AMO appliqué), prêtes à l'affichage.
 *  Source : `missionAiValues` si présent, sinon split CSV de `missionAi`. */
function missionAiResolved(projet: Projet): string[] {
  const raw = projet.missionAiValues && projet.missionAiValues.length > 0
    ? projet.missionAiValues
    : splitCsv(projet.missionAi);
  return collapseAmoMissionAi(raw);
}

export function titleBlockHtml(
  projet: Projet,
  h1Size = '32pt',
  options?: { showMissionAi?: boolean },
): string {
  // Surcharge typographique du titre (BandeauConfig.titre). Si l'utilisateur
  // définit fontSize, on l'applique en remplacement du défaut du template.
  const titreOverride = styleToCss(projet.bandeauConfig?.titre);
  const baseStyle = `font-size:${h1Size}; line-height:1.05`;
  const h1Style = titreOverride ? `${baseStyle}; ${titreOverride}` : baseStyle;

  // Ligne Mission AI (Str-Env / Dev uniquement) : inscrite en face du Lieu,
  // justifiée à droite, au-dessus du titre. Open Sans, taille du Lieu, rouge
  // du statut. Sort la cellule du bandeau (cf. metaGridHtml { hideMissionAi }).
  const missionAiVals = options?.showMissionAi ? missionAiResolved(projet) : [];
  let surtitre: string;
  if (options?.showMissionAi && missionAiVals.length > 0) {
    surtitre = `<div class="t-surtitre-row">
      <span class="t-surtitre">${projet.lieu ? esc(projet.lieu) : ''}</span>
      <span class="t-surtitre-mission">Mission AI : ${esc(missionAiVals.join(', '))}</span>
    </div>`;
  } else {
    surtitre = projet.lieu ? `<div class="t-surtitre">${esc(projet.lieu)}</div>` : '';
  }

  return `<div class="t-title-block">
    ${surtitre}
    <h1 class="t-h1" style="${h1Style}">${esc(projet.nom)}</h1>
    ${projet.pitch ? `<p class="t-pitch">${esc(projet.pitch)}</p>` : ''}
  </div>`;
}

export function metaGridHtml(
  projet: Projet,
  options?: { isDev?: boolean; hideMissionAi?: boolean },
): string {
  // Chaque cellule porte un array de valeurs (1 ou plus). Cela permet de
  // contrôler le séparateur (virgule inline OU saut de ligne <br>) par
  // valeur via `bandeauConfig.cells.breaks[label]`. Pour les cellules
  // mono-valeur (Budget, Surface, Programme via value/sub), l'array
  // contient un seul élément et aucun break ne s'applique.
  // NB : `splitCsv` et `collapseAmoMissionAi` sont désormais des helpers de
  // module (partagés avec titleBlockHtml).
  const items: { label: string; values: string[]; sub?: string }[] = [];

  // Programme : principal en valeur principale, secondaire en sous-titre.
  // Helper utilisé par les deux templates.
  // L'utilisateur peut choisir de masquer le secondaire via
  // `bandeauConfig.programme.hideSecondaire` — la cellule n'affiche alors
  // que le principal, sans sous-titre. Si aucun principal n'est rempli
  // dans ce cas, la cellule disparaît entièrement.
  // Note : la logique value/sub historique est PRÉSERVÉE — pas de breaks
  // applicables sur cette cellule (le sub reste rendu dans .t-meta-sub).
  const hideSecondaire = projet.bandeauConfig?.programme?.hideSecondaire === true;
  const effectiveSecondaire = hideSecondaire ? undefined : projet.programmeSecondaire;
  const programmeItem = (projet.programmePrincipal || effectiveSecondaire)
    ? {
        label: 'Programme',
        values: [projet.programmePrincipal ?? effectiveSecondaire ?? ''],
        sub: projet.programmePrincipal ? effectiveSecondaire : undefined,
      }
    : null;

  // Cellule fusionnée "Budget/Surface" — depuis 2026, une seule colonne à
  // deux lignes (budget en ligne 1, surface en ligne 2). Gain de largeur
  // pour les autres cellules. Le saut de ligne entre les deux valeurs est
  // forcé dans `breaksOf` (cf. plus bas), donc l'utilisateur ne peut pas
  // l'inliner. Si l'une des deux valeurs manque, la cellule reste affichée
  // avec la seule disponible.
  const budgetSurfaceValues: string[] = [];
  if (projet.budgetHT) budgetSurfaceValues.push(projet.budgetHT);
  if (projet.surface)  budgetSurfaceValues.push(`${projet.surface.toLocaleString('fr-FR')} m²`);

  // Matériaux — multi-select Airtable, exposé après Programme dans les deux
  // templates. Sauts de ligne par valeur configurables via `breaks.Matériaux`.
  const materiauxValues = projet.materiaux && projet.materiaux.length > 0 ? projet.materiaux : [];

  if (options?.isDev) {
    // Bandeau Dev — ordre fixé par le métier :
    // MOA · Bailleur · Architecte · Budget/Surface · Programme · Matériaux · Mission AI · BET associés.
    // Seuls les champs renseignés apparaissent.
    if (projet.moa)                   items.push({ label: 'MOA',              values: splitCsv(projet.moa) });
    if (projet.bailleur)              items.push({ label: 'Bailleur',         values: splitCsv(projet.bailleur) });
    if (projet.architecte)            items.push({ label: 'Architecte',       values: splitCsv(projet.architecte) });
    if (budgetSurfaceValues.length)   items.push({ label: 'Budget/Surface',   values: budgetSurfaceValues });
    if (programmeItem)                items.push(programmeItem);
    if (materiauxValues.length)       items.push({ label: 'Matériaux',        values: materiauxValues });
    if (projet.missionAi && !options?.hideMissionAi) items.push({ label: 'Mission AI', values: missionAiResolved(projet) });
    if (projet.betAssocies)           items.push({ label: 'BET associés',     values: splitCsv(projet.betAssocies) });
  } else {
    // Bandeau Str-Env — ordre historique + BET associés inséré juste après
    // Architecte (même nature : linked record Sync CRM "acteurs du projet").
    // Budget/Surface remplace les deux cellules historiques. Matériaux après Programme.
    if (projet.moa)                   items.push({ label: 'MOA',              values: splitCsv(projet.moa) });
    if (projet.architecte)            items.push({ label: 'Architecte',       values: splitCsv(projet.architecte) });
    if (projet.betAssocies)           items.push({ label: 'BET associés',     values: splitCsv(projet.betAssocies) });
    if (budgetSurfaceValues.length)   items.push({ label: 'Budget/Surface',   values: budgetSurfaceValues });
    if (projet.entreprise)            items.push({ label: 'Entreprise',       values: splitCsv(projet.entreprise) });
    if (projet.missionAi && !options?.hideMissionAi) items.push({ label: 'Mission AI', values: missionAiResolved(projet) });
    if (programmeItem)                items.push(programmeItem);
    if (materiauxValues.length)       items.push({ label: 'Matériaux',        values: materiauxValues });
  }

  // Cellules masquées par l'utilisateur (option « Activer/désactiver les
  // champs » du panneau bandeau) — retirées pour réduire la largeur.
  const hidden = projet.bandeauConfig?.hiddenCells;
  const visibleItems = (hidden && hidden.length > 0)
    ? items.filter((i) => !hidden.includes(i.label as (typeof hidden)[number]))
    : items;

  if (visibleItems.length === 0) return '';

  // Surcharges typographiques par projet — appliquées uniformément à tous
  // les labels / values du bandeau.
  const labelStyle = styleToCss(projet.bandeauConfig?.labels);
  const valueStyle = styleToCss(projet.bandeauConfig?.values);
  const subStyle = styleToCss(projet.bandeauConfig?.metaSub);
  const labelAttr = labelStyle ? ` style="${labelStyle}"` : '';
  const valueAttr = valueStyle ? ` style="${valueStyle}"` : '';
  const subAttr = subStyle ? ` style="${subStyle}"` : '';

  // Lignes horizontales du bandeau (toggle visible/masqué, couleur, épaisseur)
  const linesCss = linesToCss(projet.bandeauConfig?.lines);
  // Espacement titre ↔ bandeau (slider 0..100, 50 = neutre). Appliqué en
  // margin-top sur la grille — négatif rapproche, positif éloigne.
  const titleGapCss = titleMetaGapCss(projet.bandeauConfig);

  // Distribution horizontale des cellules.
  // Défaut = 'content' depuis 2026 : chaque cellule prend la largeur de son
  // contenu, l'espace libre se répartit (justify-content: space-between).
  // L'utilisateur peut basculer vers 'equal' (cellules de même largeur) via
  // `bandeauConfig.cells.layout`. Les `weights` modulent la part par cellule.
  const cellsCfg = projet.bandeauConfig?.cells;
  const layout = cellsCfg?.layout ?? 'content';
  const weightOf = (label: string): number => {
    const w = cellsCfg?.weights?.[label as keyof NonNullable<typeof cellsCfg.weights>];
    return (typeof w === 'number' && Number.isFinite(w) && w > 0) ? w : 1;
  };
  const gridCols = layout === 'content'
    ? visibleItems.map(i => {
        const w = weightOf(i.label);
        return w !== 1 ? `minmax(${(w * 20).toFixed(1)}mm,max-content)` : 'max-content';
      }).join(' ')
    : visibleItems.map(i => `${weightOf(i.label)}fr`).join(' ');
  const justifyCss = layout === 'content' ? 'justify-content:space-between' : '';
  const gapMm = cellsCfg?.gap;
  const cellGapCss = (typeof gapMm === 'number' && Number.isFinite(gapMm) && gapMm > 0)
    ? `column-gap:${gapMm}mm`
    : '';

  const gridStyle = [
    `grid-template-columns:${gridCols}`,
    justifyCss,
    cellGapCss,
    linesCss,
    titleGapCss,
  ].filter(Boolean).join(';');

  // Sauts de ligne configurables par cellule. `breaks[label]` = array
  // d'indices APRES lesquels insérer un <br> au lieu d'une virgule.
  // Les indices ≥ values.length-1 sont ignorés silencieusement (config
  // périmée après ajout/suppression d'une valeur).
  const breaksOf = (label: string): Set<number> => {
    const arr = cellsCfg?.breaks?.[label as keyof NonNullable<typeof cellsCfg.breaks>];
    const set = new Set(Array.isArray(arr) ? arr : []);
    // 'Budget/Surface' : saut de ligne TOUJOURS entre budget (idx 0) et
    // surface (idx 1) — la cellule est conçue 2-lignes par design, pas
    // configurable par l'utilisateur (contrairement aux autres multi-valeurs).
    if (label === 'Budget/Surface') set.add(0);
    return set;
  };
  /** Sauts intra-valeur (cellules single-value longues). Indices de token
   *  APRES lesquels insérer un `<br>`. Tokens = split sur /\s+/. */
  const wordBreaksOf = (label: string): Set<number> => {
    const arr = cellsCfg?.wordBreaks?.[label as keyof NonNullable<typeof cellsCfg.wordBreaks>];
    return new Set(Array.isArray(arr) ? arr : []);
  };
  const renderValues = (label: string, values: string[]): string => {
    if (values.length === 0) return '';
    if (values.length === 1) {
      // Single-value : applique wordBreaks si configuré et si la valeur a
      // au moins 2 tokens. Sinon rendu plat (comportement historique).
      const wb = wordBreaksOf(label);
      if (wb.size === 0) return esc(values[0]);
      const tokens = values[0].split(/\s+/).filter(Boolean);
      if (tokens.length < 2) return esc(values[0]);
      return tokens.map((t, idx) => {
        const isLast = idx === tokens.length - 1;
        if (isLast) return esc(t);
        return esc(t) + (wb.has(idx) ? '<br>' : ' ');
      }).join('');
    }
    const breaks = breaksOf(label);
    return values.map((v, idx) => {
      const isLast = idx === values.length - 1;
      if (isLast) return esc(v);
      return esc(v) + (breaks.has(idx) ? '<br>' : ', ');
    }).join('');
  };

  return `<div class="t-meta-grid" style="${gridStyle}">
    ${visibleItems.map(i => `
      <div class="t-meta-item">
        <span class="t-meta-label"${labelAttr}>${esc(i.label)}</span>
        <div class="t-meta-value"${valueAttr}>${renderValues(i.label, i.values)}</div>
        ${i.sub ? `<div class="t-meta-sub"${subAttr}>${esc(i.sub)}</div>` : ''}
      </div>
    `).join('')}
  </div>`;
}

/**
 * Rend la description (champ Airtable rich text → markdown GFM).
 * - columns: 1 ou 2 colonnes
 * - singleParagraph: si true, fusionne tous les sauts de ligne en un seul
 *   paragraphe (utilisé par Solo pour avoir un bloc plein largeur compact)
 *
 * On parse le markdown ; les paragraphes/listes/styles inline (gras, italique,
 * liens) sont rendus en HTML. Le wrapper `.t-texte-md` applique notre style
 * de paragraphe à tous les <p> générés par marked.
 */
export function descriptionHtml(projet: Projet, columns: 1 | 2 = 1, singleParagraph = false): string {
  const text = (projet.description ?? '').trim();
  if (!text) return '';

  // Surcharge typographique (police, taille, B/I/U, couleur, surlignage) du
  // bloc description. Appliquée sur le wrapper — héritée par <p>/<li>/<a>…
  const descStyle = styleToCss(projet.bandeauConfig?.description);
  const styleAttr = descStyle ? ` style="${descStyle}"` : '';

  if (singleParagraph) {
    const flat = text.replace(/\s*\n+\s*/g, ' ');
    return `<div class="t-texte-md t-texte-md--inline"${styleAttr}>${injectSoftHyphensFr(renderMarkdown(flat))}</div>`;
  }

  const cls = columns === 2 ? 't-texte-md t-texte-cols-2' : 't-texte-md';
  return `<div class="${cls}"${styleAttr}>${injectSoftHyphensFr(renderMarkdown(text))}</div>`;
}

export function photoImg(
  photo: { url: string; filename?: string; width?: number; height?: number },
  alt = '',
  projet?: Projet,
): string {
  const crop = projet?.photoCrops?.[photoCropKey(photo)];
  if (isMeaningfulCrop(crop)) return croppedPhotoHtml(photo, alt, crop);
  return `<img class="photo-img" src="${esc(photo.url)}" alt="${esc(alt)}" />`;
}

export interface PhotoRef {
  url: string;
  filename: string;
  width?: number;
  height?: number;
}

export function allPhotos(projet: Projet): PhotoRef[] {
  return [projet.photoCouverture, ...(projet.photosProjet ?? [])].filter(
    (p): p is PhotoRef => Boolean(p)
  );
}

export interface TemplateBundle {
  body: string;
  css: string;
}

export function renderShell(projet: Projet, bundle: TemplateBundle): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${esc(projet.nom)}</title>
  ${FONTS_LINK}
  <style>${SHARED_CSS}${bundle.css}</style>
</head>
<body>${bundle.body}</body>
</html>`;
}
