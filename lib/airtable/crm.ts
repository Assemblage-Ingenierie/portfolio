import Airtable from 'airtable';

// On lit par NOM de champ et pas par ID : Airtable réattribue souvent les
// field IDs lors de la création d'une table synchronisée (les noms sont
// préservés, mais pas les IDs). Utiliser un ID inexistant peut renvoyer
// un 403 NOT_AUTHORIZED plutôt qu'une erreur 404 explicite.
const FIELD_NOM = 'Nom';

/**
 * Les linked records ne traversent jamais les bases dans Airtable :
 * quand la base portfolio synchronise une table CRM, Airtable crée une
 * **table synchronisée locale** dans la base portfolio (avec ses propres
 * record IDs, distincts de ceux de la base source). Le champ Architecte
 * pointe vers cette table synchronisée locale.
 *
 * On interroge donc AIRTABLE_BASE_ID (portfolio) sur la table dont le nom
 * est dans AIRTABLE_CRM_TABLE_NAME — pas la base CRM AI elle-même.
 * AIRTABLE_CRM_BASE_ID reste utilisable en fallback si quelqu'un veut
 * vraiment une lookup cross-base manuelle.
 */
function crmBase() {
  const baseId = process.env.AIRTABLE_BASE_ID || process.env.AIRTABLE_CRM_BASE_ID;
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
  const usedBase = process.env.AIRTABLE_BASE_ID || process.env.AIRTABLE_CRM_BASE_ID;
  console.log(`[crm] querying ${usedBase}/${process.env.AIRTABLE_CRM_TABLE_NAME} for ${uniqueIds.length} ids`);
  // Airtable supporte OR(RECORD_ID()='rec...', ...) pour filtrer par IDs
  const formula = uniqueIds.length === 1
    ? `RECORD_ID()='${uniqueIds[0]}'`
    : `OR(${uniqueIds.map(id => `RECORD_ID()='${id}'`).join(',')})`;

  try {
    const records = await table.select({
      filterByFormula: formula,
      fields: [FIELD_NOM],
    }).all();

    console.log(`[crm] received ${records.length} records back`);
    records.forEach((r) => {
      const nom = r.fields[FIELD_NOM];
      console.log(`[crm] record ${r.id} → ${typeof nom === 'string' ? nom : `(${JSON.stringify(nom)})`}`);
      if (typeof nom === 'string' && nom.trim()) {
        map.set(r.id, nom.trim());
      }
    });
  } catch (err) {
    console.error('[crm] fetchCrmNames failed:', err);
  }

  return map;
}
