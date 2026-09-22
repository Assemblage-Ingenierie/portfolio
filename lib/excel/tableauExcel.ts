import type { Projet } from '@/types/projet';
import {
  resolveTableauFields,
  resolveTableauTypo,
  type TableauMode,
  type TableauOrientation,
  type TableauTypo,
} from '@/lib/pdf/tableauTemplate';

/**
 * Export Excel (.xlsx) du tableau de références — pendant de l'export PDF de
 * `/portfolio/tableau`.
 *
 * ── Pourquoi côté client ────────────────────────────────────────────────────
 * Le classeur ne contient que du texte déjà présent en mémoire dans
 * `TableauBuilder` (les `Projet` chargés + le choix de colonnes). Aucun aller-
 * retour serveur n'est nécessaire : pas de route API, pas de re-fetch Airtable,
 * pas de Puppeteer. `write-excel-file/browser` est importé dynamiquement pour
 * qu'il reste hors du bundle initial de la page.
 *
 * ── Parité avec le PDF ──────────────────────────────────────────────────────
 * Les colonnes (liste, ordre, valeurs, champ libre) viennent de
 * `resolveTableauFields` — le même helper que `renderTableau`. Une évolution de
 * colonne se répercute donc automatiquement sur les deux sorties.
 *
 * Divergences assumées, dictées par le format :
 *  - pas de pagination (une feuille = un tableau continu ; `rowsPerPage` est un
 *    artefact de la mise en page A4) ;
 *  - pas de petites capitales sur Mission AI (inexistantes en xlsx) ;
 *  - cellules vides laissées vides au lieu du tiret « — » du PDF, pour que les
 *    filtres et tris natifs d'Excel restent exploitables.
 */

const ROUGE = '#E30513';
const VIOLET = '#30323E';
const NOIR = '#000000';
const GRIS = '#DFE4E8';
const GRIS_TRES_CLAIR = '#F2F2F2';

/**
 * Formes minimales des structures attendues par `write-excel-file`, redéclarées
 * ici plutôt qu'importées de `write-excel-file/browser` : ce module doit rester
 * analysable hors navigateur (l'import du writer est dynamique). Elles ne
 * décrivent que ce qu'on utilise.
 */
type SheetCell = {
  value?: string;
  type?: StringConstructor;
  fontSize?: number;
  fontWeight?: 'bold';
  color?: string;
  backgroundColor?: string;
  align?: 'left' | 'center' | 'right';
  alignVertical?: 'top' | 'center' | 'bottom';
  height?: number;
  columnSpan?: number;
  wrap?: boolean;
  topBorderColor?: string;
  topBorderStyle?: 'thin' | 'medium' | 'hair';
  bottomBorderColor?: string;
  bottomBorderStyle?: 'thin' | 'medium' | 'hair';
} | null;

export type SheetRow = SheetCell[];

export interface SheetOptions {
  sheet?: string;
  columns?: { width: number }[];
  orientation?: 'landscape';
  stickyRowsCount?: number;
}

/** Largeur de colonne (en caractères Excel), bornée pour rester lisible. */
const COL_WIDTH_MIN = 10;
const COL_WIDTH_MAX = 48;

export interface BuildTableauSheetOptions {
  projets: Projet[];
  fieldKeys: string[];
  mode: TableauMode;
  orientation: TableauOrientation;
  title?: string;
  champLibreNom?: string;
  champLibreValues?: Record<string, string>;
  typo?: Partial<TableauTypo>;
}

export interface ExportTableauExcelOptions extends BuildTableauSheetOptions {
  /** Nom du fichier téléchargé, sans extension. */
  fileName?: string;
}

/**
 * Construit les données de la feuille : lignes stylées + largeurs de colonnes +
 * options de feuille. Fonction pure, sans dépendance au navigateur — c'est elle
 * qu'on exerce dans les vérifications hors app.
 *
 * Retourne `null` quand il n'y a rien à exporter (aucune colonne ou aucune
 * référence).
 */
