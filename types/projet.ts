export type Statut =
  | 'En étude'
  | 'En chantier'
  | 'Livré'
  | 'Abandonné'
  | 'En pause'
  | 'En consultation';

export type LayoutChoice = 'Éditorial' | 'Magazine';

export interface Projet {
  affaire: string;
  slug: string;
  nom: string;
  adresse?: string;
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
  pole?: string;
  departement?: string;
  rehabNeuf?: string;

  statut: Statut;
  layout: LayoutChoice;
  visiblePortfolio: boolean;

  photoCouverture?: { url: string; filename: string };
  photosProjet?: { url: string; filename: string }[];

  certifications: string[];
  materiaux: string[];
  motsCles: string[];
  tagsSiteWeb: string[];

  budgetRaw?: number;

  urlWordpress?: string;
  wpPostId?: number;

  chiffresCles?: { label: string; valeur: string }[];
}
