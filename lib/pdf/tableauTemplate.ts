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
export type TableauMode = 'Str-Env' | 'Dev';

export interface TableauFieldDef {
  key: string;
  label: string;
  getValue: (p: Projet) => string | undefined;
}

/** Catalogue complet des colonnes disponibles (toutes modes confondues). */
export const TABLEAU_FIELDS: TableauFieldDef[] = [
  { key: 'nom',          label: 'Projet',            getValue: (p) => p.nom },
  { key: 'lieu',         label: 'Lieu',              getValue: (p) => p.lieu },
  { key: 'annee',        label: 'Année',             getValue: (p) => p.anneeLivraison ? String(p.anneeLivraison) : undefined },
  { key: 'moa',          label: 'MOA',               getValue: (p) => p.moa },
  { key: 'architecte',   label: 'Architecte',        getValue: (p) => p.architecte },
  { key: 'bet',          label: 'BET associés',      getValue: (p) => p.betAssocies },
  { key: 'bailleur',     label: 'Bailleur',          getValue: (p) => p.bailleur },
  { key: 'mission',      label: 'Mission AI',        getValue: (p) => p.missionAi },
  { key: 'programme',    label: 'Programme',         getValue: (p) => p.programmePrincipal ?? p.programmeSecondaire },
  { key: 'surface',      label: 'Surface',           getValue: (p) => p.surface ? `${p.surface.toLocaleString('fr-FR')} m²` : undefined },
  { key: 'budget',       label: 'Budget',            getValue: (p) => p.budgetHT },
];

export const TABLEAU_FIELD_KEYS = TABLEAU_FIELDS.map((f) => f.key);

/** Ordres canoniques par mode. Le rendu trie les clés sélectionnées dans
 *  cet ordre — d'où le placement de "Lieu" juste avant "Année" même si
 *  l'utilisateur l'active dans un second temps. */
export const TABLEAU_ORDER_BY_MODE: Record<TableauMode, string[]> = {
  'Str-Env': ['nom', 'architecte', 'moa', 'mission', 'programme', 'budget', 'surface', 'lieu', 'annee'],
  'Dev':     ['nom', 'moa', 'bailleur', 'architecte', 'programme', 'mission', 'budget', 'bet', 'lieu', 'annee'],
};

/** Colonnes activées par défaut pour chaque mode. "Lieu" est dans le
 *  catalogue mais désactivé par défaut sur les deux modes. */
export const TABLEAU_DEFAULTS_BY_MODE: Record<TableauMode, string[]> = {
  'Str-Env': ['nom', 'architecte', 'moa', 'mission', 'programme', 'budget', 'surface', 'annee'],
  'Dev':     ['nom', 'moa', 'bailleur', 'architecte', 'programme', 'mission', 'budget', 'bet', 'annee'],
};

/** Sélection par défaut quand aucune n'est précisée par l'URL (fallback Str-Env). */
export const TABLEAU_DEFAULT_FIELDS = TABLEAU_DEFAULTS_BY_MODE['Str-Env'];

/** URL du logo Assemblage (rouge) — bucket Branding Supabase. */
const LOGO_URL = 'https://hhkofvbptnrtwbazftlm.supabase.co/storage/v1/object/public/Branding/logo/logo_Ai_rouge.svg';

export interface RenderTableauOptions {
  projets: Projet[];
  fieldKeys: string[];
  orientation: TableauOrientation;
  mode?: TableauMode;
  title?: string;
}

export function renderTableau({
  projets,
  fieldKeys,
  orientation,
  mode = 'Str-Env',
  title = 'Tableau de références',
}: RenderTableauOptions): { body: string; css: string } {
  // Largeur / hauteur de la page en mm selon orientation.
  const pageWidthMm = orientation === 'paysage' ? 297 : 210;
  const pageHeightMm = orientation === 'paysage' ? 210 : 297;

  // Tri des colonnes selon l'ordre canonique du mode — "Lieu" se retrouve
  // toujours juste avant "Année" même s'il est activé après-coup.
  const order = TABLEAU_ORDER_BY_MODE[mode];
  const selected = new Set(fieldKeys);
  const fieldByKey = new Map(TABLEAU_FIELDS.map((f) => [f.key, f]));
  const fields = order
    .filter((k) => selected.has(k))
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
    <div class="tab-spacer"></div>
    <footer class="tab-footer">
      <img class="tab-footer-logo" src="${LOGO_URL}" alt="Assemblage ingénierie" />
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
      /* Pas de flex: 1 1 auto — les lignes gardent leur hauteur naturelle
         (compactes), et le footer "flotte" via le spacer .tab-spacer. */
      flex: 0 0 auto;
      /* Bordure extérieure noire visible (1pt). Le collapse + les bordures
         internes ci-dessous donnent un tableau encadré net. */
      border: 1pt solid var(--ai-noir);
    }
    .tab-grid thead th {
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.02em;
      color: var(--ai-rouge);
      text-align: left;
      padding: 1.6mm 3mm;
      border-bottom: 1pt solid var(--ai-noir);
      background: white;
      vertical-align: bottom;
    }
    .tab-grid tbody td {
      padding: 1.4mm 3mm;
      border-bottom: 0.4pt solid var(--ai-gris);
      vertical-align: top;
      word-wrap: break-word;
    }
    .tab-grid tbody tr:last-child td {
      /* Évite le double-trait avec la bordure extérieure noire en bas. */
      border-bottom: none;
    }
    .tab-grid tbody tr:nth-child(even) td {
      background: var(--ai-gris-tres-clair);
    }
    /* Spacer flex pour pousser le footer en bas de la page A4 sans étirer
       les lignes du tableau. */
    .tab-spacer { flex: 1 1 auto; }
    .tab-empty {
      color: var(--ai-gris);
      font-style: italic;
    }

    .tab-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: var(--sans);
      font-size: 8pt;
      color: var(--ai-noir70);
      border-top: 1px solid var(--ai-gris);
      padding-top: 3mm;
      flex: 0 0 auto;
    }
    .tab-footer-logo {
      height: 12mm;
      width: auto;
      display: block;
    }
  `;

  return { body: html, css };
}