export function buildTableauSheet({
  projets,
  fieldKeys,
  mode,
  orientation,
  title = 'Tableau de références',
  champLibreNom,
  champLibreValues,
  typo,
}: BuildTableauSheetOptions): { data: SheetRow[]; sheetOptions: SheetOptions } | null {
  const fields = resolveTableauFields({ fieldKeys, mode, champLibreNom, champLibreValues });
  if (fields.length === 0 || projets.length === 0) return null;

  const { titleSizePt, headSizePt, cellSizePt } = resolveTableauTypo(typo);

  // Valeurs calculées une seule fois : servent au corps du tableau ET au
  // dimensionnement des colonnes.
  const rows = projets.map((p) => fields.map((f) => f.getValue(p) ?? ''));

  // ── Ligne de titre ────────────────────────────────────────────────────────
  // `columnSpan` fusionne le titre sur toute la largeur du tableau. Les cases
  // fusionnées suivantes doivent être déclarées `null`.
  const titleRow = [
    {
      value: title,
      fontSize: titleSizePt,
      fontWeight: 'bold' as const,
      color: VIOLET,
      columnSpan: fields.length,
      align: 'left' as const,
      alignVertical: 'center' as const,
      height: Math.round(titleSizePt * 2),
      bottomBorderColor: ROUGE,
      bottomBorderStyle: 'medium' as const,
    },
    ...Array.from({ length: fields.length - 1 }, () => null),
  ];

  // Ligne vide de respiration entre le titre et les en-têtes.
  const spacerRow = Array.from({ length: fields.length }, () => null);

  const headerRow = fields.map((f) => ({
    value: f.label,
    fontSize: headSizePt,
    fontWeight: 'bold' as const,
    color: ROUGE,
    align: 'left' as const,
    alignVertical: 'bottom' as const,
    wrap: true,
    topBorderColor: NOIR,
    topBorderStyle: 'thin' as const,
    bottomBorderColor: NOIR,
    bottomBorderStyle: 'thin' as const,
  }));

  const bodyRows = rows.map((cells, i) => cells.map((value) => ({
    value: value || undefined,
    type: String,
    fontSize: cellSizePt,
    color: NOIR,
    align: 'left' as const,
    alignVertical: 'top' as const,
    wrap: true,
    // Zébrage identique au PDF (`tbody tr:nth-child(even)`).
    backgroundColor: i % 2 === 1 ? GRIS_TRES_CLAIR : undefined,
    bottomBorderColor: GRIS,
    bottomBorderStyle: 'hair' as const,
  })));

  // Pied : compte des références, aligné sur le footer du PDF.
  const footerRow = [
    {
      value: `${projets.length} référence${projets.length > 1 ? 's' : ''}`,
      fontSize: Math.max(6, cellSizePt - 1),
      color: VIOLET,
      columnSpan: fields.length,
      topBorderColor: NOIR,
      topBorderStyle: 'thin' as const,
    },
    ...Array.from({ length: fields.length - 1 }, () => null),
  ];

  const data = [titleRow, spacerRow, headerRow, ...bodyRows, spacerRow, footerRow];

  // Largeur : longueur max du contenu de la colonne (en-tête inclus), bornée.
  // Excel compte en « caractères », d'où le +2 de marge intérieure.
  const columns = fields.map((f, col) => {
    const longest = Math.max(
      f.label.length,
      ...rows.map((r) => {
        // Une cellule multi-valeurs revient souvent avec des virgules : on
        // dimensionne sur le plus long segment plutôt que sur le total, sinon
        // une colonne « Programme » ferait 200 caractères de large.
        const v = r[col];
        return v ? Math.max(...v.split(', ').map((seg) => seg.length)) : 0;
      }),
    );
    return { width: Math.min(COL_WIDTH_MAX, Math.max(COL_WIDTH_MIN, longest + 2)) };
  });

  return {
    data,
    sheetOptions: {
      sheet: 'Références',
      columns,
      orientation: orientation === 'paysage' ? 'landscape' : undefined,
      // Titre + spacer + en-têtes restent visibles au défilement.
      stickyRowsCount: 3,
    },
  };
}

/**
 * Construit le classeur et déclenche le téléchargement dans le navigateur.
 * À n'appeler que depuis un composant client : `write-excel-file/browser` est
 * importé dynamiquement pour rester hors du bundle initial de la page.
 */
export async function exportTableauExcel({
  fileName = 'tableau-de-references',
  ...rest
}: ExportTableauExcelOptions): Promise<void> {
  const sheet = buildTableauSheet(rest);
  if (!sheet) return;
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await writeXlsxFile(sheet.data as any, sheet.sheetOptions as any).toFile(`${fileName}.xlsx`);
}
