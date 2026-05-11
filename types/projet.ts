import type { ManualConfig } from '@/lib/pdf/manualConfig';
import type { BandeauConfig } from '@/lib/pdf/bandeauConfig';

export type Statut =
  | 'En étude'
  | 'En chantier'
  | 'Livré'
  | 'Abandonné'
  | 'En pause'
  | 'En consultation';

export type TemplateChoice = 'Solo' | 'Diptyque' | 'Triptyque' | 'Manuel' | 'Dev';

export const TEMPLATE_OPTIONS: TemplateChoice[] = ['Solo', 'Diptyque', 'Triptyque', 'Manuel', 'Dev'];

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
  programmeSecondaire?: string;
  pole?: string;
  departement?: string;
  rehabNeuf?: string;

  statut: Statut;
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
}
