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
const VIOLET = '#30323E';
const GRIS = '#DFE4E8';
const NOIR70 = '#4D4D4D';
const NOIR = '#000000';

/** Palette de couleurs Assemblage proposée dans les sélecteurs de l'UI WP.
 *  (Le builder WP est autonome → valeurs hex en dur, miroir de styles/tokens.css.) */
export const ASSEMBLAGE_PALETTE: { name: string; hex: string }[] = [
  { name: 'Noir', hex: NOIR },
  { name: 'Violet', hex: VIOLET },
  { name: 'Rouge', hex: ROUGE },
  { name: 'Gris foncé', hex: NOIR70 },
  { name: 'Gris', hex: GRIS },
  { name: 'Gris moyen', hex: '#8a9099' },
];

/** Template d'export WP, dérivé de la Vignette pôle (DEV → Dev, sinon Str-Env). */
export type WpTemplate = 'Str-Env' | 'Dev';

export function wpTemplateFor(vignettePoles?: string[]): WpTemplate {
  return (vignettePoles ?? []).some((p) => String(p).toUpperCase() === 'DEV') ? 'Dev' : 'Str-Env';
}

/** Clés stables des champs du bandeau (alignées sur le bandeau PDF des fiches,
 *  mais Budget et Surface restent deux cellules distinctes côté WP). */
export type WpFieldKey =
  | 'moa'
  | 'bailleur'
  | 'architecte'
  | 'betAssocies'
  | 'budget'
  | 'surface'
  | 'entreprise'
  | 'missionAi'
  | 'programme'
  // `programmeSecondaire` n'est PAS une cellule autonome : sa valeur est rendue
  // dans la cellule Programme (après le principal, séparée d'un point médian).
  // Présente dans l'ordre uniquement pour exposer ses options typo dans l'UI.
  | 'programmeSecondaire'
  | 'materiaux';

/** Libellés affichés (mêmes sigles que le bandeau PDF). */
export const WP_FIELD_LABELS: Record<WpFieldKey, string> = {
  moa: 'MOA',
  bailleur: 'Bailleur',
  architecte: 'Architecte',
  betAssocies: 'BET associés',
  budget: 'Budget',
  surface: 'Surface',
  entreprise: 'Entreprise',
  missionAi: 'Mission AI',
  programme: 'Programme',
  programmeSecondaire: 'Programme secondaire',
  materiaux: 'Matériaux',
};

/** Ordre des champs du bandeau WP Str-Env (miroir de `metaGridHtml` Str-Env). */
export const WP_FIELDS_STR_ENV: WpFieldKey[] = [
  'moa', 'architecte', 'betAssocies', 'budget', 'surface', 'entreprise', 'missionAi', 'programme', 'programmeSecondaire', 'materiaux',
];

/** Ordre des champs du bandeau WP Dev (miroir de `metaGridHtml` isDev). */
export const WP_FIELDS_DEV: WpFieldKey[] = [
  'moa', 'bailleur', 'architecte', 'budget', 'surface', 'programme', 'programmeSecondaire', 'materiaux', 'missionAi', 'betAssocies',
];

export function wpFieldOrder(template: WpTemplate): WpFieldKey[] {
  return template === 'Dev' ? WP_FIELDS_DEV : WP_FIELDS_STR_ENV;
}

