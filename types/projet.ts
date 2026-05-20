import type { ManualConfig } from '@/lib/pdf/manualConfig';
import type { BandeauConfig } from '@/lib/pdf/bandeauConfig';
import type { CropData } from '@/lib/pdf/photoCrop';

export type Statut =
  | 'En étude'
  | 'En chantier'
  | 'Livré'
  | 'Abandonné'
  | 'En pause'
  | 'En consultation';

export type TemplateChoice = 'Solo' | 'Diptyque' | 'Triptyque' | 'Str-Env' | 'Dev';

export const TEMPLATE_OPTIONS: TemplateChoice[] = ['Str-Env', 'Dev'];

export interface Projet {
  affaire: string;
  slug: string;
  nom: string;
  adresse?: string;
  lieu?: string;
  pitch?: string;
  description: string;

  moa?: string;
  architecte?: string;
  mandataire?: string;
  betAssocies?: string;
  entreprise?: string;
  bailleur?: string;
  referentAi?: string;

  surface?: number;
  budgetHT?: string;
  anneeLivraison?: number;
  missionAi?: string;
  programme?: string;
  programmePrincipal?: string;
  /** Toutes les valeurs du champ multi-select Airtable "Programmes principaux"
   *  (fldKNKtsZNpvmf695). Utilisé par les filtres du portfolio. Le rendu PDF
   *  continue de n'afficher que `programmePrincipal` (premier élément). */
  programmesPrincipaux?: string[];
  programmeSecondaire?: string;
  pole?: string;
  /** Champ Airtable "Vignette pôle" (field id fld1PZuYO8mz0sULA) — multi-select
   *  STR / ENV / DEV. Pilote l'affichage des vignettes en en-tête : valeurs
   *  présentes = rouge (couleurs SVG d'origine), absentes = grisé. */
  vignettePoles?: string[];
  departement?: string;
  /** Valeur jointe pour affichage/recherche textuelle (ex : "Neuf, Réhab"). */
  rehabNeuf?: string;
  /** Valeurs brutes du multi-select Airtable "Rehab / Neuf" — pour les filtres AND. */
  rehabNeufValues?: string[];

  /** Champ Airtable "Prestation Assemblage" (field id flddrMLBDxOc8r4lJ) — long
   *  text rich text (Markdown). Affiché dans un bloc dédié du template Dev. */
  prestationAssemblage?: string;

  statut: Statut;
  /** Valeurs brutes du multi-select Airtable "Statut" (field fldxXNdE0uNaomeby) —
   *  pour les filtres AND. Contient au moins `statut` si le champ multi-select
   *  est absent (fallback sur `État avancement`). */
  statutValues?: Statut[];
  template: TemplateChoice;
  visiblePortfolio: boolean;

  photoCouverture?: { url: string; filename: string; width?: number; height?: number };
  photosProjet?: { url: string; filename: string; width?: number; height?: number }[];

  certifications: string[];
  materiaux: string[];
  motsCles: string[];
  tagsSiteWeb: string[];

  budgetRaw?: number;

  urlWordpress?: string;
  wpPostId?: number;

  chiffresCles?: { label: string; valeur: string }[];

  /** Mise en page Manuel sauvegardée explicitement par l'utilisateur.
   *  Stocké dans le champ Airtable "Config template manuel" (Long text JSON). */
  savedManualConfig?: ManualConfig;

  /** Configuration typographique du bandeau (header + meta grid).
   *  Stocké dans le champ Airtable "Config bandeau" (Long text JSON). */
  bandeauConfig?: BandeauConfig;

  /** Crops non-destructifs par photo (clé = filename). Stocké dans le
   *  ProjectConfig unifié (champ Airtable "Config template manuel"). */
  photoCrops?: Record<string, CropData>;

  /** Période de prestation pour le template Dev (header haut à droite).
   *  Sourcée depuis ProjectConfig.portfolio (champ Airtable "Config template
   *  manuel"). Format ISO YYYY-MM-DD. Si absente, le header retombe sur le
   *  rendu statut + année. */
  portfolioPeriod?: {
    dateDemarrage?: string;
    dateFinEstimee?: string;
  };
}
