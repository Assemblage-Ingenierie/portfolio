import type { Projet } from '@/types/projet';
import { cacheTag } from 'next/cache';
import { base, TABLE } from './client';
import { recordToProjet, type AuxValues, FIELD_PROGRAMME_PRINCIPAL, FIELD_PROGRAMME_SECONDAIRE } from './mappers';

export const PROJETS_TAG = 'projets';

// cellFormat='string' = Airtable renvoie chaque cellule formatée comme dans
// l'UI. Indispensable pour récupérer les valeurs affichées des linked records
// synchronisés depuis la base CRM (Architecte / Mandataire / Entreprise) et
// des multi-selects programme principal / secondaire — sinon on récupère
// soit des record IDs (`recXXX`), soit des arrays d'IDs.
//
// ⚠ NE PAS utiliser cellFormat='string' sur la requête principale : les
// attachments (Photo Couverture, Photos projet) deviennent eux aussi des
// chaînes au lieu d'arrays d'objets `{url, thumbnails…}`, ce qui casse
// l'affichage des images. On l'utilise donc uniquement sur la requête aux.
const STRING_FORMAT = {
  cellFormat: 'string' as const,
  timeZone: 'Europe/Paris',
  userLocale: 'fr-fr',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstValue(v: any): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'string') {
    const first = v.split(/\s*,\s*/)[0]?.trim();
    return first || undefined;
  }
  if (Array.isArray(v)) {
    const first = v[0];
    return typeof first === 'string' && first ? first : undefined;
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asString(v: any): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'string') return v.trim() || undefined;
  if (Array.isArray(v)) {
    const joined = v.filter((x) => typeof x === 'string' && x.trim()).join(', ');
    return joined || undefined;
  }
  return undefined;
}

/**
 * Requête auxiliaire en cellFormat='string' :
 * - Architecte / Mandataire / Entreprise : valeur affichée (linked CRM)
 * - Programme principal / secondaire : première option du multi-select,
 *   lus par field ID via `returnFieldsByFieldId: true` (les noms de
 *   colonnes Airtable ne sont pas garantis stables côté code)
 *
 * On fait deux sous-requêtes parallèles parce que `returnFieldsByFieldId`
 * est un flag global (les keys de réponse sont soit toutes par nom,
 * soit toutes par ID) et qu'on ne connaît pas les IDs des champs CRM.
 *
 * Tolérante aux erreurs : retourne une map vide si l'une des deux échoue.
 */
async function fetchAux(filterFormula?: string): Promise<Map<string, AuxValues>> {
  const map = new Map<string, AuxValues>();
  const baseOpts = filterFormula ? { filterByFormula: filterFormula } : {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function ensure(id: string): AuxValues {
    let entry = map.get(id);
    if (!entry) {
      entry = {};
      map.set(id, entry);
    }
    return entry;
  }

  const [byName, byId] = await Promise.allSettled([
    base(TABLE)
      .select({
        ...STRING_FORMAT,
        ...baseOpts,
        fields: ['Architecte', 'Mandataire', 'Entreprise'],
      })
      .all(),
    base(TABLE)
      .select({
        ...STRING_FORMAT,
        ...baseOpts,
        fields: [FIELD_PROGRAMME_PRINCIPAL, FIELD_PROGRAMME_SECONDAIRE],
        returnFieldsByFieldId: true,
      })
      .all(),
  ]);

  if (byName.status === 'fulfilled') {
    byName.value.forEach((r) => {
      const e = ensure(r.id);
      e.architecte = asString(r.fields['Architecte']);
      e.mandataire = asString(r.fields['Mandataire']);
      e.entreprise = asString(r.fields['Entreprise']);
    });
  } else {
    console.error('[airtable] fetchAux byName failed:', byName.reason);
  }

  if (byId.status === 'fulfilled') {
    byId.value.forEach((r) => {
      const e = ensure(r.id);
      e.programmePrincipal = firstValue(r.fields[FIELD_PROGRAMME_PRINCIPAL]);
      e.programmeSecondaire = firstValue(r.fields[FIELD_PROGRAMME_SECONDAIRE]);
    });
  } else {
    console.error('[airtable] fetchAux byId failed:', byId.reason);
  }

  return map;
}

export async function getProjets(): Promise<Projet[]> {
  'use cache';
  cacheTag(PROJETS_TAG);
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) return [];
  try {
    const filter = '{Visible portfolio} = TRUE()';
    const [records, aux] = await Promise.all([
      base(TABLE)
        .select({
          filterByFormula: filter,
          sort: [
            { field: 'Année livraison', direction: 'desc' },
            { field: 'Affaire', direction: 'asc' },
          ],
        })
        .all(),
      fetchAux(filter),
    ]);
    return records.map((r) => recordToProjet(r, aux.get(r.id)));
  } catch (err) {
    console.error('[airtable] getProjets failed:', err);
    return [];
  }
}

export async function getProjet(slug: string): Promise<Projet | null> {
  'use cache';
  cacheTag(PROJETS_TAG);
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return null;
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) return null;
  try {
    const filter = `{Slug} = "${slug}"`;
    const [records, aux] = await Promise.all([
      base(TABLE).select({ filterByFormula: filter, maxRecords: 1 }).all(),
      fetchAux(filter),
    ]);
    if (records.length === 0) return null;
    return recordToProjet(records[0], aux.get(records[0].id));
  } catch (err) {
    console.error(`[airtable] getProjet(${slug}) failed:`, err);
    return null;
  }
}
