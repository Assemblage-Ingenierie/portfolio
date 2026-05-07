import type { Projet } from '@/types/projet';
import { cacheTag } from 'next/cache';
import { base, TABLE } from './client';
import { recordToProjet, type AuxValues, FIELD_PROGRAMME_PRINCIPAL, FIELD_PROGRAMME_SECONDAIRE } from './mappers';
import { fetchCrmNames } from './crm';

export const PROJETS_TAG = 'projets';

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
 * Extrait les record IDs Airtable (format recXXX…) présents dans un champ
 * linked records (retourné en JSON natif = array de strings).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractIds(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && x.startsWith('rec'));
  if (typeof v === 'string' && v.startsWith('rec')) return [v];
  return [];
}

/**
 * Requête auxiliaire pour les champs programme principal / secondaire (multi-select,
 * lus par field ID via returnFieldsByFieldId=true).
 * Tolérante aux erreurs.
 */
async function fetchProgrammes(filterFormula?: string): Promise<Map<string, { principal?: string; secondaire?: string }>> {
  const map = new Map<string, { principal?: string; secondaire?: string }>();
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
    console.error('[airtable] fetchProgrammes failed:', err);
  }
  return map;
}

export async function getProjets(): Promise<Projet[]> {
  'use cache';
  cacheTag(PROJETS_TAG);
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) return [];
  try {
    const filter = '{Visible portfolio} = TRUE()';

    // 1. Requête principale (cellFormat=json → attachments OK) + programmes en parallèle
    const [records, programmes] = await Promise.all([
      base(TABLE)
        .select({
          filterByFormula: filter,
          sort: [
            { field: 'Année livraison', direction: 'desc' },
            { field: 'Affaire', direction: 'asc' },
          ],
        })
        .all(),
      fetchProgrammes(filter),
    ]);

    // 2. Collecte des record IDs CRM depuis Architecte / Mandataire / Entreprise
    const crmIds = records.flatMap((r) => [
      ...extractIds(r.fields['Architecte']),
      ...extractIds(r.fields['Mandataire']),
      ...extractIds(r.fields['Entreprise']),
    ]);

    // 3. Résolution des noms depuis la base CRM AI (silencieux si non configuré)
    const crmNames = await fetchCrmNames(crmIds);

    // 4. Mapping final
    return records.map((r) => {
      const prog = programmes.get(r.id);
      const aux: AuxValues = {
        programmePrincipal: prog?.principal,
        programmeSecondaire: prog?.secondaire,
        crmNames,
      };
      return recordToProjet(r, aux);
    });
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

    const [records, prog] = await Promise.all([
      base(TABLE).select({ filterByFormula: filter, maxRecords: 1 }).all(),
      fetchProgrammes(filter),
    ]);
    if (records.length === 0) return null;

    const r = records[0];
    const crmIds = [
      ...extractIds(r.fields['Architecte']),
      ...extractIds(r.fields['Mandataire']),
      ...extractIds(r.fields['Entreprise']),
    ];
    // Debug : on log même en succès pour pouvoir tracer pourquoi un champ
    // n'est pas résolu (le console.error de fetchCrmNames ne se déclenche
    // que sur exception, pas sur résultat vide)
    console.log(`[crm-debug] ${slug} architecte field raw:`, JSON.stringify(r.fields['Architecte']));
    console.log(`[crm-debug] ${slug} mandataire field raw:`, JSON.stringify(r.fields['Mandataire']));
    console.log(`[crm-debug] ${slug} entreprise field raw:`, JSON.stringify(r.fields['Entreprise']));
    console.log(`[crm-debug] ${slug} ids collected:`, crmIds);
    const crmNames = await fetchCrmNames(crmIds);
    console.log(`[crm-debug] ${slug} resolved (${crmNames.size}/${crmIds.length}):`, [...crmNames.entries()]);

    const p = prog.get(r.id);
    const aux: AuxValues = {
      programmePrincipal: p?.principal,
      programmeSecondaire: p?.secondaire,
      crmNames,
    };
    return recordToProjet(r, aux);
  } catch (err) {
    console.error(`[airtable] getProjet(${slug}) failed:`, err);
    return null;
  }
}
