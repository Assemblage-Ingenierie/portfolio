// Re-tag des filtres PFG d'une galerie de pôle depuis Airtable.
//
// Usage :
//   node --env-file=.env scripts/pfg-retag.mjs            # DRY RUN (galerie 2461)
//   APPLY=1 node --env-file=.env scripts/pfg-retag.mjs    # écrit réellement
//   GALLERY=2461 ... pour cibler une autre galerie
//
// Pour chaque tuile : slug depuis image-link -> projet Airtable -> ids de filtre
// (Matériaux + Réhab/Neuf + Programme principal) -> append (répare les filtres).
// Les tuiles dont le slug ne matche AUCUN projet Airtable sont laissées intactes.

const APPLY = process.env.APPLY === '1';
const GALLERY = Number(process.env.GALLERY || 2461);

const WP_ROOT = process.env.WP_BASE_URL.replace(/\/$/, '').replace(/\/wp-json\/wp\/v2$/, '');
const WP_TOK = Buffer.from(
  process.env.WP_USER + ':' + (process.env.WP_APP_PASSWORD || '').replace(/\s/g, '')
).toString('base64');
const WP_H = { Authorization: 'Basic ' + WP_TOK, 'Content-Type': 'application/json', Accept: 'application/json' };

const AT_KEY = process.env.AIRTABLE_API_KEY;
const AT_BASE = process.env.AIRTABLE_BASE_ID;
const AT_TABLE = process.env.AIRTABLE_TABLE_NAME || 'Affaire';

const F_MATERIAUX = 'fldC4SW9n1H2PZ3MH';
const F_REHAB = 'fldyD7L9E7cGL26vH';
const F_PROG = 'fldKNKtsZNpvmf695';

// Registre PFG (id -> libellé) ; facettes Structure = Matériaux + Réhab/Neuf + Programme principal.
const REGISTRY = [
  [1, 'Acier'], [2, 'Béton'], [3, 'Bois'], [4, 'Verre'], [5, 'Réhabilitation'], [6, 'Neuf'],
  [7, 'Pont'], [8, 'Ouvrage spécial'], [9, 'Flottant'], [10, 'Éducation'], [11, 'Équipement'],
  [12, 'Eau assainissement'], [13, 'Espace public'], [14, 'Quartier informel'], [15, 'MOE Environnement'],
  [16, 'AMO Environnement'], [17, 'Logement'], [18, 'Bureaux'], [19, 'Enseignement'], [20, 'Equipement'],
  [21, 'Maçonnerie'], [22, 'Paille'], [23, 'Pierre'], [24, 'Culture'], [25, 'Sport & loisirs'],
  [26, 'Santé & social'], [27, 'Tertiaire'], [28, 'Commerce & activités'], [29, 'Industrie & logistique'],
  [30, 'Mobilité'], [31, 'Ouvrage d’art'], [32, 'Art'], [33, 'Patrimoine'],
];
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function filterIdsFor(labels) {
  const wanted = new Set(labels.map(norm));
  const ids = [];
  for (const [id, label] of REGISTRY) if (wanted.has(norm(label)) && !ids.includes(id)) ids.push(id);
  return ids;
}

function slugFromLink(link) {
  try { return new URL(link).pathname.replace(/^\/|\/$/g, '').toLowerCase(); }
  catch { return ''; }
}

async function airtableMaps() {
  // schema -> ids des champs Slug + Nom du projet
  const sc = await (await fetch(`https://api.airtable.com/v0/meta/bases/${AT_BASE}/tables`, {
    headers: { Authorization: 'Bearer ' + AT_KEY },
  })).json();
  const table = (sc.tables || []).find((t) => t.name === AT_TABLE) || (sc.tables || [])[0];
  const F_SLUG = (table.fields.find((f) => f.name === 'Slug') || {}).id || null;
  const F_NOM = (table.fields.find((f) => f.name === 'Nom du projet') || {}).id || null;

  const bySlug = new Map();
  const byName = new Map();
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${AT_BASE}/${encodeURIComponent(AT_TABLE)}`);
    url.searchParams.set('returnFieldsByFieldId', 'true');
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    const j = await (await fetch(url, { headers: { Authorization: 'Bearer ' + AT_KEY } })).json();
    for (const rec of j.records || []) {
      const f = rec.fields;
      const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
      const labels = [...arr(f[F_MATERIAUX]), ...arr(f[F_REHAB]), ...arr(f[F_PROG])];
      const slug = F_SLUG ? f[F_SLUG] : undefined;
      if (typeof slug === 'string' && slug) bySlug.set(slug.toLowerCase(), labels);
      const nom = F_NOM ? f[F_NOM] : undefined;
      if (typeof nom === 'string' && nom) byName.set(norm(nom), labels);
    }
    offset = j.offset;
  } while (offset);
  return { bySlug, byName };
}

async function main() {
  console.log(`PFG re-tag galerie ${GALLERY} — ${APPLY ? 'APPLY (écriture)' : 'DRY RUN'}`);
  const { bySlug, byName } = await airtableMaps();
  console.log(`Airtable : ${bySlug.size} slugs / ${byName.size} noms indexés`);

  const diag = await (await fetch(`${WP_ROOT}/wp-json/assemblage/v1/pfg/diag/${GALLERY}`, { headers: WP_H })).json();
  const g = diag.meta[`awl_filter_gallery${GALLERY}`][0];
  const ids = g['image-ids'] || [];
  const titles = g['image_title'] || [];

  let matched = 0, unmatched = 0, applied = 0;
  for (let i = 0; i < ids.length; i++) {
    const imgId = ids[i];
    const link = (g['image-link'] || {})[imgId] || '';
    const slug = slugFromLink(link);
    const title = titles[i] || '';
    const labels = bySlug.get(slug) || byName.get(norm(title));
    if (!labels) {
      unmatched++;
      console.log(`  ~ SKIP (hors Airtable) [${imgId}] ${slug || link} | "${title}"`);
      continue;
    }
    matched++;
    const fids = filterIdsFor(labels);
    const fLabels = fids.map((id) => REGISTRY.find(([x]) => x === id)[1]);
    console.log(`  • ${slug} -> [${fids.join(',')}] ${fLabels.join(' / ')}`);
    if (APPLY) {
      const r = await fetch(`${WP_ROOT}/wp-json/assemblage/v1/pfg/append`, {
        method: 'POST', headers: WP_H,
        body: JSON.stringify({
          galleryId: GALLERY, imageId: Number(imgId),
          title: titles[i] || slug, description: (g['image-desc'] || [])[i] || '',
          link, filters: fids,
        }),
      });
      const jj = await r.json().catch(() => ({}));
      if (!r.ok) console.log(`     ! échec ${r.status} ${JSON.stringify(jj)}`);
      else applied++;
    }
  }
  console.log(`\nRésumé : ${matched} matchés, ${unmatched} hors-Airtable, ${APPLY ? applied + ' écrits' : 'dry-run'}.`);
}

main().catch((e) => { console.error('ERR', e); process.exit(1); });
