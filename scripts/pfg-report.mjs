// Diagnostic page /structure/ (triple shortcode) + génération de la liste des
// tuiles non rattachées à Airtable (non re-taguées).
//   node --env-file=.env scripts/pfg-report.mjs
import fs from 'node:fs';

const base = process.env.WP_BASE_URL.replace(/\/$/, '').replace(/\/wp-json\/wp\/v2$/, '');
const tok = Buffer.from(process.env.WP_USER + ':' + (process.env.WP_APP_PASSWORD || '').replace(/\s/g, '')).toString('base64');
const WPH = { headers: { Authorization: 'Basic ' + tok } };
const AT_KEY = process.env.AIRTABLE_API_KEY, AT_BASE = process.env.AIRTABLE_BASE_ID, AT_TABLE = process.env.AIRTABLE_TABLE_NAME || 'Affaire';
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const slugOf = (l) => { try { return new URL(l).pathname.replace(/^\/|\/$/g, '').toLowerCase(); } catch { return ''; } };

const GALLERY = Number(process.env.GALLERY || 2461);
const PAGE = Number(process.env.PAGE || 5915);

async function main() {
  // --- BUG : compter les widgets shortcode PFG sur la page ---
  const pg = await (await fetch(`${base}/wp-json/wp/v2/pages/${PAGE}?context=edit`, WPH)).json();
  const ed = pg?.meta?._elementor_data;
  const data = typeof ed === 'string' ? ed : JSON.stringify(ed || '');
  const occ = (data.match(new RegExp(`\\[PFG id=${GALLERY}\\]`, 'g')) || []).length;
  console.log(`PAGE ${PAGE} — occurrences [PFG id=${GALLERY}] dans _elementor_data : ${occ}`);

  // --- Airtable : index slug + nom ---
  const sc = await (await fetch(`https://api.airtable.com/v0/meta/bases/${AT_BASE}/tables`, { headers: { Authorization: 'Bearer ' + AT_KEY } })).json();
  const t = (sc.tables || []).find((x) => x.name === AT_TABLE) || (sc.tables || [])[0];
  const F_SLUG = (t.fields.find((f) => f.name === 'Slug') || {}).id;
  const F_NOM = (t.fields.find((f) => f.name === 'Nom du projet') || {}).id;
  const bySlug = new Set(), byName = new Set();
  let off;
  do {
    const u = new URL(`https://api.airtable.com/v0/${AT_BASE}/${encodeURIComponent(AT_TABLE)}`);
    u.searchParams.set('returnFieldsByFieldId', 'true'); u.searchParams.set('pageSize', '100');
    if (off) u.searchParams.set('offset', off);
    const j = await (await fetch(u, { headers: { Authorization: 'Bearer ' + AT_KEY } })).json();
    for (const r of j.records || []) {
      const f = r.fields;
      if (typeof f[F_SLUG] === 'string') bySlug.add(f[F_SLUG].toLowerCase());
      if (typeof f[F_NOM] === 'string') byName.add(norm(f[F_NOM]));
    }
    off = j.offset;
  } while (off);

  // --- Galerie : tuiles non rattachées ---
  const j = await (await fetch(`${base}/wp-json/assemblage/v1/pfg/diag/${GALLERY}`, WPH)).json();
  const g = j.meta[`awl_filter_gallery${GALLERY}`][0];
  const ids = g['image-ids'] || [], titles = g['image_title'] || [];
  const unmatched = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i], link = (g['image-link'] || {})[id] || '', slug = slugOf(link), title = titles[i] || '';
    if (!bySlug.has(slug) && !byName.has(norm(title))) unmatched.push({ id, title, slug });
  }

  let md = '# Tuiles de la page Structure non mises à jour (filtres)\n\n';
  md += `Galerie PFG **${GALLERY}** (page /structure/). Re-tag du 2026-06-10 : `;
  md += `**${ids.length - unmatched.length}/${ids.length}** tuiles rattachées à Airtable et re-taguées.\n\n`;
  md += `Les **${unmatched.length}** tuiles ci-dessous n'ont pas pu être rattachées automatiquement `;
  md += `(slug/nom WordPress divergent de Airtable, ou projet absent d'Airtable). Elles **conservent `;
  md += `leurs filtres manuels existants** mais ne sont pas couvertes par les nouvelles catégories `;
  md += `(Programme principal, Maçonnerie/Paille/Pierre). Pour les inclure : soit corriger le nom/slug `;
  md += `côté Airtable pour qu'il matche, soit les taguer à la main dans l'UI PFG.\n\n`;
  md += '| # | Titre (WordPress) | Slug | image id |\n|---|---|---|---|\n';
  unmatched.forEach((u, i) => { md += `| ${i + 1} | ${u.title.replace(/\|/g, '/')} | ${u.slug} | ${u.id} |\n`; });

  fs.writeFileSync('docs/wordpress/structure-tuiles-non-mises-a-jour.md', md);
  console.log(`DOC écrit : docs/wordpress/structure-tuiles-non-mises-a-jour.md (${unmatched.length} tuiles)`);
}
main().catch((e) => { console.error('ERR', e); process.exit(1); });
