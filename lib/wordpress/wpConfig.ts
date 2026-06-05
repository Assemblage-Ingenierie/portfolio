/**
 * Configuration de stylisation de l'export WordPress (builder Editorial / WP1).
 *
 * Stockée dans le champ Airtable unifié « Config template manuel »
 * (cf. `ProjectConfig.wp`), à côté des configs PDF (`bandeau`, `manuel`).
 * Les deux pipelines de rendu restent séparés (cf. CLAUDE.md) — cette config
 * ne pilote QUE le HTML WordPress, jamais le PDF.
 *
 * ⚠ `DEFAULT_WP_CONFIG` est le rendu de référence de l'export WordPress
 * (libellés non gras, valeurs en gras, libellé « Mission AI » en rouge). Une
 * fiche sans `wpConfig` rend selon ces défauts.
 */

/** Couleurs de marque référencées par les défauts (le builder est autonome). */
const ROUGE = '#E30513';
const NOIR = '#000000';

/** Clés stables des champs du bandeau (liste à droite de la couverture). */
export type WpFieldKey =
  | 'lieu'
  | 'moa'
  | 'architecte'
  | 'missionAi'
  | 'mandataire'
  | 'betAssocies'
  | 'entreprise'
  | 'bailleur'
  | 'programme'
  | 'surface'
  | 'budget'
  | 'etat';

/** Libellés affichés (et utilisés dans l'UI de réglage). */
export const WP_FIELD_LABELS: Record<WpFieldKey, string> = {
  lieu: 'Lieu',
  moa: "Maître d'ouvrage",
  architecte: 'Architecte',
  missionAi: 'Mission AI',
  mandataire: 'Mandataire',
  betAssocies: 'BET associés',
  entreprise: 'Entreprise',
  bailleur: 'Bailleur',
  programme: 'Programme',
  surface: 'Surface',
  budget: 'Budget',
  etat: 'État',
};

/** Ordre canonique de rendu des champs du bandeau. */
export const WP_FIELD_ORDER: WpFieldKey[] = [
  'lieu', 'moa', 'architecte', 'missionAi', 'mandataire',
  'betAssocies', 'entreprise', 'bailleur', 'programme', 'surface', 'budget', 'etat',
];

/** Surcharge de style par champ (toutes les clés optionnelles → fallback global). */
export interface WpFieldStyle {
  hidden?: boolean;
  labelBold?: boolean;
  valueBold?: boolean;
  labelColor?: string;
  valueColor?: string;
}

export interface WpConfig {
  typo?: {
    /** Taille de police de la description (markdown). Défaut 16 (px). */
    descriptionSizePx?: number;
    /** Interlignage de la description. Défaut 1.7. */
    descriptionLineHeight?: number;
    /** Taille de la liste des champs clés (à droite de la photo). Défaut 13 (pt). */
    fieldsSizePt?: number;
    /** Taille du pitch (chapô italique). Défaut 20 (px). */
    pitchSizePx?: number;
    /** Taille des titres de section (ex. « Prestation Assemblage »). Défaut 22 (px). */
    sectionTitleSizePx?: number;
  };
  /** Typographie individuelle des champs du bandeau (libellé vs valeur). */
  fields?: {
    /** Défaut global : libellés en gras. Défaut false. */
    labelBold?: boolean;
    /** Défaut global : valeurs en gras. Défaut true. */
    valueBold?: boolean;
    /** Défaut global : couleur des libellés. Défaut noir. */
    labelColor?: string;
    /** Défaut global : couleur des valeurs. Défaut noir. */
    valueColor?: string;
    /** Surcharges par champ (priorité sur les défauts globaux ci-dessus). */
    overrides?: Partial<Record<WpFieldKey, WpFieldStyle>>;
  };
  /** Catégories (« Tags site web ») rendues en tête de contenu. */
  categories?: {
    /** Affiche la ligne de catégories. Défaut true. */
    show?: boolean;
    /** Taille de police (px). Défaut 11. */
    sizePx?: number;
    /** Couleur. Défaut gris moyen. */
    color?: string;
    /** Mise en majuscules. Défaut false. */
    uppercase?: boolean;
  };
  photos?: {
    /** Ratio de la photo de couverture (CSS aspect-ratio). Défaut '4/3'. */
    coverAspectRatio?: string;
    /** Couverture en pleine largeur au-dessus des champs (au lieu de côte à côte). Défaut false. */
    coverFullWidth?: boolean;
    /** Colonnes de la galerie. 0 = auto (1/2/3 selon le nombre). Défaut 0. */
    galleryColumns?: 0 | 1 | 2 | 3;
    /** Ratio des photos de galerie (CSS aspect-ratio). Défaut '4/3'. */
    galleryAspectRatio?: string;
    /** Espacement entre photos de galerie (px). Défaut 12. */
    galleryGapPx?: number;
  };
}

