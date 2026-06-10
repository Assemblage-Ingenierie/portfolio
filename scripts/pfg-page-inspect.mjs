// Inspecte les widgets shortcode [PFG id=2461] de la page 5915 : visibilité
// responsive (hide_desktop/tablet/mobile) sur le widget et ses ancêtres.
import fs from 'node:fs';
const base = process.env.WP_BASE_URL.replace(/\/$/, '').replace(/\/wp-json\/wp\/v2$/, '');
const tok = Buffer.from(process.env.WP_USER + ':' + (process.env.WP_APP_PASSWORD || '').replace(/\s/g, '')).toString('base64');
const PAGE = Number(process.env.PAGE || 5915);
const NEEDLE = process.env.NEEDLE || '[PFG id=2461]';

const visKeys = (s) => Object.fromEntries(Object.entries(s || {}).filter(([k]) => /hide_|_visibility|responsive/i.test(k)));

function walk(node, ancestors, hits) {
  if (Array.isArray(node)) { for (const n of node) walk(n, ancestors, hits); return; }
  if (!node || typeof node !== 'object') return;
  const s = node.settings || {};
  if (node.widgetType === 'shortcode' && typeof s.shortcode === 'string' && s.shortcode.includes(NEEDLE)) {
    hits.push({
      id: node.id,
      shortcode: s.shortcode,
      settings: JSON.stringify(s),
      topSection: ancestors[0] ? ancestors[0].id : null,
      chain: ancestors.map((a) => a.elType + (a.widgetType ? ':' + a.widgetType : '') + '#' + a.id).join(' > '),
    });
  }
  if (Array.isArray(node.elements)) walk(node.elements, [...ancestors, node], hits);
}

const pg = await (await fetch(`${base}/wp-json/wp/v2/pages/${PAGE}?context=edit`, { headers: { Authorization: 'Basic ' + tok } })).json();
// backup meta complet de la page (sécurité avant toute édition éventuelle).
// N'écrit QUE si le fichier n'existe pas encore → ne clobbe pas le 1er snapshot
// lors des relances de vérification.
fs.mkdirSync('docs/wordpress/backups', { recursive: true });
const backupPath = `docs/wordpress/backups/page-${PAGE}-elementor-20260610.json`;
if (!fs.existsSync(backupPath)) {
  fs.writeFileSync(backupPath, JSON.stringify(pg.meta?._elementor_data ?? null, null, 2));
}

const ed = pg?.meta?._elementor_data;
const tree = typeof ed === 'string' ? JSON.parse(ed) : ed;
// Ordre des sections de 1er niveau (pour situer "haut -> bas").
const topOrder = (Array.isArray(tree) ? tree : []).map((n) => n.id);
const hits = [];
walk(tree, [], hits);
console.log(`Widgets [PFG id=2461] trouvés : ${hits.length}\n`);
hits.forEach((h, i) => {
  const pos = topOrder.indexOf(h.topSection);
  console.log(`#${i + 1} (section de 1er niveau n°${pos + 1}/${topOrder.length}) — widget id ${h.id}`);
  console.log('   chemin:', h.chain);
});
const settingsSet = new Set(hits.map((h) => h.settings));
console.log(`\nRéglages identiques entre les 3 ? ${settingsSet.size === 1 ? 'OUI (interchangeables)' : 'NON'}`);
if (settingsSet.size !== 1) hits.forEach((h, i) => console.log(`  #${i + 1} settings:`, h.settings.slice(0, 300)));
