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
      widgetVis: visKeys(s),
      ancestorsVis: ancestors.map((a) => ({ id: a.id, type: a.elType + (a.widgetType ? ':' + a.widgetType : ''), vis: visKeys(a.settings) })),
    });
  }
  if (Array.isArray(node.elements)) walk(node.elements, [...ancestors, node], hits);
}

const pg = await (await fetch(`${base}/wp-json/wp/v2/pages/${PAGE}?context=edit`, { headers: { Authorization: 'Basic ' + tok } })).json();
// backup meta complet de la page (sécurité avant toute édition éventuelle)
fs.mkdirSync('docs/wordpress/backups', { recursive: true });
fs.writeFileSync(`docs/wordpress/backups/page-${PAGE}-elementor-20260610.json`, JSON.stringify(pg.meta?._elementor_data ?? null, null, 2));

const ed = pg?.meta?._elementor_data;
const tree = typeof ed === 'string' ? JSON.parse(ed) : ed;
const hits = [];
walk(tree, [], hits);
console.log(`Widgets [PFG id=2461] trouvés : ${hits.length}`);
for (const h of hits) {
  console.log('\n— widget', h.id, '| visibilité widget:', JSON.stringify(h.widgetVis));
  for (const a of h.ancestorsVis) if (Object.keys(a.vis).length) console.log('    ancêtre', a.type, a.id, '->', JSON.stringify(a.vis));
}
