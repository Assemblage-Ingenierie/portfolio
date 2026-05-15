import type { Projet } from '@/types/projet';
import { esc } from './templates/shared';

/**
 * Template "Tableau" — export A4 (portrait ou paysage) d'une liste de
 * références sous forme de tableau, une ligne par projet. Indépendant des
 * templates fiche-projet (Solo/Diptyque/Triptyque/Str-Env/Dev) et non lié
 * à un champ Airtable : la sélection (slugs ordonnés) + le choix des
 * colonnes sont passés via l'URL.
 *
 * Le rendu utilise le même mécanisme `.page` que les autres templates pour
 * que `measureOverflow` puisse s'appliquer ; la hauteur en mm est exposée
 * via `data-height-mm` (297 portrait, 210 paysage) — measureOverflow s'en
 * sert pour la conversion px → mm.
 */

export type TableauOrientation = 'portrait' | 'paysage';

export interface TableauFieldDef {
  key: string;
  label: string;
  getValue: (p: Projet) => string | undefined;
}

/** Catalogue complet des colonnes possibles. L'utilisateur en choisit un
 *  sous-ensemble depuis l'UI. L'ordre déclaré ici sert d'ordre d'affichage
 *  par défaut. */
export const TABLEAU_FIELDS: TableauFieldDef[] = [
  { key: 'nom',          label: 'Nom du projet',     getValue: (p) => p.nom },
  { key: 'lieu',         label: 'Lieu',              getValue: (p) => p.lieu },
  { key: 'annee',        label: 'Année',             getValue: (p) => p.anneeLivraison ? String(p.anneeLivraison) : undefined },
  { key: 'moa',          label: "Maître d'ouvrage",  getValue: (p) => p.moa },
  { key: 'architecte',   label: 'Architecte',        getValue: (p) => p.architecte },
  { key: 'bet',          label: 'BET associés',      getValue: (p) => p.betAssocies },
  { key: 'bailleur',     label: 'Bailleur',          getValue: (p) => p.bailleur },
  { key: 'entreprise',   label: 'Entreprise',        getValue: (p) => p.entreprise },
  { key: 'mission',      label: 'Mission AI',        getValue: (p) => p.missionAi },
  { key: 'programme',    label: 'Programme',         getValue: (p) => p.programmePrincipal ?? p.programmeSecondaire },
  { key: 'surface',      label: 'Surface',           getValue: (p) => p.surface ? `${p.surface.toLocaleString('fr-FR')} m²` : undefined },
  { key: 'budget',       label: 'Budget',            getValue: (p) => p.budgetHT },
  { key: 'statut',       label: 'Statut',            getValue: (p) => p.statut },
];

export const TABLEAU_FIELD_KEYS = TABLEAU_FIELDS.map((f) => f.key);

/** Sélection de colonnes par défaut quand aucune n'est précisée par l'URL. */
export const TABLEAU_DEFAULT_FIELDS = ['nom', 'moa', 'architecte', 'annee', 'programme'];

export interface RenderTableauOptions {
  projets: Projet[];
  fieldKeys: string[];
  orientation: TableauOrientation;
  title?: string;
}

export function renderTableau({
  projets,
  fieldKeys,
  orientation,
  title,
}: RenderTableauOptions): { body: string; css: string } {
  // Largeur / hauteur de la page en mm selon orientation.
  const pageWidthMm = orientation === 'paysage' ? 297 : 210;
  const pageHeightMm = orientation === 'paysage' ? 210 : 297;

  // Filtre + ordonne les colonnes selon TABLEAU_FIELDS, conserve l'ordre
  // souhaité par l'utilisateur si fieldKeys vient dans un ordre custom.
  const fieldByKey = new Map(TABLEAU_FIELDS.map((f) => [f.key, f]));
  const fields = fieldKeys
    .map((k) => fieldByKey.get(k))
    .filter((f): f is TableauFieldDef => Boolean(f));

  // Header de tableau + lignes de données.
  const head = `<thead><tr>${fields.map((f) =>
    `<th>${esc(f.label)}</th>`
  ).join('')}</tr></thead>`;

  const body = `<tbody>${projets.map((p) =>
    `<tr>${fields.map((f) => {
      const v = f.getValue(p);
      return `<td>${v ? esc(v) : '<span class="tab-empty">—</span>'}</td>`;
    }).join('')}</tr>`
  ).join('')}</tbody>`;

  const titleHtml = title ? `<h1 class="tab-title">${esc(title)}</h1>` : '';

  const html = `<article class="page tab-page" data-height-mm="${pageHeightMm}">
    ${titleHtml}
    <table class="tab-grid">${head}${body}</table>
    <footer class="tab-footer">
      <span>Assemblage ingénierie</span>
      <span>${projets.length} référence${projets.length > 1 ? 's' : ''}</span>
    </footer>
  </article>`;

  const css = `
    /* Override @page pour cet export : taille pilotée par orientation.
       Les autres règles A4 (margin:0) viennent de SHARED_CSS. */
    @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }

    .tab-page {
      width: ${pageWidthMm}mm;
      height: ${pageHeightMm}mm;
      padding: 12mm 14mm;
      display: flex;
      flex-direction: column;
      gap: 6mm;
      box-sizing: border-box;
      page-break-after: always;
      break-after: page;
    }
    .tab-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    .tab-title {
      font-family: var(--sans);
      font-size: 18pt;
      font-weight: 500;
      color: var(--ai-violet);
      letter-spacing: -0.01em;
      border-bottom: 2px solid var(--ai-rouge);
      padding-bottom: 3mm;
      margin: 0;
    }

    .tab-grid {
      width: 100%;
      border-collapse: collapse;
      font-family: var(--sans);
      font-size: 9pt;
      line-height: 1.35;
      color: var(--ai-noir);
      flex: 1 1 auto;
    }
    .tab-grid thead th {
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--ai-rouge);
      text-align: left;
      padding: 2.5mm 3mm;
      border-bottom: 1.2pt solid var(--ai-noir);
      background: white;
      vertical-align: bottom;
    }
    .tab-grid tbody td {
      padding: 2.2mm 3mm;
      border-bottom: 0.5pt solid var(--ai-gris);
      vertical-align: top;
      word-wrap: break-word;
    }
    .tab-grid tbody tr:nth-child(even) td {
      background: var(--ai-gris-tres-clair);
    }
    .tab-empty {
      color: var(--ai-gris);
      font-style: italic;
    }

    .tab-footer {
      display: flex;
      justify-content: space-between;
      font-family: var(--sans);
      font-size: 8pt;
      color: var(--ai-noir70);
      border-top: 1px solid var(--ai-gris);
      padding-top: 2mm;
      flex: 0 0 auto;
    }
  `;

  return { body: html, css };
}
