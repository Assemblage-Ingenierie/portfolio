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
  vignettePoles?: string[];
  rehabNeuf?: string;
  surface?: number;
  budgetHT?: string;
  certifications?: string[];
  photoCouverture?: { url: string; width?: number; height?: number };
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
    vignettePoles: p.vignettePoles,
    rehabNeuf: p.rehabNeuf,
    surface: p.surface,
    budgetHT: p.budgetHT,
    certifications: p.certifications,
    photoCouverture: p.photoCouverture
      ? { url: p.photoCouverture.url, width: p.photoCouverture.width, height: p.photoCouverture.height }
      : undefined,
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
      result = result.filter((p) => statuts.includes(p.statut));
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
