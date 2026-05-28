import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser } from '@/lib/supabase/requireApprovedUser';

/**
 * GET /api/airtable/select-options
 *
 * Retourne les options canoniques de chaque champ multi-select / single-select
 * de la table portfolio, lues directement depuis le schema Airtable via
 * l'API Metadata (https://api.airtable.com/v0/meta/bases/{baseId}/tables).
 *
 * Source de vérité : ce que l'utilisateur a configuré dans Airtable. Si une
 * nouvelle option est ajoutée côté Airtable, elle apparaît automatiquement
 * dans le sélecteur. Si une option est supprimée, elle disparaît.
 *
 * Pré-requis : le PAT (AIRTABLE_API_KEY) doit avoir le scope
 * `schema.bases:read`.
 *
 * Cache : `revalidate: 300` (5 min) — les listes d'options bougent rarement.
 */
export const revalidate = 300;

const FIELD_IDS = {
  missionAi:             'fldgkpweXw9BypQfX',
  programmesPrincipaux:  'fldKNKtsZNpvmf695',
  programmesSecondaires: 'fldaTqKMNrIpeGBma',
  etatAvancement:        'fldxXNdE0uNaomeby',
  materiaux:             'fldC4SW9n1H2PZ3MH',
  rehabNeuf:             'fldyD7L9E7cGL26vH',
} as const;

type FieldKey = keyof typeof FIELD_IDS;

interface AirtableSelectChoice {
  id: string;
  name: string;
  color?: string;
}
interface AirtableField {
  id: string;
  name: string;
  type: string;
  options?: { choices?: AirtableSelectChoice[] };
}
interface AirtableTable {
  id: string;
  name: string;
  fields: AirtableField[];
}

export async function GET(req: NextRequest) {
  const auth = await requireApprovedUser(req);
  if (auth instanceof NextResponse) return auth;

  const baseId = process.env.AIRTABLE_BASE_ID;
  const apiKey = process.env.AIRTABLE_API_KEY;
  const tableName = process.env.AIRTABLE_TABLE_NAME ?? 'Affaire';
  if (!baseId || !apiKey) {
    return NextResponse.json({ error: 'Airtable non configuré' }, { status: 500 });
  }

  try {
    const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      // Cache géré par Next via la directive `revalidate` du module.
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      const status = res.status;
      // 403 / 401 → le PAT n'a probablement pas le scope schema.bases:read.
      // On renvoie un message explicite pour faciliter le diagnostic ; le
      // composant client peut alors fallback sur les valeurs déjà connues
      // dans les fiches (mode dégradé).
      const msg = status === 401 || status === 403
        ? 'PAT Airtable sans accès au schema (manque le scope schema.bases:read)'
        : `Airtable metadata API a renvoyé ${status}`;
      return NextResponse.json({ error: msg }, { status });
    }

    const data = await res.json() as { tables?: AirtableTable[] };
    const tables = Array.isArray(data.tables) ? data.tables : [];
    const table = tables.find(t => t.name === tableName) ?? tables[0];
    if (!table) {
      return NextResponse.json({ error: `Table "${tableName}" introuvable` }, { status: 404 });
    }

    const fieldById = new Map(table.fields.map(f => [f.id, f]));

    const result: Record<FieldKey, string[]> = {
      missionAi: [], programmesPrincipaux: [], programmesSecondaires: [],
      etatAvancement: [], materiaux: [], rehabNeuf: [],
    };

    for (const [key, fieldId] of Object.entries(FIELD_IDS) as [FieldKey, string][]) {
      const field = fieldById.get(fieldId);
      const choices = field?.options?.choices ?? [];
      result[key] = choices.map(c => c.name).filter(Boolean);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[select-options] fetch failed:', err);
    return NextResponse.json({ error: 'Erreur lors de la récupération des options' }, { status: 500 });
  }
}
