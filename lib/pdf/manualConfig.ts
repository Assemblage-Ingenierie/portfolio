/**
 * Configuration du template "Manuel" : paramètres entièrement choisis par
 * l'utilisateur (format photo principale, photos sélectionnées, sliders de
 * taille, nombre de colonnes texte, photo additionnelle optionnelle).
 *
 * Pas de persistance Airtable — la config se transmet client-side et via
 * query param base64 à la page print.
 */

export type PhotoFormat = 'paysage' | 'portrait';

export interface PhotoConfig {
  /** Index dans le tableau retourné par allPhotos(projet). */
  index: number;
  /** Pourcentage 25..100 — contrôle max-height (= % du plafond du conteneur). */
  sizePercent: number;
  /** Décalage horizontal 0..100 (0 = gauche, 50 = centre, 100 = droite).
   *  Utilisé uniquement pour les photos additionnelles. Default = 50. */
  offsetPercent?: number;
  /** Décalage vertical 0..100 (0 = haut, 50 = ligne neutre, 100 = bas).
   *  Permet de superposer la photo au texte si conflit de place — le rendu
   *  positionne la photo au-dessus de la zone texte (z-index supérieur).
   *  Default = 50 (= comportement historique : photo en flux sous le texte). */
  offsetVerticalPercent?: number;
  /** Si `false`, la photo est masquée de la fiche mais sa config est
   *  conservée. Permet de désactiver une photo additionnelle sans perdre
   *  ses sliders. Default = `true` (activée).
   *  Uniquement pris en compte pour les photos additionnelles. */
  enabled?: boolean;
}

/**
 * Liste flottante de mots-clés affichée en superposition sur la fiche.
 * Source : `Projet.motsCles` (= champ Airtable "Mots-clés"). La config ici
 * contrôle uniquement l'affichage et la position dans le template Manuel.
 */
export interface KeywordsConfig {
  /** Affiche la liste sur la fiche. Default = false. */
  show: boolean;
  /** Décalage horizontal 0..100 (50 = neutre, mappé sur ±H_RANGE_MM côté render). */
  offsetPercent?: number;
  /** Décalage vertical 0..100 (50 = neutre, mappé sur ±V_RANGE_MM côté render). */
  offsetVerticalPercent?: number;
  /** Espacement entre items en mm (default ≈ 1mm). */
  lineSpacing?: number;
  /** Si `true` → mots-clés en flow inline (plusieurs par ligne, wrap auto).
   *  Si `false`/undefined → 1 par ligne (liste verticale classique). */
  inline?: boolean;
  /** Surcharges typographiques (police, taille, B/I/U, couleur, surlignage). */
  style?: import('./bandeauConfig').BandeauStyle;
}

/**
 * Liste flottante de certifications affichée en superposition sur la fiche.
 * Source : `Projet.certifications` (= champ Airtable "Certification",
 * field id fldnb9rfM4C3m9Pcu). Comportement strictement identique à
 * `KeywordsConfig` — même type pour ne pas dupliquer la logique.
 */
export type CertificationsConfig = KeywordsConfig;

/**
 * Bloc "Prestation Assemblage" — exclusif au template Dev. Affiche le
 * titre + la valeur (Markdown rich text) du champ Airtable
 * "Prestation Assemblage" (field id flddrMLBDxOc8r4lJ). Position
 * superposée comme la liste de mots-clés, avec sliders H/V identiques.
 */
export interface PrestationAssemblageConfig {
  /** Affiche le bloc sur la fiche. Default = false. */
  show: boolean;
  /** Nombre de colonnes pour le texte rich text (1 ou 2). Default = 1. */
  columns?: 1 | 2;
  /** Décalage horizontal 0..100 (50 = neutre, mappé sur ±H_RANGE_MM côté render). */
  offsetPercent?: number;
  /** Décalage vertical 0..100 (50 = neutre, mappé sur ±V_RANGE_MM côté render). */
  offsetVerticalPercent?: number;
  /** Surcharges typographiques (police, taille, B/I/U, couleur, surlignage). */
  style?: import('./bandeauConfig').BandeauStyle;
  /** Pourcentage de caractères dans la colonne 1 (mode 2-col uniquement).
   *  Default = 50. Si 100, la col 1 contient tout le texte et la col 2
   *  est vide (largeur 50% de la page). */
  col1Percent?: number;
  /** Pourcentage de caractères dans la colonne 2 (mode 2-col uniquement).
   *  Default = 50. Si 0, la col 2 est vide. */
  col2Percent?: number;
}

/** Nombre max de photos principales en mode portrait (mainPhoto + mainPhoto2 + mainPhotosExtra). */
export const MAX_MAIN_PORTRAIT_PHOTOS = 5;

