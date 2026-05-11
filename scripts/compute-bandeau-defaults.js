// Génère les payloads de mise à jour Airtable pour appliquer les défauts
// bandeau à tous les enregistrements portfolio. Option 2 (préservante) :
// le champ Template n'est forcé à "Manuel" QUE pour les fiches qui ont
// actuellement une valeur invalide (Editorial / Magazine — anciens libellés
// supprimés) ou aucune valeur. Les choix explicites Solo / Diptyque /
// Triptyque / Manuel / Dev sont conservés.
//
// Tous les enregistrements reçoivent un Config template manuel avec les
// défauts bandeau (fusion préservant les surcharges utilisateur existantes).
//
// Usage : node scripts/compute-bandeau-defaults.js
const fs = require('node:fs');
const path = require('node:path');

const FIELD_CONFIG = 'fldBHee96Nsn8rkWx'; // Config template manuel
const FIELD_TEMPLATE = 'fldzO9v9qwt1EudsS'; // Template (singleSelect)

const VALID_TEMPLATES = new Set(['Solo', 'Diptyque', 'Triptyque', 'Manuel', 'Dev']);

const DEFAULTS = {
  titre:       { fontFamily: 'sans', fontSize: 14 },
  status:      { fontFamily: 'sans', fontSize: 10 },
  labels:      { fontFamily: 'sans', fontSize: 10 },
  values:      { fontFamily: 'sans', fontSize: 10 },
  description: { fontFamily: 'sans', fontSize: 10 },
  lines:       { show: false },
};

function parseExisting(raw) {
  if (!raw || typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return {}; // legacy history array
    if (!parsed || typeof parsed !== 'object') return {};
    // Legacy flat ManualConfig → wrap in { manuel }
    if ('mainPhotoFormat' in parsed || 'mainPhoto' in parsed || 'textColumns' in parsed) {
      return { manuel: parsed };
    }
    return parsed;
  } catch {
    return {};
  }
}

function mergeBandeau(existing) {
  const e = existing && typeof existing === 'object' ? existing : {};
  return {
    titre:       { ...DEFAULTS.titre,       ...(e.titre       || {}) },
    status:      { ...DEFAULTS.status,      ...(e.status      || {}) },
    labels:      { ...DEFAULTS.labels,      ...(e.labels      || {}) },
    values:      { ...DEFAULTS.values,      ...(e.values      || {}) },
    description: { ...DEFAULTS.description, ...(e.description || {}) },
    lines:       { ...DEFAULTS.lines,       ...(e.lines       || {}) },
  };
}

const inputPath = path.join(__dirname, 'records.json');
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const records = input.records;

let templateChanges = 0;
const updates = records.map((r) => {
  const existing = parseExisting(r.config);
  const newConfig = { ...existing, bandeau: mergeBandeau(existing.bandeau) };
  const fields = { [FIELD_CONFIG]: JSON.stringify(newConfig) };
  // Option 2 : ne force Manuel que si la valeur actuelle n'est pas un choix
  // valide (Editorial, Magazine, ou vide).
  if (!VALID_TEMPLATES.has(r.template)) {
    fields[FIELD_TEMPLATE] = 'Manuel';
    templateChanges += 1;
  }
  return { id: r.id, fields };
});

const BATCH_SIZE = 50;
const batches = [];
for (let i = 0; i < updates.length; i += BATCH_SIZE) {
  batches.push(updates.slice(i, i + BATCH_SIZE));
}

fs.writeFileSync(
  path.join(__dirname, 'batches.json'),
  JSON.stringify(batches, null, 2),
);
console.log(`✓ ${updates.length} records → ${batches.length} batches`);
console.log(`  · Template forcé "Manuel" : ${templateChanges} fiches (Editorial/Magazine/vide)`);
console.log(`  · Template conservé      : ${updates.length - templateChanges} fiches (Solo/Diptyque/Triptyque/Manuel/Dev)`);
