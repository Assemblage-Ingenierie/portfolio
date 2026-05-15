import type { Projet } from '@/types/projet';
import { renderMarkdown } from '@/lib/utils/markdown';
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
  align-items: baseline;
  border-bottom: 1px solid var(--ai-rouge);
  padding-bottom: 3mm;
  font-family: var(--sans);
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

/* Footer retiré du template — fonction footerHtml() renvoie '' désormais.
   On garde les classes vides au cas où on réintroduirait un footer plus tard. */
.t-footer { display: none; }

/* Titre + identité */
.t-surtitre {
  font-family: var(--sans); font-size: 9pt; font-weight: 600;
  color: var(--ai-noir70); letter-spacing: 0.05em;
  margin-bottom: 2mm;
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
  border-right: 1px solid var(--ai-gris);
}
.t-meta-item:first-child { padding-left: 0; }
.t-meta-item:last-child { padding-right: 0; border-right: none; }
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
.t-texte-md { font-family: var(--sans); font-size: 9pt; line-height: 1.5; color: var(--ai-noir); }
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

export function headerHtml(projet: Projet): string {
  // Année placée dans le bandeau de statut, à la suite de l'état du chantier.
  const annee = projet.anneeLivraison ? ` · ${esc(String(projet.anneeLivraison))}` : '';

  // Source de vérité : champ multi-select "Vignette pôle". Si absent ou vide,
  // on retombe sur le champ legacy `pole` (single-select) pour rétro-compat.
  // Les vignettes sélectionnées gardent leurs couleurs SVG d'origine (rouge),
  // les autres sont grisées via filter CSS (intensité contrôlée par
  // --vignette-grey-brightness).
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

  // Vignettes Rehab/Neuf — multi-select "Rehab / Neuf".
  // Ordre d'affichage : Neuf en premier, puis Réhabilitation. Quand les
  // deux sont cochés, on rend les deux SVG côte à côte suivis d'un label
  // sur 2 lignes (Neuf au-dessus de Réhabilitation).
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

  const statusStyle = styleToCss(projet.bandeauConfig?.status);
  return `<header class="t-header">
    <div class="t-header-vignettes">${vignettes}${rehabNeufHtml}</div>
    <div class="t-header-statut"${statusStyle ? ` style="${statusStyle}"` : ''}>● ${esc(projet.statut)}${annee}</div>
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

export function titleBlockHtml(projet: Projet, h1Size = '32pt'): string {
  // Surcharge typographique du titre (BandeauConfig.titre). Si l'utilisateur
  // définit fontSize, on l'applique en remplacement du défaut du template.
  const titreOverride = styleToCss(projet.bandeauConfig?.titre);
  const baseStyle = `font-size:${h1Size}; line-height:1.05`;
  const h1Style = titreOverride ? `${baseStyle}; ${titreOverride}` : baseStyle;
  return `<div class="t-title-block">
    ${projet.lieu ? `<div class="t-surtitre">${esc(projet.lieu)}</div>` : ''}
    <h1 class="t-h1" style="${h1Style}">${esc(projet.nom)}</h1>
    ${projet.pitch ? `<p class="t-pitch">${esc(projet.pitch)}</p>` : ''}
  </div>`;
}

export function metaGridHtml(projet: Projet, options?: { isDev?: boolean }): string {
  const items: { label: string; value: string; sub?: string }[] = [];

  // Ordre fixe : seuls les champs renseignés apparaissent.
  if (projet.moa)        items.push({ label: "Maître d'ouvrage", value: projet.moa });
  if (projet.architecte) items.push({ label: 'Architecte',       value: projet.architecte });
  // Dev uniquement : BET associés (linked record Sync CRM) inséré juste
  // après Architecte pour rester dans la zone "acteurs du projet".
  if (options?.isDev && projet.betAssocies) items.push({ label: 'BET associés', value: projet.betAssocies });
  if (projet.budgetHT)   items.push({ label: 'Budget',           value: projet.budgetHT });
  if (projet.surface)    items.push({ label: 'Surface',          value: `${projet.surface.toLocaleString('fr-FR')} m²` });
  if (projet.entreprise) items.push({ label: 'Entreprise',       value: projet.entreprise });
  // Dev uniquement : Bailleur (champ texte simple de la base affaire) après
  // Entreprise — autre acteur financeur, logique avec le bloc Budget.
  if (options?.isDev && projet.bailleur) items.push({ label: 'Bailleur', value: projet.bailleur });
  if (projet.missionAi)  items.push({ label: 'Mission AI',       value: projet.missionAi });
  // Programme : principal en valeur principale, secondaire en sous-titre
  if (projet.programmePrincipal || projet.programmeSecondaire) items.push({
    label: 'Programme',
    value: projet.programmePrincipal ?? projet.programmeSecondaire ?? '',
    sub: projet.programmePrincipal ? projet.programmeSecondaire : undefined,
  });

  if (items.length === 0) return '';

  // Surcharges typographiques par projet — appliquées uniformément à tous
  // les labels / values du bandeau.
  const labelStyle = styleToCss(projet.bandeauConfig?.labels);
  const valueStyle = styleToCss(projet.bandeauConfig?.values);
  const labelAttr = labelStyle ? ` style="${labelStyle}"` : '';
  const valueAttr = valueStyle ? ` style="${valueStyle}"` : '';

  // Lignes horizontales du bandeau (toggle visible/masqué, couleur, épaisseur)
  const linesCss = linesToCss(projet.bandeauConfig?.lines);
  // Espacement titre ↔ bandeau (slider 0..100, 50 = neutre). Appliqué en
  // margin-top sur la grille — négatif rapproche, positif éloigne.
  const gapCss = titleMetaGapCss(projet.bandeauConfig);
  const gridStyle = [
    `grid-template-columns:repeat(${items.length},1fr)`,
    linesCss,
    gapCss,
  ].filter(Boolean).join(';');

  return `<div class="t-meta-grid" style="${gridStyle}">
    ${items.map(i => `
      <div class="t-meta-item">
        <span class="t-meta-label"${labelAttr}>${esc(i.label)}</span>
        <div class="t-meta-value"${valueAttr}>${esc(i.value)}</div>
        ${i.sub ? `<div class="t-meta-sub">${esc(i.sub)}</div>` : ''}
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
    return `<div class="t-texte-md t-texte-md--inline"${styleAttr}>${renderMarkdown(flat)}</div>`;
  }

  const cls = columns === 2 ? 't-texte-md t-texte-cols-2' : 't-texte-md';
  return `<div class="${cls}"${styleAttr}>${renderMarkdown(text)}</div>`;
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