/** Surcharge de style par champ (toutes les clés optionnelles → fallback global). */
export interface WpFieldStyle {
  hidden?: boolean;
  labelBold?: boolean;
  valueBold?: boolean;
  labelColor?: string;
  valueColor?: string;
  /** Taille de police du champ (pt). Si absent → défaut global `typo.fieldsSizePt`. */
  sizePt?: number;
  /** Valeur rendue en petites capitales (font-variant: small-caps). Défaut false. */
  smallCaps?: boolean;
  /** Valeur rendue en grandes capitales (text-transform: uppercase). Défaut false. */
  upperCase?: boolean;
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
  /** Espacements verticaux (px) du haut de la fiche. */
  spacing?: {
    /** Entre le titre (thème WP) et la phrase d'accroche — marge au-dessus
     *  du bloc d'en-tête. Défaut 0. */
    titlePitchPx?: number;
    /** Entre la phrase d'accroche et la photo. Défaut 40. */
    pitchPhotoPx?: number;
    /** Entre la photo et la description. Défaut 48. */
    photoDescPx?: number;
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
    galleryColumns?: 0 | 1 | 2 | 3 | 4;
    /** Ratio des photos de galerie (CSS aspect-ratio). Défaut '4/3'. */
    galleryAspectRatio?: string;
    /** Espacement entre photos de galerie (px). Défaut 12. */
    galleryGapPx?: number;
    /** Filename de la photo utilisée comme couverture. Si absent → photo
     *  désignée par Airtable (`projet.photoCouverture`). Permet à l'utilisateur
     *  de choisir n'importe quelle photo du projet comme couverture. */
    coverFilename?: string;
    /** Offset horizontal (0-100, %) appliqué en object-position sur la couverture. */
    coverOffsetX?: number;
    /** Offset vertical (0-100, %) appliqué en object-position sur la couverture. */
    coverOffsetY?: number;
    /** Réglages par photo de galerie (clé = filename). Permet d'activer /
     *  désactiver une photo et de régler son cadrage (object-position). */
    perPhoto?: Record<string, {
      enabled?: boolean;
      offsetX?: number;
      offsetY?: number;
    }>;
    /** Position du bloc « Prestation Assemblage » (template Dev uniquement).
     *  Défaut 'after-description'. */
    prestationPosition?: 'before-description' | 'after-description' | 'after-photos';
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
  spacing: {
    titlePitchPx: 0,
    pitchPhotoPx: 40,
    photoDescPx: 48,
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
    galleryColumns: 0 as 0 | 1 | 2 | 3 | 4,
    galleryAspectRatio: '4/3',
    galleryGapPx: 12,
    coverFilename: undefined as string | undefined,
    coverOffsetX: 50,
    coverOffsetY: 50,
    perPhoto: {} as Record<string, { enabled?: boolean; offsetX?: number; offsetY?: number }>,
    prestationPosition: 'after-description' as 'before-description' | 'after-description' | 'after-photos',
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
    spacing: { ...DEFAULT_WP_CONFIG.spacing, ...(cfg?.spacing ?? {}) },
    categories: { ...DEFAULT_WP_CONFIG.categories, ...(cfg?.categories ?? {}) },
    photos: { ...DEFAULT_WP_CONFIG.photos, ...(cfg?.photos ?? {}) },
  };
}

export type ResolvedWpConfig = ReturnType<typeof resolveWpConfig>;

/** Réglages effectifs d'une photo de galerie (défauts si absent). */
export function effectivePhotoSettings(resolved: ResolvedWpConfig, filename: string) {
  const ov = resolved.photos.perPhoto[filename] ?? {};
  return {
    enabled: ov.enabled ?? true,
    offsetX: ov.offsetX ?? 50,
    offsetY: ov.offsetY ?? 50,
  };
}

/** Style effectif d'un champ donné (override > défaut global).
 *  `sizePt` reste `undefined` si non surchargé → le rendu retombe sur
 *  `typo.fieldsSizePt`. */
export function effectiveFieldStyle(resolved: ResolvedWpConfig, key: WpFieldKey) {
  const ov = resolved.fields.overrides[key] ?? {};
  return {
    hidden: ov.hidden ?? false,
    labelBold: ov.labelBold ?? resolved.fields.labelBold,
    valueBold: ov.valueBold ?? resolved.fields.valueBold,
    labelColor: ov.labelColor ?? resolved.fields.labelColor,
    valueColor: ov.valueColor ?? resolved.fields.valueColor,
    sizePt: ov.sizePt,
    smallCaps: ov.smallCaps ?? false,
    upperCase: ov.upperCase ?? false,
  };
}
