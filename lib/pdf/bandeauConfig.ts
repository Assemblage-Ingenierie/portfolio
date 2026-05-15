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
