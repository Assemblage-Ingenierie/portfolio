import type { BandeauConfig } from './bandeauConfig';
import type { ManualConfig } from './manualConfig';
import type { CropData } from './photoCrop';
import type { WpConfig } from '@/lib/wordpress/wpConfig';
import { color, feedback } from '@/lib/ui/tokens';

/**
 * Configuration unifiée d'une fiche projet, stockée en JSON dans le champ
 * Airtable « Config template manuel » (Long text — nom historique conservé).
 *
 * - `bandeau` : mise en forme du bandeau d'en-tête + grille métadonnées.
 *   Valable pour les 4 templates PDF (générale).
 * - `manuel`  : configuration du template `Manuel` (format photo, sliders,
 *   photos additionnelles). Présente uniquement si le projet utilise ce
 *   template.
 *
 * Schéma volontairement plat (1 niveau d'imbrication) pour rester
 * compatible avec un éventuel élargissement futur (config Triptyque, etc.).
 *
 * **Compat ascendante** : si le champ Airtable contient encore un
 * ManualConfig "à plat" (legacy), le deserializer l'enveloppe automatiquement
 * dans `{ manuel: … }` à la lecture.
 */
/** Workflow interne de production d'une fiche. Stocké dans `ProjectConfig`
 *  (champ Airtable « Config template manuel ») pour éviter d'ajouter une
 *  colonne dédiée. Distinct du `Statut` métier (En chantier / Livré / …). */
export type FicheStatus =
  | 'Pas faite'
  | 'En cours'
  | 'En attente de validation'
  | 'Prête pour publication'
  /** Posé automatiquement par l'export WP (`/api/projet/[slug]/publish`)
   *  quand l'article part en ligne. Sélectionnable à la main par un admin
   *  seulement, pour corriger un statut erroné. */
  | 'Publié'
  /** Posé à la main par la personne qui relit les fiches quand une
   *  correction est nécessaire. C'est le statut qui DÉVERROUILLE une fiche
   *  publiée (cf. `isFicheLocked`). */
  | 'À mettre à jour';

/** Ordre du cycle de vie — pilote l'ordre d'affichage dans le panneau « État de
 *  publication » de la home ET dans le sélecteur de la toolbar. */
export const FICHE_STATUS_VALUES: FicheStatus[] = [
  'Pas faite',
  'En cours',
  'En attente de validation',
  'Prête pour publication',
  'Publié',
  'À mettre à jour',
];

/** Statuts qui **verrouillent** la mise en page en lecture seule.
 *  Centralisé ici pour ne plus comparer des littéraux de chaîne un peu partout
 *  (cf. `ProjetView`, `FicheStatusPopup`). */
export const FICHE_STATUS_LOCKED: readonly FicheStatus[] = [
  'Prête pour publication',
  'Publié',
];

export function isFicheLocked(status: FicheStatus | undefined): boolean {
  return FICHE_STATUS_LOCKED.includes(status ?? DEFAULT_FICHE_STATUS);
}

/** Statuts que seul un **admin** peut sélectionner à la main. Vérifié côté
 *  client (menu grisé) ET côté serveur (`/api/projet/[slug]/fields`). */
export const FICHE_STATUS_ADMIN_ONLY: readonly FicheStatus[] = [
  'Prête pour publication',
  'Publié',
];

export function isFicheStatusAdminOnly(status: FicheStatus): boolean {
  return FICHE_STATUS_ADMIN_ONLY.includes(status);
}

export const DEFAULT_FICHE_STATUS: FicheStatus = 'Pas faite';

/** Couleur associée à chaque statut de fiche — partagée entre la home
 *  (`PortfolioGrid`) et l'éditeur (`ProjetToolbar`) pour que la pastille de
 *  statut soit cohérente partout. */
export const FICHE_STATUS_COLOR: Record<FicheStatus, string> = {
  'Pas faite': '#9e9e9e',
  'En cours': feedback.info,
  'En attente de validation': feedback.attente,
  'Prête pour publication': feedback.succes,
  'Publié': color.violet as string,
  'À mettre à jour': feedback.erreur,
};

export const FICHE_STATUS_MESSAGES: Record<FicheStatus, string> = {
  'Pas faite':
    "Cette fiche n'a pas encore été travaillée, la mise en page n'est pas représentative d'une fiche terminée.",
  'En cours': 'La mise en page de cette fiche est en cours.',
  'En attente de validation':
    'La mise en page de cette fiche est en attente de validation.',
  'Prête pour publication':
    "Cette fiche est prête pour être publiée dans le portfolio. Il n'est plus possible de modifier la mise en page.",
  'Publié':
    "Cette fiche est publiée sur assemblage.net. La mise en page est verrouillée : passez le statut à « À mettre à jour » pour la corriger.",
  'À mettre à jour':
    'Une mise à jour a été demandée sur cette fiche. La mise en page est déverrouillée.',
};

export interface ProjectConfig {
  bandeau?: BandeauConfig;
  manuel?: ManualConfig;
  /** Crops non-destructifs par photo (clé = filename de l'attachment).
   *  Appliqué au rendu via CSS dans les templates PDF. */
  photoCrops?: Record<string, CropData>;
  /** Métadonnées de portfolio (template Dev) : dates de la prestation
   *  affichées en en-tête à la place du statut. Format ISO YYYY-MM-DD. */
  portfolio?: {
    date_demarrage?: string;
    date_fin_estimee?: string;
  };
  /** Statut de production interne (workflow). Par défaut : 'Pas faite'. */
  ficheStatus?: FicheStatus;
  /** Stylisation de l'export WordPress (builder Editorial / WP1).
   *  Indépendante des configs PDF (`bandeau`, `manuel`). */
  wp?: WpConfig;
}

export const PROJECT_CONFIG_FIELD = 'Config template manuel';

export function serializeProjectConfig(c: ProjectConfig): string {
  return JSON.stringify(c);
}

export function deserializeProjectConfig(raw: unknown): ProjectConfig | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    // Détection format legacy : un ManualConfig "à plat" a des clés
    // racine comme mainPhotoFormat / mainPhoto / textColumns.
    if (
      'mainPhotoFormat' in parsed ||
      'mainPhoto' in parsed ||
      'textColumns' in parsed
    ) {
      return { manuel: parsed as ManualConfig };
    }
    return parsed as ProjectConfig;
  } catch {
    return null;
  }
}
