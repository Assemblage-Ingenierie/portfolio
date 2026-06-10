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