export const DEFAULT_WP_CONFIG = {
  typo: {
    descriptionSizePx: 16,
    descriptionLineHeight: 1.7,
    fieldsSizePt: 13,
    pitchSizePx: 20,
    sectionTitleSizePx: 22,
  },
  fields: {
    labelBold: false,
    valueBold: true,
    labelColor: NOIR,
    valueColor: NOIR,
    // « Mission AI » : libellé en rouge, valeur en noir (par défaut).
    overrides: {
      missionAi: { labelColor: ROUGE },
    } as Partial<Record<WpFieldKey, WpFieldStyle>>,
  },
  categories: {
    show: true,
    sizePx: 11,
    color: '#8a9099',
    uppercase: false,
  },
  photos: {
    coverAspectRatio: '4/3',
    coverFullWidth: false,
    galleryColumns: 0 as 0 | 1 | 2 | 3,
    galleryAspectRatio: '4/3',
    galleryGapPx: 12,
  },
};

/** Ratios proposés dans l'UI pour les photos. */
export const WP_ASPECT_RATIOS = ['4/3', '3/2', '16/9', '1/1', '3/4'] as const;

/** Fusionne une config partielle avec les défauts. */
export function resolveWpConfig(cfg?: WpConfig) {
  return {
    typo: { ...DEFAULT_WP_CONFIG.typo, ...(cfg?.typo ?? {}) },
    fields: {
      labelBold: cfg?.fields?.labelBold ?? DEFAULT_WP_CONFIG.fields.labelBold,
      valueBold: cfg?.fields?.valueBold ?? DEFAULT_WP_CONFIG.fields.valueBold,
      labelColor: cfg?.fields?.labelColor ?? DEFAULT_WP_CONFIG.fields.labelColor,
      valueColor: cfg?.fields?.valueColor ?? DEFAULT_WP_CONFIG.fields.valueColor,
      overrides: {
        ...DEFAULT_WP_CONFIG.fields.overrides,
        ...(cfg?.fields?.overrides ?? {}),
      } as Partial<Record<WpFieldKey, WpFieldStyle>>,
    },
    categories: { ...DEFAULT_WP_CONFIG.categories, ...(cfg?.categories ?? {}) },
    photos: { ...DEFAULT_WP_CONFIG.photos, ...(cfg?.photos ?? {}) },
  };
}

export type ResolvedWpConfig = ReturnType<typeof resolveWpConfig>;

/** Style effectif d'un champ donné (override > défaut global). */
export function effectiveFieldStyle(
  resolved: ResolvedWpConfig,
  key: WpFieldKey,
): Required<WpFieldStyle> {
  const ov = resolved.fields.overrides[key] ?? {};
  return {
    hidden: ov.hidden ?? false,
    labelBold: ov.labelBold ?? resolved.fields.labelBold,
    valueBold: ov.valueBold ?? resolved.fields.valueBold,
    labelColor: ov.labelColor ?? resolved.fields.labelColor,
    valueColor: ov.valueColor ?? resolved.fields.valueColor,
  };
}
