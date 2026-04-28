import Airtable from 'airtable';

export function base(tableName: string) {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  )(tableName);
}

export const TABLE = process.env.AIRTABLE_TABLE_NAME!;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formulaValue(raw: any): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') return raw || undefined;
  if (typeof raw === 'object' && raw.state === 'generated' && raw.value) {
    return String(raw.value);
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function linkedValue(raw: any): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') return raw || undefined;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter((x) => typeof x === 'string').join(', ') || undefined;
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function selectValue(raw: any): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') return raw || undefined;
  if (Array.isArray(raw)) return raw[0] ?? undefined;
  return undefined;
}
