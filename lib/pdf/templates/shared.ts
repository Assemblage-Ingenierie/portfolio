import type { Projet } from '@/types/projet';
import { renderMarkdown } from '@/lib/utils/markdown';
import { styleToCss, linesToCss } from '@/lib/pdf/bandeauConfig';

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
/* Vignettes inactives : on garde le fichier blanc (silhouette) mais on
   passe en niveaux de gris + opacity réduite pour qu'elles apparaissent
   grisées (et plus visibles qu'en pur blanc sur fond blanc). */
.t-header-vignette--inactive {
  filter: grayscale(100%) brightness(0.85);
  opacity: 0.70;
}
.t-header-meta {
  font-size: 9pt; font-weight: 400;
  letter-spacing: 0.06em; font-variant: small-caps;
  color: var(--ai-noir70);
}
.t-header-statut {
  font-size: 9pt; font-weight: 500;
  letter-spacing: 0.06em; font-variant: small-caps;
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
/* Bloc markdown rendu (description rich text Airtable) */
.t-texte-md { font-family: var(--sans); font-size: 9.5pt; line-height: 1.5; color: var(--ai-noir); }
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

// Vignettes pôle hébergées sur Supabase Storage (bucket public "Branding").
// Trois pôles, toujours affichés dans l'ordre STR · ENV · DEV. Celui qui
// correspond au pôle du projet est rendu en couleur, les deux autres en
// silhouette blanche. Attention à la casse : "Env_blanc.png" est en
// minuscule alors que les deux autres sont en majuscule.
const VIGNETTE_BASE =
  'https://hhkofvbptnrtwbazftlm.supabase.co/storage/v1/object/public/Branding/vignettes';
const VIGNETTES: ReadonlyArray<{ code: string; colored: string; blanc: string }> = [
  { code: 'STR', colored: `${VIGNETTE_BASE}/Str.png`, blanc: `${VIGNETTE_BASE}/Str_Blanc.png` },
  { code: 'ENV', colored: `${VIGNETTE_BASE}/Env.png`, blanc: `${VIGNETTE_BASE}/Env_blanc.png` },
  { code: 'DEV', colored: `${VIGNETTE_BASE}/Dev.png`, blanc: `${VIGNETTE_BASE}/Dev_Blanc.png` },
];

export function headerHtml(projet: Projet): string {
  // Année placée dans le bandeau de statut, à la suite de l'état du chantier.
  const annee = projet.anneeLivraison ? ` · ${esc(String(projet.anneeLivraison))}` : '';
  const poleActif = (projet.pole ?? '').toUpperCase();
  const vignettes = VIGNETTES.map((v) => {
    const active = v.code === poleActif;
    const url = active ? v.colored : v.blanc;
    const cls = active ? 't-header-vignette' : 't-header-vignette t-header-vignette--inactive';
    return `<img class="${cls}" src="${url}" alt="${v.code}" />`;
  }).join('');
  const statusStyle = styleToCss(projet.bandeauConfig?.status);
  return `<header class="t-header">
    <div class="t-header-vignettes">${vignettes}</div>
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

export function metaGridHtml(projet: Projet): string {
  const items: { label: string; value: string; sub?: string }[] = [];

  // Ordre fixe : seuls les champs renseignés apparaissent.
  if (projet.moa)        items.push({ label: "Maître d'ouvrage", value: projet.moa });
  if (projet.architecte) items.push({ label: 'Architecte',       value: projet.architecte });
  if (projet.budgetHT)   items.push({ label: 'Budget',           value: projet.budgetHT });
  if (projet.surface)    items.push({ label: 'Surface',          value: `${projet.surface.toLocaleString('fr-FR')} m²` });
  if (projet.entreprise) items.push({ label: 'Entreprise',       value: projet.entreprise });
  if (projet.missionAi)  items.push({ label: 'Prestation AI',    value: projet.missionAi });
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
  const gridStyle = `grid-template-columns:repeat(${items.length},1fr)${linesCss ? `;${linesCss}` : ''}`;

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

  if (singleParagraph) {
    const flat = text.replace(/\s*\n+\s*/g, ' ');
    return `<div class="t-texte-md t-texte-md--inline">${renderMarkdown(flat)}</div>`;
  }

  const cls = columns === 2 ? 't-texte-md t-texte-cols-2' : 't-texte-md';
  return `<div class="${cls}">${renderMarkdown(text)}</div>`;
}

export function photoImg(photo: { url: string; filename?: string }, alt = ''): string {
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
