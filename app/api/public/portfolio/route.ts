import { NextResponse, type NextRequest } from 'next/server';
import { getProjets } from '@/lib/airtable';
import type { Projet } from '@/types/projet';

// Endpoint public lecture seule pour le tableau de références.
// - La clé Airtable n'est utilisée que côté serveur (via getProjets).
// - Seuls les champs utiles à un affichage public sont renvoyés (les champs
//   internes comme bandeauConfig, savedManualConfig, urlWordpress, etc. sont
//   strippés).
// - Filtrage côté client : on renvoie la liste complète sanitisée, le client
//   filtre en mémoire (dataset petit, ~quelques dizaines de fiches).

export interface PublicProjet {
  slug: string;
  nom: string;
  lieu?: string;
  moa?: string;
  architecte?: string;
  betAssocies?: string;
  bailleur?: string;
  missionAi?: string;
  programme?: string;
  programmePrincipal?: string;
  programmesPrincipaux?: string[];
  anneeLivraison?: number;
  statut: Projet['statut'];
  /** Valeurs brutes du multi-select Statut (field fldxXNdE0uNaomeby) — utilisé
   *  par le filtre AND côté client. */
  statutValues?: Projet['statutValues'];
  vignettePoles?: string[];
  rehabNeuf?: string;
  /** Multi-select brut (field fldyD7L9E7cGL26vH) — pour filtre AND côté client. */
  rehabNeufValues?: string[];
  /** Multi-select Matériaux (field fldC4SW9n1H2PZ3MH). */
  materiaux?: string[];
  surface?: number;
  budgetHT?: string;
  certifications?: string[];
  photoCouverture?: { url: string; width?: number; height?: number };
  /** URL publique de la fiche sur assemblage.net (permalink WordPress).
   *  Computed côté serveur — voir `deducePublicUrl`. */
  publicUrl?: string;
}

/**
 * Calcule l'URL publique d'une fiche sur assemblage.net.
 * - Si `urlWordpress` existe et n'est PAS un draft (`?p=<id>`) → on l'utilise
 *   tel quel (URL faisant autorité, écrit par WP lors d'une publication).
 * - Sinon → on construit `${wpRoot}/${slug}/` depuis `WP_BASE_URL`. Best
 *   effort : si la fiche n'a jamais été publiée côté WP, l'URL 404. Quand
 *   le slug WP a été suffixé (collision `-2`, `-3`…), la version `urlWordpress`
 *   sera correcte au prochain publish ou écrasement manuel côté Airtable.
 * - Retourne undefined si on n'a ni l'un ni l'autre (env vide).
 */
function deducePublicUrl(p: Projet): string | undefined {
  // 1) URL stockée et qui ressemble à un permalink (pas un draft)
  if (p.urlWordpress && !p.urlWordpress.includes('?p=')) {
    return p.urlWordpress;
  }
  // 2) Fallback : construit depuis le slug + racine WP
  const wpRoot = (process.env.WP_BASE_URL ?? '')
    .replace(/\/$/, '')
    .replace(/\/wp-json\/wp\/v2$/, '');
  if (!wpRoot || !p.slug) return undefined;
  return `${wpRoot}/${p.slug}/`;
}

function sanitize(p: Projet): PublicProjet {
  return {
    slug: p.slug,
    nom: p.nom,
    lieu: p.lieu ?? p.adresse,
    moa: p.moa,
    architecte: p.architecte,
    betAssocies: p.betAssocies,
    bailleur: p.bailleur,
    missionAi: p.missionAi,
    programme: p.programme,
    programmePrincipal: p.programmePrincipal,
    programmesPrincipaux: p.programmesPrincipaux,
    anneeLivraison: p.anneeLivraison,
    statut: p.statut,
    statutValues: p.statutValues,
    vignettePoles: p.vignettePoles,
    rehabNeuf: p.rehabNeuf,
    rehabNeufValues: p.rehabNeufValues,
    materiaux: p.materiaux,
    surface: p.surface,
    budgetHT: p.budgetHT,
    certifications: p.certifications,
    photoCouverture: p.photoCouverture
      ? { url: p.photoCouverture.url, width: p.photoCouverture.width, height: p.photoCouverture.height }
      : undefined,
    publicUrl: deducePublicUrl(p),
  };
}

export async function GET(req: NextRequest) {
  try {
    const projets = await getProjets();
    const sanitized = projets.filter((p) => p.visiblePortfolio).map(sanitize);

    // Filtres optionnels via query params (compat : le client peut aussi tout filtrer en mémoire).
    const sp = req.nextUrl.searchParams;
    const search = sp.get('search')?.toLowerCase().trim();
    const poles = sp.getAll('pole').map((s) => s.toUpperCase());
    const programmes = sp.getAll('programme');
    const statuts = sp.getAll('statut');
    const anneeMin = Number(sp.get('anneeMin'));
    const anneeMax = Number(sp.get('anneeMax'));

    let result = sanitized;
    if (search) {
      result = result.filter((p) =>
        [p.nom, p.moa, p.architecte, p.programme, p.lieu]
          .some((v) => typeof v === 'string' && v.toLowerCase().includes(search))
      );
    }
    if (poles.length) {
      result = result.filter((p) => {
        const set = new Set((p.vignettePoles ?? []).map((v) => v.toUpperCase()));
        return poles.every((code) => set.has(code));
      });
    }
    if (programmes.length) {
      result = result.filter((p) => {
        const list = p.programmesPrincipaux ?? (p.programmePrincipal ? [p.programmePrincipal] : []);
        return list.some((v) => programmes.includes(v));
      });
    }
    if (statuts.length) {
      // AND : un projet passe seulement s'il a TOUS les statuts demandés.
      result = result.filter((p) => {
        const set = new Set(p.statutValues ?? [p.statut]);
        return statuts.every((s) => set.has(s as Projet['statut']));
      });
    }
    if (Number.isFinite(anneeMin) && anneeMin > 0) {
      result = result.filter((p) => !p.anneeLivraison || p.anneeLivraison >= anneeMin);
    }
    if (Number.isFinite(anneeMax) && anneeMax > 0) {
      result = result.filter((p) => !p.anneeLivraison || p.anneeLivraison <= anneeMax);
    }

    return NextResponse.json(
      { ok: true, count: result.length, items: result },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  } catch (err) {
    console.error('[api/public/portfolio] failed:', err);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
