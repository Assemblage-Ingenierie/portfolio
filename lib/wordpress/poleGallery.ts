import type { Projet } from '@/types/projet';
import { appendToPoleGallery } from './client';

/**
 * Mapping pôle → galerie « Portfolio Filter Gallery Premium » (CPT
 * `awl_filter_gallery`) qui alimente les pages de pôle du site :
 *   - Développement → /developpement/  → galerie 4904
 *   - Environnement → /environnement/  → galerie 7826
 *   - Structure     → /structure/      → galerie 2461
 *
 * Les ids sont surchargables par variable d'environnement (au cas où les
 * galeries seraient recréées côté WordPress) — cf. `.env.example`.
 *
 * Le pôle d'un projet vient du champ Airtable « Vignette pôle »
 * (`fld1PZuYO8mz0sULA` → `projet.vignettePoles`, valeurs STR / ENV / DEV).
 * Un projet multi-pôle est ajouté dans CHAQUE galerie correspondante.
 */

export type PoleKey = 'DEV' | 'ENV' | 'STR';

export interface PoleGalleryTarget {
  pole: PoleKey;
  /** Libellé de la page de pôle (pour les messages UI). */
  label: string;
  galleryId: number;
}

function galleryId(pole: PoleKey): number {
  const env = {
    DEV: process.env.WP_PFG_GALLERY_DEV,
    ENV: process.env.WP_PFG_GALLERY_ENV,
    STR: process.env.WP_PFG_GALLERY_STR,
  }[pole];
  const fallback = { DEV: 4904, ENV: 7826, STR: 2461 }[pole];
  const parsed = env ? Number(env) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const POLE_LABEL: Record<PoleKey, string> = {
  DEV: 'Développement',
  ENV: 'Environnement',
  STR: 'Structure',
};

/**
 * Résout la liste des galeries de pôle correspondant aux Vignettes pôle d'un
 * projet. Tolérant à la casse / aux variantes ; dédoublonne par pôle.
 */
export function pfgGalleriesForPoles(vignettePoles?: string[]): PoleGalleryTarget[] {
  const seen = new Set<PoleKey>();
  const targets: PoleGalleryTarget[] = [];
  for (const raw of vignettePoles ?? []) {
    const v = String(raw).trim().toUpperCase();
    let pole: PoleKey | undefined;
    if (v === 'DEV') pole = 'DEV';
    else if (v === 'ENV') pole = 'ENV';
    else if (v === 'STR') pole = 'STR';
    if (!pole || seen.has(pole)) continue;
    seen.add(pole);
    targets.push({ pole, label: POLE_LABEL[pole], galleryId: galleryId(pole) });
  }
  return targets;
}

/** Ligne « lieu » d'une tuile : champ Airtable `Lieu`, fallback `adresse`. */
export function poleTileLocation(projet: Projet): string {
  return (projet.lieu ?? projet.adresse ?? '').trim();
}

/**
 * Registre global des filtres PFG (option WP `awl_portfolio_filter_gallery_categories`).
 * L'id d'un filtre = l'index dans le tableau du plugin. Figé ici (le registre
 * change rarement ; il est append-only). Source : lecture de l'option + ajout
 * des catégories Matériaux/Programme principal manquantes (cf. docs/wordpress/).
 * ⚠ Si de nouvelles catégories sont ajoutées côté WP, compléter cette liste.
 */
const PFG_FILTER_REGISTRY: { id: number; label: string }[] = [
  { id: 1, label: 'Acier' }, { id: 2, label: 'Béton' }, { id: 3, label: 'Bois' },
  { id: 4, label: 'Verre' }, { id: 5, label: 'Réhabilitation' }, { id: 6, label: 'Neuf' },
  { id: 7, label: 'Pont' }, { id: 8, label: 'Ouvrage spécial' }, { id: 9, label: 'Flottant' },
  { id: 10, label: 'Éducation' }, { id: 11, label: 'Équipement' }, { id: 12, label: 'Eau assainissement' },
  { id: 13, label: 'Espace public' }, { id: 14, label: 'Quartier informel' }, { id: 15, label: 'MOE Environnement' },
  { id: 16, label: 'AMO Environnement' }, { id: 17, label: 'Logement' }, { id: 18, label: 'Bureaux' },
  { id: 19, label: 'Enseignement' }, { id: 20, label: 'Equipement' }, { id: 21, label: 'Maçonnerie' },
  { id: 22, label: 'Paille' }, { id: 23, label: 'Pierre' }, { id: 24, label: 'Culture' },
  { id: 25, label: 'Sport & loisirs' }, { id: 26, label: 'Santé & social' }, { id: 27, label: 'Tertiaire' },
  { id: 28, label: 'Commerce & activités' }, { id: 29, label: 'Industrie & logistique' }, { id: 30, label: 'Mobilité' },
  { id: 31, label: 'Ouvrage d’art' }, { id: 32, label: 'Art' }, { id: 33, label: 'Patrimoine' },
];

/** Normalisation pour matcher libellés app ↔ registre (insensible casse/accents). */
function normLabel(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Facettes (champs Airtable) converties en filtres PFG, **par pôle**. On peut
 * configurer des filtres différents par page de pôle. Pour l'instant seul
 * Structure est activé (Matériaux + Réhab/Neuf + Programme principal) ; ENV/DEV
 * restent vides → aucune assignation de filtre (comportement actuel préservé).
 */
type FacetField = 'materiaux' | 'rehabNeufValues' | 'programmesPrincipaux' | 'programmesSecondaires';
const POLE_FACETS: Record<PoleKey, FacetField[]> = {
  STR: ['materiaux', 'rehabNeufValues', 'programmesPrincipaux'],
  ENV: [],
  DEV: [],
};

/**
 * Calcule les ids de filtre PFG d'un projet pour un pôle donné : matche
 * (insensible casse/accents) les valeurs des facettes configurées contre le
 * registre. Renvoie une liste d'ids dédoublonnée (vide si le pôle n'a pas de
 * facette activée).
 */
export function pfgFilterIdsForProjet(projet: Projet, pole: PoleKey): number[] {
  const facets = POLE_FACETS[pole] ?? [];
  const wanted = new Set<string>();
  for (const f of facets) {
    for (const v of (projet[f] ?? [])) {
      if (typeof v === 'string' && v.trim()) wanted.add(normLabel(v));
    }
  }
  if (wanted.size === 0) return [];
  const ids: number[] = [];
  for (const entry of PFG_FILTER_REGISTRY) {
    if (wanted.has(normLabel(entry.label)) && !ids.includes(entry.id)) ids.push(entry.id);
  }
  return ids;
}

export interface PoleGalleryResult {
  pole: PoleKey;
  label: string;
  galleryId: number;
  added: boolean;
  reason?: string;
  error?: string;
}

/**
 * Ajoute le projet (image de couverture + nom + lieu + lien) dans toutes les
 * galeries de pôle correspondant à ses Vignettes pôle. Chaque ajout est
 * idempotent côté WordPress (pas de doublon par lien). Renvoie un résultat par
 * galerie ; ne jette jamais (collecte les erreurs par cible).
 */
export async function addProjetToPoleGalleries(
  projet: Projet,
  opts: { link: string; imageId: number }
): Promise<PoleGalleryResult[]> {
  const targets = pfgGalleriesForPoles(projet.vignettePoles);
  const description = poleTileLocation(projet);

  const results: PoleGalleryResult[] = [];
  for (const t of targets) {
    try {
      const r = await appendToPoleGallery({
        galleryId: t.galleryId,
        imageId: opts.imageId,
        title: projet.nom,
        description,
        link: opts.link,
        filters: pfgFilterIdsForProjet(projet, t.pole),
      });
      results.push({ pole: t.pole, label: t.label, galleryId: t.galleryId, added: r.added, reason: r.reason });
    } catch (err) {
      results.push({
        pole: t.pole,
        label: t.label,
        galleryId: t.galleryId,
        added: false,
        error: err instanceof Error ? err.message : 'Erreur inconnue',
      });
    }
  }
  return results;
}
