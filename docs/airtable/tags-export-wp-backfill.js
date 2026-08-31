/**
 * RATTRAPAGE — remplit « Tags export WP » sur TOUTES les fiches existantes.
 *
 * ┌─ UTILISATION ─────────────────────────────────────────────────────────────┐
 * │ Airtable → base « Affaire » → Extensions → Scripting → coller ce fichier  │
 * │ → Run.                                                                    │
 * │                                                                           │
 * │ À lancer UNE FOIS pour traiter l'historique, AVANT d'activer              │
 * │ l'automatisation. Ensuite l'automatisation suffit.                        │
 * │                                                                           │
 * │ DRY_RUN = true (défaut) : n'écrit RIEN, affiche seulement ce qui serait   │
 * │ modifié. Vérifier le rapport, puis passer à false pour appliquer.         │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Même logique que tags-export-wp-automation.js : UNION avec les tags
 * existants, aucun tag effacé. Écriture par lots de 50 (limite Airtable).
 *
 * ⚠ Logique DUPLIQUÉE depuis tags-export-wp-automation.js : modifier les deux.
 */

const DRY_RUN = true; // ← passer à false pour appliquer réellement

// ── Champs (par ID : les noms de colonnes Airtable ne sont pas stables) ──────
const F_TAGS       = 'fld2y9rIk9DVEf9eo'; // Tags export WP        (cible)
const F_MISSION_AI = 'fldgkpweXw9BypQfX'; // Mission AI
const F_REHAB      = 'fldyD7L9E7cGL26vH'; // Rehab / Neuf
const F_MATERIAUX  = 'fldC4SW9n1H2PZ3MH'; // Matériaux
const F_PROGRAMMES = 'fldKNKtsZNpvmf695'; // Programmes principaux

/**
 * Mission AI : codes courts Airtable → libellé public.
 * Seule table de correspondance réellement nécessaire : aucune normalisation ne
 * peut deviner que « faisa » signifie « Faisabilité ».
 * « accompagnateur bdf » n'a volontairement aucune cible → ignoré.
 */
const MISSION_AI_TAG_MAP = {
  'moe str': 'MOE Structure',
  'exe str': 'EXE Structure',
  'moe env': 'MOE Environnement',
  'amo env': 'AMO Environnement',
  'amo dev': 'AMO Développement',
  'programmation': 'Programmation',
  'amo str': 'AMO Structure',
  'diag str': 'Diagnostic Structure',
  'prog': 'Programmation',
  'faisa': 'Faisabilité',
};

/**
 * Matériaux : SEULS les cas particuliers. La casse (« acier » → « Acier ») est
 * résolue par resolveToOptions(), qui matche sans tenir compte de la casse, des
 * accents, des espaces ni du type d'apostrophe. On ne code ici que ce qu'une
 * normalisation ne peut pas deviner.
 */
const MATERIAUX_SPECIAL = {
  'bois-paille': ['Bois', 'Paille'], // composite → les deux matériaux
  'pierredetaille': ['Pierre'],      // pas d'option dédiée → matériau générique
};

/** Clé de comparaison : sans accents/espaces, minuscules, apostrophe unifiée.
 *  Doit rester alignée sur normLabel() de lib/wordpress/poleGallery.ts. */
