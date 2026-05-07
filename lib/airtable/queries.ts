import type { Projet } from '@/types/projet';
import { cacheTag } from 'next/cache';
import { base, TABLE } from './client';
import { recordToProjet, type ProgrammeAux, FIELD_PROGRAMME_PRINCIPAL, FIELD_PROGRAMME_SECONDAIRE } from './mappers';

export const PROJETS_TAG = 'projets';

// cellFormat='string' demande à Airtable de renvoyer chaque cellule formatée
// comme dans l'UI : c'est ce qui permet aux linked records (Architecte,
// Mandataire, Entreprise — désormais synchronisés depuis la base CRM) de
// revenir sous forme de texte affiché et non d'identifiants `recXXX`.
// Note : Airtable rejette cellFormat=string sans timeZone+userLocale.
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
 * Cette requête est isolée et tolérante aux erreurs : si les field IDs ne
 * résolvent pas (renommage côté Airtable, base différente…), on renvoie une
 * map vide plutôt que de faire échouer tout le chargement de la fiche.
 */
async function fetchProgrammes(filterFormula?: string): Promise<Map<string, ProgrammeAux>> {
  const map = new Map<string, ProgrammeAux>();
  try {
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
  } catch (err) {
    console.error('[airtable] fetchProgrammes failed, continuing without programme aux:', err);
  }
  return map;
}

// Sélection principale, avec fallback : si cellFormat='string' échoue
// (PAT sans le scope, base ne supportant pas l'option, etc.), on retente
// sans pour ne pas casser la home / les fiches.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function selectProjets(opts: any): Promise<readonly any[]> {
  try {
    return await base(TABLE).select({ ...STRING_FORMAT, ...opts }).all();
  } catch (err) {
    console.error('[airtable] string-format query failed, retrying with default cellFormat:', err);
    return await base(TABLE).select(opts).all();
  }
}

export async function getProjets(): Promise<Projet[]> {
  'use cache';
  cacheTag(PROJETS_TAG);
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) return [];
  try {
    const filter = '{Visible portfolio} = TRUE()';
    const [records, programmes] = await Promise.all([
      selectProjets({
        filterByFormula: filter,
        sort: [
          { field: 'Année livraison', direction: 'desc' },
          { field: 'Affaire', direction: 'asc' },
        ],
      }),
      fetchProgrammes(filter),
    ]);
    return records.map((r) => recordToProjet(r, programmes.get(r.id)));
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
    const [records, programmes] = await Promise.all([
      selectProjets({ filterByFormula: filter, maxRecords: 1 }),
      fetchProgrammes(filter),
    ]);
    if (records.length === 0) return null;
    return recordToProjet(records[0], programmes.get(records[0].id));
  } catch (err) {
    console.error(`[airtable] getProjet(${slug}) failed:`, err);
    return null;
  }
}
