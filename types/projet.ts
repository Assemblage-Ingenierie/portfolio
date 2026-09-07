import type { ManualConfig } from '@/lib/pdf/manualConfig';
import type { BandeauConfig } from '@/lib/pdf/bandeauConfig';
import type { CropData } from '@/lib/pdf/photoCrop';
import type { FicheStatus } from '@/lib/pdf/projectConfig';
import type { WpConfig } from '@/lib/wordpress/wpConfig';

/** Entité CRM résolue pour rendu en lien hypertexte (nom + URL site éventuelle). */
export interface CrmLink {
  name: string;
  url?: string;
}

/** Clés des 6 champs liés à la table « Sync CRM ». */
export type CrmField =
  | 'moa'
  | 'architecte'
  | 'mandataire'
  | 'entreprise'
  | 'betAssocies'
  | 'bailleur';

/** Options du single-select Airtable « État avancement » (fldxXNdE0uNaomeby).
 *
 *  ⚠ Cette union doit refléter **exactement** les options du champ Airtable.
 *  Depuis 2026 le champ porte deux paires de quasi-synonymes assumées :
 *  `Terminé`/`Livré` et `En cours`/`En chantier`. L'app affiche la valeur
 *  brute de la fiche (pas de collapse) — cf. `normalizeStatut`. Une fiche n'a
 *  qu'une seule valeur ; ce sont les pastilles de filtre qui exposent les deux.
 *
 *  Ajouter une option côté Airtable = l'ajouter ici, dans `STATUT_BG` /
 *  `STATUT_COLOR` (`lib/ui/statutColors.ts`, typés `Record<Statut, string>`
 *  donc le compilateur refusera un oubli) et, si elle doit être filtrable,
 *  dans `STATUT_FILTER_OPTIONS`. */
export type Statut =
  | 'En étude'
  | 'Concours'
  | 'En chantier'
  | 'En cours'
  | 'Livré'
  | 'Terminé'
  | 'Abandonné'
  | 'En pause'
  | 'En consultation';

/** Ordre des pastilles du filtre Statut, partagé par les 4 pages de portfolio
 *  (home, builder, tableau, public). Les quasi-synonymes sont volontairement
 *  adjacents pour que le doublon soit lisible.
 *
 *  `Abandonné` est omis du filtre (aucune fiche ne le porte aujourd'hui) mais
 *  reste dans le type pour compat avec d'anciens records. */
export const STATUT_FILTER_OPTIONS: Statut[] = [
  'Terminé', 'Livré', 'Concours', 'En cours', 'En chantier',
  'En pause', 'En étude', 'En consultation',
];

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

  /** Versions structurées (nom + URL site) des 6 champs liés à « Sync CRM »,
   *  pour rendu en lien hypertexte (export WordPress). Les champs string
   *  ci-dessus restent la valeur jointe des noms (rétro-compat PDF/tableaux). */
  crmLinks?: Partial<Record<CrmField, CrmLink[]>>;

  surface?: number;
  budgetHT?: string;
  anneeLivraison?: number;
  /** Valeur jointe pour affichage (CSV) — multi-select Airtable. */
  missionAi?: string;
  /** Toutes les valeurs du multi-select "Mission AI" (fldgkpweXw9BypQfX). */
  missionAiValues?: string[];
  programme?: string;
  programmePrincipal?: string;
  /** Toutes les valeurs du champ multi-select Airtable "Programmes principaux"
   *  (fldKNKtsZNpvmf695). Utilisé par les filtres du portfolio. Le rendu PDF
   *  continue de n'afficher que `programmePrincipal` (premier élément). */
  programmesPrincipaux?: string[];
  /** Première valeur du multi-select "Programme secondaire" — utilisée par
   *  le rendu legacy (sous-titre du Programme dans le bandeau). */
  programmeSecondaire?: string;
  /** Toutes les valeurs du multi-select "Programme secondaire" (fldaTqKMNrIpeGBma). */
  programmesSecondaires?: string[];
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
  /** Multi-select Airtable « Tags export WP » (fld2y9rIk9DVEf9eo). Assigné
   *  comme catégories WordPress (taxonomie) à l'export. */
  tagsExportWp: string[];

  /** Méta description SEO (aiText Airtable « Méta description SEO »,
   *  fldQmXMJpDY7TrbfL) générée depuis « Description projet ». Envoyée à Yoast
   *  (`_yoast_wpseo_metadesc`) à l'export WP. */
  metaDescription?: string;

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

  /** Statut interne de production de la fiche (workflow). Stocké dans le
   *  ProjectConfig (champ Airtable "Config template manuel"). Par défaut
   *  "Pas faite" si absent. Distinct de `statut` qui est le statut métier. */
  ficheStatus?: FicheStatus;

  /** Stylisation de l'export WordPress (builder Editorial / WP1). Stockée dans
   *  le ProjectConfig (champ Airtable "Config template manuel" → clé `wp`). */
  wpConfig?: WpConfig;
}
