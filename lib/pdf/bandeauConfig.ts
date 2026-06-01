/**
 * Configuration de la mise en forme du bandeau d'en-tête / métadonnées
 * de la fiche PDF. Trois zones distinctes :
 *  - status   → coin droit du header ("● Livré · 2025")
 *  - labels   → libellés du bandeau métadonnées (ARCHITECTE, BUDGET, …)
 *  - values   → valeurs (Encore Heureux, 8,2 M€ HT, …)
 *
 * Sérialisé en JSON dans le champ Airtable « Config bandeau » (Long text)
 * — mêmes mécaniques de persistance que `Config template manuel`.
 *
 * Identique pour les 4 templates PDF (Solo / Diptyque / Triptyque / Manuel).
 */

export type FontFamilyChoice = 'sans' | 'serif';
export type TextAlignChoice = 'left' | 'center' | 'right' | 'justify';
export type TextTransformChoice = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

export interface BandeauStyle {
  fontFamily?: FontFamilyChoice;
  /** En points (pt). Ex. 9, 10.5, 12. */
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Hex (#rrggbb) ou keyword CSS. */
  color?: string;
  /** Surlignage : couleur de fond derrière le texte. */
  background?: string;
  /** Interligne sans unité. Ex. 1.15, 1.3, 1.5. Défaut = hérité du template. */
  lineHeight?: number;
  /** Espacement entre lettres en em. Ex. 0.02, 0.05. Négatif resserre. */
  letterSpacing?: number;
  /** Espacement entre mots en em. */
  wordSpacing?: number;
  /** Alignement du texte. Défaut = hérité du template (left dans la charte). */
  textAlign?: TextAlignChoice;
  /** Transformation de casse. */
  textTransform?: TextTransformChoice;
  /** Marge supérieure en mm (peut être négative pour rapprocher). */
  marginTop?: number;
  /** Marge inférieure en mm. */
  marginBottom?: number;
  /** Padding horizontal en mm (gauche + droite). Utile avec `background`. */
  paddingX?: number;
  /** Padding vertical en mm (haut + bas). Utile avec `background`. */
  paddingY?: number;
}

/** Style des deux lignes horizontales encadrant le bandeau métadonnées. */
export interface BandeauLinesStyle {
  /** `false` masque les deux lignes (default `true` = affichées). */
  show?: boolean;
  /** Couleur des lignes (hex / keyword). Default = noir. */
  color?: string;
  /** Épaisseur en points (pt). Default = 1. */
  width?: number;
}

export interface BandeauConfig {
  /** Titre principal (h1) de la fiche. */
  titre?: BandeauStyle;
  /** Statut + année (coin droit du header). */
  status?: BandeauStyle;
  /** Libellés du bandeau métadonnées (ARCHITECTE, BUDGET…). */
  labels?: BandeauStyle;
  /** Valeurs du bandeau métadonnées. */
  values?: BandeauStyle;
  /** Sous-titre d'une cellule du bandeau métadonnées (`.t-meta-sub`).
   *  Aujourd'hui utilisé uniquement pour afficher le Programme secondaire
   *  sous la valeur principale du Programme. Style indépendant des values
   *  pour préserver la hiérarchie visuelle (secondaire = plus discret). */
  metaSub?: BandeauStyle;
  /** Description projet (paragraphes Markdown rendus). Applique font-family
   *  et font-size aux <p>/<li>/<a>/<strong>/<em> de la description sur les
   *  4 templates (Solo, Diptyque, Triptyque, Manuel/Dev). */
  description?: BandeauStyle;
  /** Bloc "Prestation Assemblage" — uniquement rendu sur le template Dev,
   *  mais le style est défini ici pour cohérence avec Description projet. */
  prestationAssemblage?: BandeauStyle;
  /** Lignes horizontales qui encadrent le bandeau métadonnées. */
  lines?: BandeauLinesStyle;
  /** Espacement vertical entre le bloc titre (.t-title-block) et le bandeau
   *  métadonnées (.t-meta-grid), exprimé en 0..100. 50 = neutre (défaut du
   *  template). En dessous → on rapproche les deux (margin-top négatif).
   *  Au-dessus → on les éloigne. Mappé sur ±TITLE_META_GAP_RANGE_MM côté
   *  render (cf. `titleMetaGapCss` dans `lib/pdf/templates/shared.ts`).
   *  Disponible sur les 4 templates PDF. */
  titleMetaGap?: number;
  /** Espacement entre la photo principale et le bloc Description projet
   *  (champ `.man-text` / `.dev-text`). 0..100, 50 = neutre. Mappé sur
   *  ±PHOTO_TEXT_GAP_RANGE_MM via `photoTextGapCss`. Disponible sur
   *  Str-Env et Dev (les templates avec photo principale + texte). */
  photoTextGap?: number;
  /** Options de visibilité de la cellule Programme du bandeau métadonnées.
   *  Permet par exemple de ne montrer que le Programme secondaire si on
   *  juge le principal redondant ou peu pertinent. */
  programme?: ProgrammeCellOptions;
  /** Distribution horizontale des cellules du bandeau (largeur par cellule,
   *  espacement entre cellules). Voir `BandeauCellsConfig`. */
  cells?: BandeauCellsConfig;
}

export interface ProgrammeCellOptions {
  /** Si `true`, le Programme secondaire est masqué — la cellule Programme
   *  n'affiche plus que le Programme principal (sans sous-titre).
   *  Si aucun principal n'est rempli, la cellule Programme entière disparaît. */
  hideSecondaire?: boolean;
}

/** Libellés canoniques des cellules potentiellement présentes dans le bandeau
 *  métadonnées, tous templates confondus (union Str-Env + Dev). L'ordre n'est
 *  pas significatif ici — il est défini par le template lui-même. */
export const CANONICAL_META_LABELS = [
  'MOA',
  'Bailleur',
  'Architecte',
  'BET associés',
  // 'Budget' + 'Surface' fusionnés en 'Budget/Surface' depuis 2026 — une
  // seule cellule à deux lignes pour gagner de la largeur dans le bandeau.
  // Les configs existantes (weights/breaks) référençant 'Budget' ou 'Surface'
  // sont silencieusement ignorées (metaGridHtml ne les pousse plus dans items).
  'Budget/Surface',
  'Entreprise',
  'Mission AI',
  'Programme',
  // Matériaux : nouveau multi-select positionné après Programme dans les
  // deux templates. Sauts de ligne par valeur configurables via breaks.
  'Matériaux',
] as const;

export type MetaLabel = typeof CANONICAL_META_LABELS[number];

export type CellsLayout = 'equal' | 'content';

export interface BandeauCellsConfig {
  /** Distribution horizontale des cellules dans le bandeau.
   *  - `'content'` (défaut) : chaque cellule prend la largeur naturelle de
   *    son contenu, l'espace libre se distribue entre les cellules.
   *  - `'equal'` : chaque cellule occupe une part égale, modulée par `weights`. */
  layout?: CellsLayout;
  /** Espace minimum entre cellules en mm (s'ajoute au padding existant). */
  gap?: number;
  /** Poids par cellule, clé = libellé (cf. `CANONICAL_META_LABELS`).
   *  - En mode `'equal'` : multiplicateur de la part `fr` (1 = défaut, 2 = double).
   *  - En mode `'content'` : `weight × 20mm` devient le `min-width` de la cellule.
   *  Une valeur ≤ 0 ou non finie est ignorée (= défaut 1). */
  weights?: Partial<Record<MetaLabel, number>>;
  /** Sauts de ligne par cellule multi-valeurs : array d'indices APRES
   *  lesquels insérer un `<br>` (à la place de la virgule). Ex. pour
   *  3 architectes [A, B, C] :
   *    - `[]`     → "A, B, C" (tout inline, défaut)
   *    - `[0]`    → "A\nB, C"
   *    - `[1]`    → "A, B\nC"
   *    - `[0, 1]` → "A\nB\nC" (un par ligne)
   *  Les indices ≥ nombre de valeurs sont ignorés silencieusement. */
  breaks?: Partial<Record<MetaLabel, number[]>>;
}

/** Demi-amplitude (en mm) du slider `titleMetaGap`. À 0% → -RANGE, à 100% → +RANGE. */
export const TITLE_META_GAP_RANGE_MM = 12;
/** Demi-amplitude (en mm) du slider `photoTextGap`. */
export const PHOTO_TEXT_GAP_RANGE_MM = 15;

/** Convertit un `titleMetaGap` (0..100, 50 = neutre) en CSS `margin-top`
 *  applicable sur `.t-meta-grid`. Retourne '' si non défini ou égal à 50. */
export function titleMetaGapCss(config?: BandeauConfig): string {
  const v = config?.titleMetaGap;
  if (v === undefined || !Number.isFinite(v)) return '';
  const clamped = Math.max(0, Math.min(100, v));
  const offsetMm = ((clamped - 50) / 50) * TITLE_META_GAP_RANGE_MM;
  if (offsetMm === 0) return '';
  return `margin-top:${offsetMm.toFixed(2)}mm`;
}

/** Convertit un `photoTextGap` (0..100, 50 = neutre) en CSS `margin-top`
 *  applicable sur `.man-text` / `.dev-text`. Retourne '' si non défini
 *  ou égal à 50. */
export function photoTextGapCss(config?: BandeauConfig): string {
  const v = config?.photoTextGap;
  if (v === undefined || !Number.isFinite(v)) return '';
  const clamped = Math.max(0, Math.min(100, v));
  const offsetMm = ((clamped - 50) / 50) * PHOTO_TEXT_GAP_RANGE_MM;
  if (offsetMm === 0) return '';
  return `margin-top:${offsetMm.toFixed(2)}mm`;
}

/** Convertit un BandeauLinesStyle en surcharges CSS pour `.t-meta-grid`. */
export function linesToCss(lines?: BandeauLinesStyle): string {
  if (!lines) return '';
  if (lines.show === false) {
    return 'border-top:none;border-bottom:none';
  }
  const parts: string[] = [];
  const color = lines.color ?? 'var(--ai-noir)';
  const width = lines.width !== undefined && Number.isFinite(lines.width) ? `${lines.width}pt` : '1pt';
  parts.push(`border-top:${width} solid ${color}`);
  parts.push(`border-bottom:${width} solid ${color}`);
  return parts.join(';');
}

export const DEFAULT_BANDEAU_CONFIG: BandeauConfig = {};

export const FONT_FAMILY_CSS: Record<FontFamilyChoice, string> = {
  sans: 'var(--sans)',
  serif: 'var(--serif)',
};

/**
 * Convertit un BandeauStyle en chaîne CSS inline applicable directement
 * sur un élément. Retourne '' si aucune propriété définie.
 */
export function styleToCss(style?: BandeauStyle): string {
  if (!style) return '';
  const parts: string[] = [];
  if (style.fontFamily) parts.push(`font-family:${FONT_FAMILY_CSS[style.fontFamily]}`);
  if (style.fontSize !== undefined && Number.isFinite(style.fontSize)) {
    parts.push(`font-size:${style.fontSize}pt`);
  }
  if (style.bold) parts.push('font-weight:700');
  if (style.italic) parts.push('font-style:italic');
  if (style.underline) parts.push('text-decoration:underline');
  if (style.color) parts.push(`color:${style.color}`);
  if (style.background) parts.push(`background:${style.background}`);
  if (style.lineHeight !== undefined && Number.isFinite(style.lineHeight)) {
    parts.push(`line-height:${style.lineHeight}`);
  }
  if (style.letterSpacing !== undefined && Number.isFinite(style.letterSpacing)) {
    parts.push(`letter-spacing:${style.letterSpacing}em`);
  }
  if (style.wordSpacing !== undefined && Number.isFinite(style.wordSpacing)) {
    parts.push(`word-spacing:${style.wordSpacing}em`);
  }
  if (style.textAlign) parts.push(`text-align:${style.textAlign}`);
  if (style.textTransform) parts.push(`text-transform:${style.textTransform}`);
  if (style.marginTop !== undefined && Number.isFinite(style.marginTop)) {
    parts.push(`margin-top:${style.marginTop}mm`);
  }
  if (style.marginBottom !== undefined && Number.isFinite(style.marginBottom)) {
    parts.push(`margin-bottom:${style.marginBottom}mm`);
  }
  if (style.paddingX !== undefined && Number.isFinite(style.paddingX)) {
    parts.push(`padding-left:${style.paddingX}mm`);
    parts.push(`padding-right:${style.paddingX}mm`);
  }
  if (style.paddingY !== undefined && Number.isFinite(style.paddingY)) {
    parts.push(`padding-top:${style.paddingY}mm`);
    parts.push(`padding-bottom:${style.paddingY}mm`);
  }
  return parts.join(';');
}

export function serializeBandeauConfig(config: BandeauConfig): string {
  return JSON.stringify(config);
}

export function deserializeBandeauConfig(raw: unknown): BandeauConfig | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as BandeauConfig;
  } catch {
    return null;
  }
}
