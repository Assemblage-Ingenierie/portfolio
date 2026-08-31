/**
 * AUTOMATISATION AIRTABLE — remplit « Tags export WP » automatiquement.
 *
 * ┌─ INSTALLATION ────────────────────────────────────────────────────────────┐
 * │ 1. Airtable → base « Affaire » → Automations → Create automation          │
 * │ 2. Trigger : « When record updated »                                      │
 * │      Table  : Affaire                                                     │
 * │      Fields : Mission AI · Rehab / Neuf · Matériaux ·                     │
 * │               Programmes principaux                                       │
 * │      ⚠ NE PAS cocher « Tags export WP » : le script se re-déclencherait   │
 * │        sur sa propre écriture.                                            │
 * │ 3. + Add action → « Run script » → coller CE fichier entier               │
 * │ 4. Panneau « Input variables » de l'action, ajouter UNE variable :         │
 * │      Name  = recordId                                                     │
 * │      Value = Record (from step 1) → Airtable record ID                    │
 * │ 5. « Test » sur une fiche, vérifier le log, puis basculer l'automatisation │
 * │    sur ON en haut à droite.                                               │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Effet : recopie Mission AI + Rehab/Neuf + Matériaux + Programmes principaux
 * dans « Tags export WP », en UNION avec les tags déjà présents (rien n'est
 * effacé). N'écrit que si l'ensemble change réellement.
 *
 * Ce champ est la source unique des catégories WordPress ET des filtres des
 * pages pôle (cf. lib/wordpress/poleGallery.ts).
 *
 * ⚠ La logique ci-dessous est DUPLIQUÉE dans tags-export-wp-backfill.js
 *   (Airtable ne sait pas importer de module) : modifier les deux.
 */

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
const config = input.config(); // { recordId }
const table = base.getTable('Affaire');

const record = await table.selectRecordAsync(config.recordId, {
  fields: [F_TAGS, F_MISSION_AI, F_REHAB, F_MATERIAUX, F_PROGRAMMES],
});

if (!record) {
  console.log('Fiche introuvable : ' + config.recordId);
} else {
  const before = names(record.getCellValue(F_TAGS));
  const missing = new Set();
  const after = resolveToOptions(computeTags(record), table, missing);

  if (missing.size) {
    console.log('⚠ Libellés sans option correspondante (ignorés) : ' + [...missing].join(', '));
  }

  if (sameSet(before, after)) {
    console.log('Aucun changement (' + before.length + ' tags) — pas d\'écriture.');
  } else {
    await table.updateRecordAsync(config.recordId, {
      [F_TAGS]: after.map(function (name) { return { name: name }; }),
    });
    const added = after.filter(function (a) {
      return !before.some(function (b) { return key(b) === key(a); });
    });
    console.log('Tags : ' + before.length + ' → ' + after.length +
      (added.length ? ' | ajoutés : ' + added.join(', ') : ''));
  }
}
