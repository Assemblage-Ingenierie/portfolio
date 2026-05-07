import Airtable from 'airtable';

// Field ID stable du champ "Nom" dans la table CRM AI
const FIELD_NOM_ID = 'fldFkUQonHXldxbZ1';

function crmBase() {
  const baseId = process.env.AIRTABLE_CRM_BASE_ID;
  const table = process.env.AIRTABLE_CRM_TABLE_NAME;
  if (!baseId || !table || !process.env.AIRTABLE_API_KEY) return null;
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
    .base(baseId)(table);
}

/**
 * Retourne une Map<recordId → nom> pour les IDs passés en entrée.
 * Utilise RECORD_ID() dans la filterByFormula pour aller chercher
 * directement les enregistrements CRM sans connaître les clés primaires.
 *
 * Silencieuse en cas d'erreur (PAT non configuré, base inaccessible, etc.)
 * pour ne pas casser le chargement des fiches.
 */
export async function fetchCrmNames(recordIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (recordIds.length === 0) return map;

  const table = crmBase();
  if (!table) {
    console.warn('[crm] CRM base not configured (AIRTABLE_CRM_BASE_ID / AIRTABLE_CRM_TABLE_NAME missing)');
    return map;
  }

  const uniqueIds = [...new Set(recordIds)];
  console.log(`[crm] querying ${process.env.AIRTABLE_CRM_BASE_ID}/${process.env.AIRTABLE_CRM_TABLE_NAME} for ${uniqueIds.length} ids`);
  // Airtable supporte OR(RECORD_ID()='rec...', ...) pour filtrer par IDs
  const formula = uniqueIds.length === 1
    ? `RECORD_ID()='${uniqueIds[0]}'`
    : `OR(${uniqueIds.map(id => `RECORD_ID()='${id}'`).join(',')})`;

  try {
    const records = await table.select({
      filterByFormula: formula,
      fields: [FIELD_NOM_ID],
      returnFieldsByFieldId: true,
    }).all();

    console.log(`[crm] received ${records.length} records back`);
    records.forEach((r) => {
      const nom = r.fields[FIELD_NOM_ID];
      console.log(`[crm] record ${r.id} → ${typeof nom === 'string' ? nom : '(empty/non-string)'}`);
      if (typeof nom === 'string' && nom.trim()) {
        map.set(r.id, nom.trim());
      }
    });
  } catch (err) {
    console.error('[crm] fetchCrmNames failed:', err);
  }

  return map;
}
