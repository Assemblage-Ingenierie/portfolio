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
  /** Lignes horizontales qui encadrent le bandeau métadonnées. */
  lines?: BandeauLinesStyle;
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
