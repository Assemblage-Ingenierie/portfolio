import type { Statut } from '@/types/projet';

/** Rattrapage des valeurs **libres / historiques** rencontrées dans « État
 *  avancement » et qui ne correspondent à aucune option actuelle du champ.
 *
 *  ⚠ Ne JAMAIS y remettre une option qui existe réellement côté Airtable :
 *  la fiche doit afficher sa propre valeur. C'est l'entrée `'terminé' → 'Livré'`
 *  qui faisait afficher « Livré · 2022 » à une fiche marquée « Terminé »
 *  (le collapse touchait aussi `En cours` → `En chantier`). `Terminé` et
 *  `En cours` sont désormais des options Airtable de plein droit, donc
 *  reconnues par `VALID` et rendues telles quelles. */
const MAP: Record<string, Statut> = {
  'en consultation': 'En consultation',
  'str en pause': 'En pause',
  'livraison prévue en 2024': 'En chantier',
  'chantier': 'En chantier',
  'annulé': 'Abandonné',
};

/** Doit rester le miroir exact des options du champ Airtable — cf. le type
 *  `Statut` dans `types/projet.ts`. */
const VALID: Statut[] = [
  'En étude', 'Concours', 'En chantier', 'En cours', 'Livré', 'Terminé',
  'Abandonné', 'En pause', 'En consultation',
];

export function normalizeStatut(raw: string | undefined): Statut {
  if (!raw) return 'En étude';
  if (VALID.includes(raw as Statut)) return raw as Statut;
  const normalized = MAP[raw.toLowerCase().trim()];
  if (normalized) return normalized;
  return 'En étude';
}
