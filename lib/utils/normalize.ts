import type { Statut } from '@/types/projet';

const MAP: Record<string, Statut> = {
  'concours': 'En étude',
  'en consultation': 'En consultation',
  'str en pause': 'En pause',
  'livraison prévue en 2024': 'En chantier',
  'chantier': 'En chantier',
  'terminé': 'Livré',
  'annulé': 'Abandonné',
  'en cours': 'En chantier',
};

const VALID: Statut[] = [
  'En étude', 'En chantier', 'Livré', 'Abandonné', 'En pause', 'En consultation',
];

export function normalizeStatut(raw: string | undefined): Statut {
  if (!raw) return 'En étude';
  if (VALID.includes(raw as Statut)) return raw as Statut;
  const normalized = MAP[raw.toLowerCase().trim()];
  if (normalized) return normalized;
  return 'En étude';
}
