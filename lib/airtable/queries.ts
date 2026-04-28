import type { Projet } from '@/types/projet';
import { cacheTag } from 'next/cache';
import { base, TABLE } from './client';
import { recordToProjet } from './mappers';

export const PROJETS_TAG = 'projets';

export async function getProjets(): Promise<Projet[]> {
  'use cache';
  cacheTag(PROJETS_TAG);
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) return [];
  try {
    const records = await base(TABLE)
      .select({
        filterByFormula: '{Visible portfolio} = TRUE()',
        sort: [
          { field: 'Année livraison', direction: 'desc' },
          { field: 'Affaire', direction: 'asc' },
        ],
      })
      .all();
    return records.map(recordToProjet);
  } catch {
    return [];
  }
}

export async function getProjet(slug: string): Promise<Projet | null> {
  'use cache';
  cacheTag(PROJETS_TAG);
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return null;
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) return null;
  const records = await base(TABLE)
    .select({
      filterByFormula: `{Slug} = "${slug}"`,
      maxRecords: 1,
    })
    .all();

  if (records.length === 0) return null;
  return recordToProjet(records[0]);
}
