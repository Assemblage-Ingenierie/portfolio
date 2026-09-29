import type { Projet, TemplateChoice } from '@/types/projet';
import { renderTemplate } from './renderHtml';
import { renderCover, type CoverVariant } from './templates/cover';
import { renderSommaire, sommairePageCount } from './templates/sommaire';
import { SHARED_CSS } from './templates/shared';

export interface PortfolioItem {
  projet: Projet;
  template: TemplateChoice;
}

export interface PortfolioBundle {
  body: string;
  css: string;
}

/**
 * Concatène une page de couverture + un sommaire + 1 fiche par référence sélectionnée.
 *
 * Numérotation des pages :
 *   1 = cover
 *   2..(1+k) = sommaire (k = sommairePageCount, TOC_ITEMS_PER_PAGE lignes par page)
 *   (2+k)..n = fiches
 */
export function renderPortfolioHtml(items: PortfolioItem[], title?: string): string {
  const cover = renderCover({ title, count: items.length });

  const tocEntries = items.map((item, idx) => ({
    affaire: item.projet.affaire,
    nom: item.projet.nom,
    pole: item.projet.pole,
    programme: item.projet.programme,
    pageNumber: 2 + sommairePageCount(items.length) + idx,
  }));

  const sommaire = renderSommaire(items[0]?.projet ?? null, tocEntries);

  const fiches = items.map(item =>
    renderTemplate({ ...item.projet, template: item.template })
  );

  const allCss = [
    SHARED_CSS,
    cover.css,
    sommaire.css,
    ...fiches.map(f => f.css),
  ].join('\n');

  // Saut de page entre chaque article (cover, sommaire, fiches)
  // .page a déjà overflow:hidden + page-break-after:avoid pour ne pas générer
  // de page blanche, mais on force ici la séquence par page-break-before sur
  // les éléments suivants.
  const pageBreakCss = `
    .page + .page { page-break-before: always; break-before: page; }
  `;

  const allBody = [
    cover.body,
    sommaire.body,
    ...fiches.map(f => f.body),
  ].join('\n');

  return [
    '<!DOCTYPE html>',
    '<html lang="fr">',
    '<head>',
    '<meta charset="UTF-8">',
    '<title>Portfolio Assemblage ingénierie</title>',
    `<style>${allCss}${pageBreakCss}</style>`,
    '</head>',
    '<body>',
    allBody,
    '</body>',
    '</html>',
  ].join('');
}

/**
 * Variante qui retourne juste le body + css (sans la coque HTML),
 * pour l'utiliser dans une page Next.js qui fournit déjà <html>/<body>.
 *
 * `includeCover` (défaut true) ajoute la page de garde + le sommaire en tête.
 * Mettre à false pour exporter uniquement les fiches de références.
 *
 * `coverVariant` (STR/ENV/DEV) ne change que la photo de la page de garde.
 */
export function renderPortfolioBundle(
  items: PortfolioItem[],
  title?: string,
  includeCover = true,
  coverVariant: CoverVariant = 'STR',
): PortfolioBundle {
  const fiches = items.map(item =>
    renderTemplate({ ...item.projet, template: item.template })
  );

  if (!includeCover) {
    const css = [
      ...fiches.map(f => f.css),
      `.page + .page { page-break-before: always; break-before: page; }`,
    ].join('\n');
    const body = fiches.map(f => f.body).join('\n');
    return { body, css };
  }

  const cover = renderCover({ title, count: items.length, variant: coverVariant });

  const tocEntries = items.map((item, idx) => ({
    affaire: item.projet.affaire,
    nom: item.projet.nom,
    pole: item.projet.pole,
    programme: item.projet.programme,
    pageNumber: 2 + sommairePageCount(items.length) + idx,
  }));

  const sommaire = renderSommaire(items[0]?.projet ?? null, tocEntries);

  const css = [
    cover.css,
    sommaire.css,
    ...fiches.map(f => f.css),
    `.page + .page { page-break-before: always; break-before: page; }`,
  ].join('\n');

  const body = [
    cover.body,
    sommaire.body,
    ...fiches.map(f => f.body),
  ].join('\n');

  return { body, css };
}
