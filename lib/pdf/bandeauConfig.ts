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
}

export interface BandeauConfig {
  status?: BandeauStyle;
  labels?: BandeauStyle;
  values?: BandeauStyle;
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
