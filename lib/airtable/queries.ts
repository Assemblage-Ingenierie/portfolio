import type { Projet } from '@/types/projet';
import { cacheTag } from 'next/cache';
import { base, TABLE } from './client';
import { recordToProjet, type ProgrammeAux, FIELD_PROGRAMME_PRINCIPAL, FIELD_PROGRAMME_SECONDAIRE } from './mappers';

export const PROJETS_TAG = 'projets';

// cellFormat='string' demande à Airtable de renvoyer chaque cellule formatée
// comme dans l'UI : c'est ce qui permet aux linked records (Architecte,
// Mandataire, Entreprise — désormais synchronisés depuis la base CRM) de
// revenir sous forme de texte affiché et non d'identifiants `recXXX`.
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

/**
 * Récupère programme principal / secondaire par field IDs.
 * Les noms de ces champs ne sont pas connus côté code (le PAT n'a pas le
 * scope schema pour les introspecter), on les lit donc par leur ID stable
 * via `returnFieldsByFieldId: true`.
 */
async function fetchProgrammes(filterFormula?: string): Promise<Map<string, ProgrammeAux>> {
  const map = new Map<string, ProgrammeAux>();
  const records = await base(TABLE)
    .select({
      ...STRING_FORMAT,
      fields: [FIELD_PROGRAMME_PRINCIPAL, FIELD_PROGRAMME_SECONDAIRE],
      returnFieldsByFieldId: true,
      ...(filterFormula ? { filterByFormula: filterFormula } : {}),
    })
    .all();
  records.forEach((r) => {
    map.set(r.id, {
      principal: firstValue(r.fields[FIELD_PROGRAMME_PRINCIPAL]),
      secondaire: firstValue(r.fields[FIELD_PROGRAMME_SECONDAIRE]),
    });
  });
  return map;
}

export async function getProjets(): Promise<Projet[]> {
  'use cache';
  cacheTag(PROJETS_TAG);
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) return [];
  try {
    const filter = '{Visible portfolio} = TRUE()';
    const [records, programmes] = await Promise.all([
      base(TABLE)
        .select({
          ...STRING_FORMAT,
          filterByFormula: filter,
          sort: [
            { field: 'Année livraison', direction: 'desc' },
            { field: 'Affaire', direction: 'asc' },
          ],
        })
        .all(),
      fetchProgrammes(filter),
    ]);
    return records.map((r) => recordToProjet(r, programmes.get(r.id)));
  } catch {
    return [];
  }
}

export async function getProjet(slug: string): Promise<Projet | null> {
  'use cache';
  cacheTag(PROJETS_TAG);
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return null;
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) return null;
  const filter = `{Slug} = "${slug}"`;
  const [records, programmes] = await Promise.all([
    base(TABLE)
      .select({
        ...STRING_FORMAT,
        filterByFormula: filter,
        maxRecords: 1,
      })
      .all(),
    fetchProgrammes(filter),
  ]);

  if (records.length === 0) return null;
  return recordToProjet(records[0], programmes.get(records[0].id));
}
