/**
 * Configuration de stylisation de l'export WordPress (builder Editorial / WP1).
 *
 * Stockée dans le champ Airtable unifié « Config template manuel »
 * (cf. `ProjectConfig.wp`), à côté des configs PDF (`bandeau`, `manuel`).
 * Les deux pipelines de rendu restent séparés (cf. CLAUDE.md) — cette config
 * ne pilote QUE le HTML WordPress, jamais le PDF.
 *
 * ⚠ Les valeurs de `DEFAULT_WP_CONFIG` reproduisent EXACTEMENT le rendu
 * historique de `buildWpEditorial` : une fiche sans `wpConfig` doit rendre
 * comme avant l'introduction de la config.
 */
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

export const DEFAULT_WP_CONFIG: Required<{
  typo: Required<NonNullable<WpConfig['typo']>>;
  photos: Required<NonNullable<WpConfig['photos']>>;
}> = {
  typo: {
    descriptionSizePx: 16,
    descriptionLineHeight: 1.7,
    fieldsSizePt: 13,
    pitchSizePx: 20,
    sectionTitleSizePx: 22,
  },
  photos: {
    coverAspectRatio: '4/3',
    coverFullWidth: false,
    galleryColumns: 0,
    galleryAspectRatio: '4/3',
    galleryGapPx: 12,
  },
};

/** Ratios proposés dans l'UI pour les photos. */
export const WP_ASPECT_RATIOS = ['4/3', '3/2', '16/9', '1/1', '3/4'] as const;

/** Fusionne une config partielle avec les défauts (merge profond 1 niveau). */
export function resolveWpConfig(cfg?: WpConfig) {
  return {
    typo: { ...DEFAULT_WP_CONFIG.typo, ...(cfg?.typo ?? {}) },
    photos: { ...DEFAULT_WP_CONFIG.photos, ...(cfg?.photos ?? {}) },
  };
}

export type ResolvedWpConfig = ReturnType<typeof resolveWpConfig>;
