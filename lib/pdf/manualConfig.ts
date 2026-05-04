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
}

export interface ManualConfig {
  mainPhotoFormat: PhotoFormat;
  mainPhoto: PhotoConfig;
  /** Uniquement utilisé en format portrait (2 photos côte à côte). */
  mainPhoto2?: PhotoConfig;
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
