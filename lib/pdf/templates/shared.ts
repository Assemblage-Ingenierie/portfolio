import type { Projet } from '@/types/projet';

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
.t-header-meta {
  font-size: 8pt; font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--ai-noir70);
}
.t-header-statut {
  font-size: 8pt; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--ai-rouge);
}

.t-footer {
  display: flex; justify-content: space-between; align-items: center;
  border-top: 1px solid var(--ai-gris); padding-top: 2.5mm;
  font-family: var(--sans); font-size: 7pt; color: var(--ai-noir70);
}
.t-footer-sigle {
  font-family: var(--serif); font-size: 14pt; font-weight: 700;
  color: var(--ai-rouge); line-height: 1;
}
.t-footer-legal { text-align: center; flex: 1; padding: 0 6mm; }

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
  font-family: var(--sans); font-size: 7pt; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--ai-rouge);
  margin-bottom: 1mm; display: block;
}
.t-meta-value {
  font-family: var(--serif); font-size: 10.5pt; font-weight: 500;
  line-height: 1.2; color: var(--ai-noir);
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
.t-texte-cols-2 { column-count: 2; column-gap: 6mm; column-rule: 1px solid var(--ai-gris); }
.t-texte-cols-2 .t-texte-p { break-inside: avoid; }
`;

export function headerHtml(projet: Projet): string {
  return `<header class="t-header">
    <div class="t-header-meta">Assemblage ingénierie · Référence Projet</div>
    <div class="t-header-statut">● ${esc(projet.statut)}</div>
  </header>`;
}

export function footerHtml(_projet: Projet): string {
  return `<footer class="t-footer">
    <span class="t-footer-sigle">.A</span>
  </footer>`;
}

export function titleBlockHtml(projet: Projet, h1Size = '32pt'): string {
  return `<div class="t-title-block">
    ${projet.adresse ? `<div class="t-surtitre">${esc(projet.adresse)}</div>` : ''}
    <h1 class="t-h1" style="font-size:${h1Size}; line-height:1.05;">${esc(projet.nom)}</h1>
    ${projet.pitch ? `<p class="t-pitch">${esc(projet.pitch)}</p>` : ''}
  </div>`;
}

export function metaGridHtml(projet: Projet): string {
  const items: { label: string; value: string; sub?: string }[] = [];

  if (projet.moa) items.push({ label: "Maître d'ouvrage", value: projet.moa });
  if (projet.architecte) items.push({ label: 'Architecte', value: projet.architecte });
  if (projet.budgetHT) items.push({ label: 'Budget', value: projet.budgetHT });
  if (projet.surface) items.push({ label: 'Surface', value: `${projet.surface.toLocaleString('fr-FR')} m²` });
  if (projet.anneeLivraison) items.push({
    label: 'Année',
    value: String(projet.anneeLivraison),
  });

  if (items.length === 0) return '';

  return `<div class="t-meta-grid" style="grid-template-columns:repeat(${items.length},1fr);">
    ${items.map(i => `
      <div class="t-meta-item">
        <span class="t-meta-label">${esc(i.label)}</span>
        <div class="t-meta-value">${esc(i.value)}</div>
        ${i.sub ? `<div class="t-meta-sub">${esc(i.sub)}</div>` : ''}
      </div>
    `).join('')}
  </div>`;
}

/**
 * Rend la description.
 * - columns: 1 ou 2 colonnes
 * - singleParagraph: si true, fusionne tous les sauts de ligne en un seul
 *   paragraphe (utilisé par Solo pour avoir un bloc plein largeur compact)
 */
export function descriptionHtml(projet: Projet, columns: 1 | 2 = 1, singleParagraph = false): string {
  const text = (projet.description ?? '').trim();
  if (!text) return '';

  if (singleParagraph) {
    const flat = text.replace(/\s*\n+\s*/g, ' ');
    return `<p class="t-texte-p">${esc(flat)}</p>`;
  }

  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  if (paragraphs.length === 0) return '';
  const cls = columns === 2 ? 't-texte-cols-2' : '';
  return `<div class="${cls}">
    ${paragraphs.map(p => `<p class="t-texte-p">${esc(p)}</p>`).join('')}
  </div>`;
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
