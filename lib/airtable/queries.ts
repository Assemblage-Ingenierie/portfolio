import type { Projet } from '@/types/projet';
import { base, TABLE } from './client';
import { recordToProjet } from './mappers';

export async function getProjets(): Promise<Projet[]> {
  'use cache';
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
}

export async function getProjet(slug: string): Promise<Projet | null> {
  'use cache';
  const records = await base(TABLE)
    .select({
      filterByFormula: `{Slug} = "${slug}"`,
      maxRecords: 1,
    })
    .all();

  if (records.length === 0) return null;
  return recordToProjet(records[0]);
}