export interface ManualConfig {
  mainPhotoFormat: PhotoFormat;
  mainPhoto: PhotoConfig;
  /** Uniquement utilisé en format portrait (2 photos côte à côte). */
  mainPhoto2?: PhotoConfig;
  /** Photos principales supplémentaires (3ᵉ, 4ᵉ, 5ᵉ…) en mode portrait.
   *  Vient s'ajouter après `mainPhoto` et `mainPhoto2` dans une grille
   *  N colonnes. Vide / absent = comportement historique (1 ou 2 photos). */
  mainPhotosExtra?: PhotoConfig[];
  /** Liste flottante de mots-clés (optionnelle, superposition). */
  keywords?: KeywordsConfig;
  /** Liste flottante de certifications (optionnelle, superposition).
   *  Fonctionnement strictement identique à `keywords` mais sur le champ
   *  Airtable "Certification" (field id fldnb9rfM4C3m9Pcu). */
  certifications?: CertificationsConfig;
  /** Bloc "Prestation Assemblage" (template Dev uniquement). */
  prestationAssemblage?: PrestationAssemblageConfig;
  /** @deprecated Remplacé par `BandeauConfig.titleMetaGap` (rendu shared.ts,
   *  appliqué sur les 4 templates). Champ conservé pour ne pas casser les
   *  configs Airtable historiques — sa valeur n'est plus lue côté render. */
  bandeauVerticalOffset?: number;
  textColumns: 1 | 2;
  /** % du texte total à afficher en col 1 (0..100). Le point de coupure exact
   *  est calé sur le "." le plus proche de cette position. */
  textCol1Percent: number;
  /** % du texte total à afficher en col 2 (0..100), démarrant après la fin de col 1.
   *  Si col1% + col2% < 100, le reste du texte est masqué. */
  textCol2Percent: number;
  /**
   * Photos additionnelles arrangées en grille (largeur de page / N) sous le texte.
   * Quel que soit le mode texte (1 ou 2 colonnes), les photos vont après le bloc texte.
   * Vide ou absent → pas de photo additionnelle.
   */
  extraPhotos?: PhotoConfig[];
}

export const DEFAULT_MANUAL_CONFIG: ManualConfig = {
  mainPhotoFormat: 'paysage',
  mainPhoto: { index: 0, sizePercent: 100 },
  textColumns: 2,
  textCol1Percent: 50,
  textCol2Percent: 50,
  extraPhotos: [],
};

/** Encode la config en base64 URL-safe pour transit dans un query param. */
export function encodeConfig(c: ManualConfig): string {
  const json = JSON.stringify(c);
  // btoa ne supporte pas l'UTF-8 brut → on encode d'abord en URI puis on décode latin1
  const utf8 = unescape(encodeURIComponent(json));
  return btoa(utf8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Décode la config depuis le base64 URL-safe. Retourne null si invalide. */
export function decodeConfig(raw: string): ManualConfig | null {
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const utf8 = atob(padded);
    const json = decodeURIComponent(escape(utf8));
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== 'object') return null;
    return obj as ManualConfig;
  } catch {
    return null;
  }
}

/** Une entrée d'historique = config + horodatage. */
export interface ManualConfigHistoryEntry {
  /** Timestamp Unix (ms) du moment où la config a été utilisée pour un export. */
  ts: number;
  config: ManualConfig;
}

/** Nombre maximum d'entrées conservées dans l'historique (anti-bloat Airtable). */
export const MAX_HISTORY_ENTRIES = 10;

/** Sérialise une config unique en JSON pour stockage dans un champ Airtable Long text. */
export function serializeConfig(config: ManualConfig): string {
  return JSON.stringify(config);
}

/** Désérialise une config unique depuis un champ Airtable. Retourne null si invalide. */
export function deserializeConfig(raw: unknown): ManualConfig | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    return obj as ManualConfig;
  } catch {
    return null;
  }
}

/** Sérialise l'historique en JSON pour stockage dans le champ Airtable
 *  "Config template manuel" (type Long text). */
export function serializeHistory(entries: ManualConfigHistoryEntry[]): string {
  return JSON.stringify(entries.slice(0, MAX_HISTORY_ENTRIES));
}

/** Désérialise l'historique depuis le contenu Airtable. Tolère les valeurs
 *  vides, mal formées, ou anciens formats — retourne [] dans ces cas. */
export function deserializeHistory(raw: unknown): ManualConfigHistoryEntry[] {
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is ManualConfigHistoryEntry =>
        e && typeof e === 'object' && typeof e.ts === 'number' && e.config && typeof e.config === 'object'
    );
  } catch {
    return [];
  }
}