function key(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’ʼ`]/g, "'")
    .replace(/\s+/g, '')
    .trim();
}

/** Noms d'un champ multi-select (Airtable renvoie [{id,name}] ou null). */
function names(cell) {
  if (!Array.isArray(cell)) return [];
  return cell.map(function (c) { return c && c.name ? c.name : String(c); }).filter(Boolean);
}

/** Tags voulus : union des tags existants et des 4 champs sources. */
function computeTags(record) {
  const out = [];
  const seen = new Set();
  function push(label) {
    if (!label) return;
    const k = key(label);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(label);
  }

  // 1. Tags déjà présents — prioritaires, jamais perdus.
  names(record.getCellValue(F_TAGS)).forEach(push);

  // 2. Mission AI → libellé public (valeur non mappée ignorée).
  names(record.getCellValue(F_MISSION_AI)).forEach(function (v) {
    push(MISSION_AI_TAG_MAP[v.trim().toLowerCase()]);
  });

  // 3. Rehab / Neuf → valeur brute.
  names(record.getCellValue(F_REHAB)).forEach(function (v) { push(v.trim()); });

  // 4. Matériaux → cas particulier, sinon valeur brute.
  names(record.getCellValue(F_MATERIAUX)).forEach(function (v) {
    const special = MATERIAUX_SPECIAL[v.trim().toLowerCase()];
    if (special) special.forEach(push);
    else push(v.trim());
  });

  // 5. Programmes principaux → valeur brute. Les écarts avec les options du
  //    champ (« Éducation »/« Education », « Ouvrage d’art »/« Ouvrage d'art »)
  //    sont absorbés par resolveToOptions.
  names(record.getCellValue(F_PROGRAMMES)).forEach(function (v) { push(v.trim()); });

  return out;
}

/**
 * Ne garde que les libellés qui existent RÉELLEMENT comme option du champ, et
 * renvoie leur casse exacte. Indispensable : écrire un libellé inexistant fait
 * échouer updateRecordAsync et casserait toute l'automatisation. Les libellés
 * sans option correspondante sont collectés dans `missingOut` pour les logs.
 */
function resolveToOptions(labels, table, missingOut) {
  const choices = table.getField(F_TAGS).options.choices || [];
  const byKey = new Map(choices.map(function (c) { return [key(c.name), c.name]; }));
  const out = [];
  labels.forEach(function (l) {
    const real = byKey.get(key(l));
    if (real) out.push(real);
    else if (missingOut) missingOut.add(l);
  });
  return out;
}

/** true si les deux listes portent le même ensemble de tags (anti-boucle). */
function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const ka = new Set(a.map(key));
  return b.every(function (x) { return ka.has(key(x)); });
}

// ── Exécution ───────────────────────────────────────────────────────────────
const table = base.getTable('Affaire');
const query = await table.selectRecordsAsync({
  fields: [F_TAGS, F_MISSION_AI, F_REHAB, F_MATERIAUX, F_PROGRAMMES],
});

const updates = [];
const missingOptions = new Set();
const unmappedMission = new Set();

for (const record of query.records) {
  // Valeurs Mission AI sans correspondance : signalées en fin de rapport.
  names(record.getCellValue(F_MISSION_AI)).forEach(function (v) {
    if (!MISSION_AI_TAG_MAP[v.trim().toLowerCase()]) unmappedMission.add(v);
  });

  const before = names(record.getCellValue(F_TAGS));
  const after = resolveToOptions(computeTags(record), table, missingOptions);
  if (sameSet(before, after)) continue;

  const added = after.filter(function (a) {
    return !before.some(function (b) { return key(b) === key(a); });
  });
  updates.push({
    id: record.id,
    fields: { [F_TAGS]: after.map(function (name) { return { name: name }; }) },
    _added: added,
  });
}

console.log('Fiches examinées  : ' + query.records.length);
console.log('Fiches à modifier : ' + updates.length);

if (unmappedMission.size) {
  console.log('⚠ Mission AI sans correspondance : ' + [...unmappedMission].join(', '));
}
if (missingOptions.size) {
  console.log('⚠ Libellés sans option correspondante (ignorés) : ' + [...missingOptions].join(', '));
}

for (const u of updates.slice(0, 10)) {
  console.log('  ' + u.id + '  + ' + u._added.join(', '));
}
if (updates.length > 10) console.log('  … et ' + (updates.length - 10) + ' autres');

if (DRY_RUN) {
  console.log('\nDRY_RUN actif — AUCUNE écriture. Passer DRY_RUN à false pour appliquer.');
} else {
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50).map(function (u) {
      return { id: u.id, fields: u.fields };
    });
    await table.updateRecordsAsync(batch);
    console.log('Écrit ' + Math.min(i + 50, updates.length) + '/' + updates.length);
  }
  console.log('\nTerminé : ' + updates.length + ' fiches mises à jour.');
}
