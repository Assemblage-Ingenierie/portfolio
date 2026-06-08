'use client';

import Link from 'next/link';
import {
  WP_ASPECT_RATIOS,
  WP_FIELD_LABELS,
  ASSEMBLAGE_PALETTE,
  ASSEMBLAGE_WP_DEFAULTS,
  WP_MAX_GALLERY_SLOTS,
  WP_FIELD_MENU_KEYS,
  resolveWpConfig,
  effectiveFieldStyle,
  defaultGallerySlot,
  type WpConfig,
  type WpTemplate,
  type WpFieldKey,
  type WpFieldStyle,
} from '@/lib/wordpress/wpConfig';
import { useViewMode } from '@/lib/auth/useViewMode';
import { color, font, radius, ui } from '@/lib/ui/tokens';

/** Photo connue du projet (cover + photosProjet), passée à la sidebar pour
 *  l'éditeur de réglages individuels. */
export interface KnownPhoto { url: string; filename: string; isCover?: boolean }

/**
 * Sidebar de contrôles de la stylisation de l'export WordPress.
 * Inspirée de `LayoutSidebar` (lien « Éditer les champs » + nav accordéon).
 * N'édite que `WpConfig` (typo globale, typo par champ du bandeau, catégories,
 * disposition photos). La liste des champs dépend du `template` (Str-Env/Dev).
 */

/**
 * Sidebar en menus déroulants (`<details>`). Vue admin = toutes les sections ;
 * vue user = « Typographie générale », « Espacements » et « Catégories »
 * masqués (cf. `useViewMode`). « Prestation Assemblage » n'apparaît que pour
 * le template Dev.
 */

/** Style du `<summary>` des menus déroulants (miroir du panneau bandeau PDF). */
const summaryStyle: React.CSSProperties = {
  cursor: 'pointer',
  fontFamily: font.sans, fontSize: '9pt', fontWeight: 700,
  letterSpacing: '0.04em',
  color: color.violet, padding: '8px 0',
  userSelect: 'none', listStyle: 'none',
};

/** Wrapper de section en menu déroulant. */
function Section({ label, defaultOpen, children }: { label: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details open={defaultOpen} style={{ borderBottom: `1px solid ${ui.separateur}`, marginBottom: 4 }}>
      <summary style={summaryStyle}>{label}</summary>
      <div style={{ padding: '6px 0 14px' }}>{children}</div>
    </details>
  );
}

const rowStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 };
const labelStyle: React.CSSProperties = { fontFamily: font.sans, fontSize: '9pt', fontWeight: 600, color: color.violet, display: 'flex', justifyContent: 'space-between' };

function Slider({
  label, value, min, max, step = 1, suffix, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void;
}) {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}><span>{label}</span><span style={{ color: color.noir70, fontWeight: 400 }}>{value}{suffix ?? ''}</span></span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} style={{ accentColor: color.rouge as string, width: '100%' }} />
    </div>
  );
}

function Select({
  label, value, options, onChange,
}: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}><span>{label}</span></span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ fontFamily: font.sans, fontSize: '9pt', padding: '6px 8px', border: `1px solid ${color.gris}`, borderRadius: radius.action, background: 'white', color: color.noir }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/** Slider + champ numérique liés. Step 5 par défaut (cf. demande utilisateur :
 *  variation par 5% via slider mais réglage manuel possible via le number input). */
function StepSlider({
  label, value, min, max, step = 5, suffix, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, isFinite(n) ? n : min));
  return (
    <div style={{ ...rowStyle, marginBottom: 10 }}>
      <span style={labelStyle}>
        <span>{label}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
            style={{ width: 52, fontFamily: font.sans, fontSize: '9pt', padding: '2px 4px', border: `1px solid ${color.gris}`, borderRadius: 4, textAlign: 'right' }}
          />
          {suffix && <span style={{ color: color.noir70, fontWeight: 400 }}>{suffix}</span>}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ accentColor: color.rouge as string, width: '100%' }}
      />
    </div>
  );
}

function Toggle({
  label, checked, onChange,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span style={{ ...labelStyle, fontWeight: 600 }}>{label}</span>
    </label>
  );
}

/** Sélecteur de couleur limité à la palette Assemblage (+ reset optionnel). */
function Palette({
  value, onChange, onReset, canReset,
}: {
  value: string; onChange: (hex: string) => void; onReset?: () => void; canReset?: boolean;
}) {
  const norm = (h: string) => h.toLowerCase();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {ASSEMBLAGE_PALETTE.map((c) => {
        const selected = norm(c.hex) === norm(value);
        return (
          <button key={c.hex} title={c.name} onClick={() => onChange(c.hex)}
            style={{
              width: 18, height: 18, borderRadius: 4, cursor: 'pointer', padding: 0,
              background: c.hex,
              border: selected ? `2px solid ${color.rouge}` : `1px solid ${color.gris}`,
              boxShadow: selected ? '0 0 0 1px white inset' : 'none',
            }} />
        );
      })}
      {canReset && onReset && (
        <button onClick={onReset} title="Revenir au défaut global"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: color.noir70, fontSize: '11px' }}>↺</button>
      )}
    </span>
  );
}

export default function WpLayoutSidebar({
  config, onChange, template, slug, knownPhotos,
}: {
  config: WpConfig; onChange: (next: WpConfig) => void; template: WpTemplate; slug: string; knownPhotos: KnownPhoto[];
}) {
  // Mode de vue (admin = UI complète ; user = Catégories / Espacements /
  // Typographie générale masqués). Géré dans `lib/auth/useViewMode.ts` ; le
  // toggle est dans la toolbar (visible uniquement pour les profils admin).
  const { viewMode } = useViewMode();
  const isUserView = viewMode === 'user';

  const resolved = resolveWpConfig(config);
  const { typo, fields, photos, spacing, prestation } = resolved;
  const aspectOptions = WP_ASPECT_RATIOS.map((r) => ({ value: r, label: r }));
  const fontOptions = [{ value: 'sans', label: 'Open Sans' }, { value: 'serif', label: 'Georgia' }];

  const setTypo = (patch: Partial<typeof typo>) => onChange({ ...config, typo: { ...config.typo, ...patch } });
  const setPhotos = (patch: Partial<typeof photos>) => onChange({ ...config, photos: { ...config.photos, ...patch } });
  const setSpacing = (patch: Partial<typeof spacing>) => onChange({ ...config, spacing: { ...config.spacing, ...patch } });
  const setPresta = (patch: Partial<typeof prestation>) => onChange({ ...config, prestation: { ...config.prestation, ...patch } });
  // ── Galerie : slots ordonnés, modèle « Photos additionnelles » ──────────
  type GallerySlot = NonNullable<NonNullable<WpConfig['photos']>['gallery']>[number];
  const galleryEnabled = photos.galleryEnabled !== false;
  // Plafond du nombre de slots = nombre de photos réellement présentes sur la
  // fiche (champ Airtable). On ne peut pas afficher plus de photos qu'il n'en
  // existe. Borné aussi par la limite haute absolue `WP_MAX_GALLERY_SLOTS`.
  const maxSlots = Math.max(1, Math.min(WP_MAX_GALLERY_SLOTS, knownPhotos.length));
  // Slots effectifs : ceux configurés OU fallback "toutes sauf la couverture".
  const coverIndexInPool = (() => {
    const targetFilename = photos.coverFilename
      ?? knownPhotos.find((p) => p.isCover)?.filename;
    if (!targetFilename) return 0;
    const idx = knownPhotos.findIndex((p) => p.filename === targetFilename);
    return idx >= 0 ? idx : 0;
  })();
  const configuredSlots: GallerySlot[] = config.photos?.gallery ?? [];
  const setSlots = (next: GallerySlot[]) =>
    onChange({ ...config, photos: { ...config.photos, gallery: next } });
  const setSlotAt = (i: number, patch: Partial<GallerySlot>) => {
    const next = [...configuredSlots];
    if (!next[i]) return;
    next[i] = { ...next[i], ...patch };
    setSlots(next);
  };
  const initSlotsFromPool = (n: number): GallerySlot[] => {
    const out: GallerySlot[] = [];
    // On choisit en priorité les photos qui ne sont pas la couverture, dans l'ordre.
    const candidates: number[] = [];
    for (let i = 0; i < knownPhotos.length; i++) {
      if (i !== coverIndexInPool) candidates.push(i);
    }
    for (let i = 0; i < n; i++) {
      const pickIdx = candidates[i] ?? candidates[candidates.length - 1] ?? 0;
      out.push(defaultGallerySlot(pickIdx));
    }
    return out;
  };
  const toggleGalleryEnabled = () => {
    if (galleryEnabled) {
      onChange({ ...config, photos: { ...config.photos, galleryEnabled: false } });
    } else {
      // Réactivation : on garde les slots existants, ou on en crée par défaut.
      const slots = configuredSlots.length > 0 ? configuredSlots : initSlotsFromPool(Math.max(1, Math.min(3, knownPhotos.length - 1)));
      onChange({ ...config, photos: { ...config.photos, galleryEnabled: true, gallery: slots } });
    }
  };
  const setSlotCount = (n: number) => {
    const target = Math.max(1, Math.min(maxSlots, n));
    const next = [...configuredSlots];
    if (next.length < target) {
      // Ajout : on pioche le prochain index disponible non encore utilisé,
      // sinon on retombe sur le dernier.
      const used = new Set(next.map((s) => s.photoIndex));
      const candidates: number[] = [];
      for (let i = 0; i < knownPhotos.length; i++) {
        if (i !== coverIndexInPool && !used.has(i)) candidates.push(i);
      }
      while (next.length < target) {
        const pick = candidates.shift() ?? (next[next.length - 1]?.photoIndex ?? 0);
        next.push(defaultGallerySlot(pick));
      }
    } else {
      next.length = target;
    }
    setSlots(next);
  };
  const setFieldsGlobal = (patch: { labelBold?: boolean; valueBold?: boolean; labelColor?: string; valueColor?: string }) =>
    onChange({ ...config, fields: { ...(config.fields ?? {}), ...patch } });

  const overrides = config.fields?.overrides ?? {};
  const setOverride = (key: WpFieldKey, patch: Partial<WpFieldStyle>) =>
    onChange({ ...config, fields: { ...(config.fields ?? {}), overrides: { ...overrides, [key]: { ...(overrides[key] ?? {}), ...patch } } } });
  const clearOverrideProp = (key: WpFieldKey, prop: keyof WpFieldStyle) => {
    const next = { ...(overrides[key] ?? {}) };
    delete next[prop];
    onChange({ ...config, fields: { ...(config.fields ?? {}), overrides: { ...overrides, [key]: next } } });
  };

  // Applique les préréglages « par défaut WordPress » (typo + champs + espacements)
  // par-dessus la config courante. Les réglages photos / catégories / prestation
  // de la fiche sont préservés (merge superficiel). La persistance via /fields ne
  // touche que la clé `wp` du ProjectConfig → les configs PDF restent intactes.
  const applyDefaults = () => {
    if (!confirm('Appliquer les paramètres par défaut WordPress (typographie générale, champs du bandeau, espacements) ? Les réglages photos et catégories de cette fiche sont conservés.')) return;
    onChange({ ...config, ...ASSEMBLAGE_WP_DEFAULTS });
  };

  return (
    <aside style={{ width: 300, flexShrink: 0, background: 'white', borderRight: `1px solid ${color.gris}`, display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 48px)' }}>
      <nav style={{ padding: 12, borderBottom: `1px solid ${ui.separateur}` }}>
        <Link href={`/projet/${slug}/edit`}
          style={{ display: 'block', textAlign: 'center', padding: '7px 10px', fontFamily: font.sans, fontSize: '8pt', fontWeight: 600, color: 'white', background: color.violet as string, borderRadius: radius.action, textDecoration: 'none', marginBottom: 8 }}>
          ✎ Éditer les champs
        </Link>
        {!isUserView && (
          <>
            <button onClick={applyDefaults}
              title="Applique la typographie générale, les champs du bandeau et les espacements par défaut. Les photos et catégories de la fiche sont conservées."
              style={{ width: '100%', padding: '7px 10px', fontFamily: font.sans, fontSize: '8pt', fontWeight: 600, color: 'white', background: color.rouge as string, border: 'none', borderRadius: radius.action, cursor: 'pointer', marginBottom: 8 }}>
              ★ Appliquer les paramètres par défaut WordPress
            </button>
            <button onClick={() => onChange({})}
              style={{ width: '100%', padding: '6px 10px', fontFamily: font.sans, fontSize: '8pt', fontWeight: 600, color: color.violet, background: 'transparent', border: `1px solid ${color.gris}`, borderRadius: radius.action, cursor: 'pointer', marginBottom: 8 }}>
              ↺ Réinitialiser le style
            </button>
          </>
        )}
        <div style={{ fontFamily: font.sans, fontSize: '8pt', color: color.noir70, marginBottom: 0 }}>
          Template WP : <strong style={{ color: color.violet }}>{template}</strong> <span style={{ opacity: 0.7 }}>(via Vignette pôle)</span>
        </div>
      </nav>

      <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
        {!isUserView && (
          <Section label="Typographie générale">
            <StepSlider label="Taille description" value={typo.descriptionSizePx} min={11} max={24} step={1} suffix="px" onChange={(v) => setTypo({ descriptionSizePx: v })} />
            <StepSlider label="Interlignage description" value={typo.descriptionLineHeight} min={1.2} max={2.2} step={0.05} onChange={(v) => setTypo({ descriptionLineHeight: v })} />
            <StepSlider label="Taille champs clés (défaut)" value={typo.fieldsSizePt} min={9} max={18} step={1} suffix="pt" onChange={(v) => setTypo({ fieldsSizePt: v })} />
            <StepSlider label="Taille pitch (chapô)" value={typo.pitchSizePx} min={14} max={30} step={1} suffix="px" onChange={(v) => setTypo({ pitchSizePx: v })} />
            <StepSlider label="Taille titre de section" value={typo.sectionTitleSizePx} min={16} max={32} step={1} suffix="px" onChange={(v) => setTypo({ sectionTitleSizePx: v })} />
          </Section>
        )}

        <Section label="Champs du bandeau" defaultOpen>
            <p style={{ fontFamily: font.sans, fontSize: '8pt', color: color.noir70, margin: '0 0 12px', lineHeight: 1.4 }}>
              Défauts appliqués à tous les champs, puis surcharges par champ ci-dessous (couleurs = palette Assemblage).
            </p>
            <Toggle label="Libellés en gras" checked={fields.labelBold} onChange={(v) => setFieldsGlobal({ labelBold: v })} />
            <Toggle label="Valeurs en gras" checked={fields.valueBold} onChange={(v) => setFieldsGlobal({ valueBold: v })} />
            <div style={{ ...rowStyle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ ...labelStyle, fontWeight: 600 }}>Couleur libellés</span>
              <Palette value={fields.labelColor} onChange={(hex) => setFieldsGlobal({ labelColor: hex })} />
            </div>
            <div style={{ ...rowStyle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ ...labelStyle, fontWeight: 600 }}>Couleur valeurs</span>
              <Palette value={fields.valueColor} onChange={(hex) => setFieldsGlobal({ valueColor: hex })} />
            </div>

            <hr style={{ border: 'none', borderTop: `1px solid ${ui.separateur}`, margin: '12px 0' }} />

            {WP_FIELD_MENU_KEYS.map((key) => {
              const ov = overrides[key] ?? {};
              const eff = effectiveFieldStyle(resolved, key);
              const effSize = eff.sizePt ?? typo.fieldsSizePt;
              return (
                <div key={key} style={{ border: `1px solid ${color.gris}`, borderRadius: radius.action, padding: '8px 10px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontFamily: font.sans, fontSize: '9pt', fontWeight: 700, color: color.violet, opacity: eff.hidden ? 0.4 : 1 }}>{WP_FIELD_LABELS[key]}</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: font.sans, fontSize: '8pt', color: color.noir70, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!ov.hidden} onChange={(e) => setOverride(key, { hidden: e.target.checked })} /> Masquer
                    </label>
                  </div>
                  {!eff.hidden && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {key === 'programmeSecondaire' && (
                        <p style={{ fontFamily: font.sans, fontSize: '7.5pt', color: color.noir70, margin: 0, lineHeight: 1.35, fontStyle: 'italic' }}>
                          Rendu après le Programme principal, séparé d&apos;un point médian (pas de libellé propre).
                        </p>
                      )}
                      {key !== 'programmeSecondaire' && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: font.sans, fontSize: '8pt', color: color.noir70 }}>Libellé</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '8pt', color: color.noir70, cursor: 'pointer' }}>
                              <input type="checkbox" checked={eff.labelBold} onChange={(e) => setOverride(key, { labelBold: e.target.checked })} /> gras
                            </label>
                            <Palette value={eff.labelColor} canReset={ov.labelColor !== undefined}
                              onChange={(hex) => setOverride(key, { labelColor: hex })} onReset={() => clearOverrideProp(key, 'labelColor')} />
                          </span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: font.sans, fontSize: '8pt', color: color.noir70 }}>Valeur</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '8pt', color: color.noir70, cursor: 'pointer' }}>
                            <input type="checkbox" checked={eff.valueBold} onChange={(e) => setOverride(key, { valueBold: e.target.checked })} /> gras
                          </label>
                          <Palette value={eff.valueColor} canReset={ov.valueColor !== undefined}
                            onChange={(hex) => setOverride(key, { valueColor: hex })} onReset={() => clearOverrideProp(key, 'valueColor')} />
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: font.sans, fontSize: '8pt', color: color.noir70 }}>
                          Taille (pt) {ov.sizePt !== undefined && (
                            <button onClick={() => clearOverrideProp(key, 'sizePt')} title="Revenir au défaut global"
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: color.noir70 }}>↺</button>
                          )}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <input type="range" min={9} max={20} value={effSize}
                            onChange={(e) => setOverride(key, { sizePt: Number(e.target.value) })}
                            style={{ accentColor: color.rouge as string, width: 90 }} />
                          <input type="number" min={9} max={20} step={1} value={effSize}
                            onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setOverride(key, { sizePt: Math.max(9, Math.min(20, n)) }); }}
                            style={{ width: 46, fontFamily: font.sans, fontSize: '8pt', padding: '2px 4px', border: `1px solid ${color.gris}`, borderRadius: 4, textAlign: 'right' }} />
                        </span>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: font.sans, fontSize: '8pt', color: color.noir70, cursor: 'pointer' }}>
                        <input type="checkbox" checked={eff.smallCaps} onChange={(e) => setOverride(key, { smallCaps: e.target.checked })} />
                        Valeur en petites capitales
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: font.sans, fontSize: '8pt', color: color.noir70, cursor: 'pointer' }}>
                        <input type="checkbox" checked={eff.upperCase} onChange={(e) => setOverride(key, { upperCase: e.target.checked })} />
                        Valeur en grandes capitales
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
        </Section>

        {template === 'Dev' && (
          <Section label="Prestation Assemblage">
            <p style={{ fontFamily: font.sans, fontSize: '8pt', color: color.noir70, margin: '0 0 12px', lineHeight: 1.4 }}>
              Typographie du bloc « Prestation Assemblage » (template Dev). Libellé (titre) et texte enrichi stylés indépendamment de la description.
            </p>

            {/* ── Libellé (titre) ──────────────────────────────────────── */}
            <div style={{ fontFamily: font.sans, fontSize: '9pt', fontWeight: 700, color: color.violet, margin: '0 0 8px' }}>Libellé</div>
            <Select label="Police" value={prestation.labelFont} options={fontOptions} onChange={(v) => setPresta({ labelFont: v as 'sans' | 'serif' })} />
            <div style={{ ...rowStyle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ ...labelStyle, fontWeight: 600 }}>Couleur</span>
              <Palette value={prestation.labelColor} onChange={(hex) => setPresta({ labelColor: hex })} />
            </div>
            <StepSlider label="Taille" value={prestation.labelSizePt} min={9} max={32} step={1} suffix="pt" onChange={(v) => setPresta({ labelSizePt: v })} />
            <Toggle label="En gras" checked={prestation.labelBold} onChange={(v) => setPresta({ labelBold: v })} />
            <Toggle label="En grandes capitales" checked={prestation.labelUpperCase} onChange={(v) => setPresta({ labelUpperCase: v })} />

            <hr style={{ border: 'none', borderTop: `1px solid ${ui.separateur}`, margin: '12px 0' }} />

            {/* ── Valeur (texte enrichi) ───────────────────────────────── */}
            <div style={{ fontFamily: font.sans, fontSize: '9pt', fontWeight: 700, color: color.violet, margin: '0 0 8px' }}>Texte enrichi</div>
            <Select label="Police" value={prestation.valueFont} options={fontOptions} onChange={(v) => setPresta({ valueFont: v as 'sans' | 'serif' })} />
            <div style={{ ...rowStyle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ ...labelStyle, fontWeight: 600 }}>Couleur</span>
              <Palette value={prestation.valueColor} onChange={(hex) => setPresta({ valueColor: hex })} />
            </div>
            <StepSlider label="Taille" value={prestation.valueSizePx} min={11} max={24} step={1} suffix="px" onChange={(v) => setPresta({ valueSizePx: v })} />
            <StepSlider label="Interlignage" value={prestation.valueLineHeight} min={1.2} max={2.2} step={0.05} onChange={(v) => setPresta({ valueLineHeight: v })} />
            <Toggle label="En gras" checked={prestation.valueBold} onChange={(v) => setPresta({ valueBold: v })} />

            <hr style={{ border: 'none', borderTop: `1px solid ${ui.separateur}`, margin: '12px 0' }} />

            {/* ── Position du bloc ─────────────────────────────────────── */}
            <div style={{ fontFamily: font.sans, fontSize: '9pt', fontWeight: 700, color: color.violet, margin: '0 0 8px' }}>Position</div>
            <Select
              label="Position du bloc"
              value={photos.prestationPosition ?? 'after-description'}
              options={[
                { value: 'before-description', label: 'Avant la description' },
                { value: 'after-description', label: 'Après la description (défaut)' },
                { value: 'after-photos', label: 'Après les photos' },
              ]}
              onChange={(v) => setPhotos({ prestationPosition: v as 'before-description' | 'after-description' | 'after-photos' })}
            />
          </Section>
        )}

        {!isUserView && (
          <Section label="Espacements">
            <StepSlider label="Titre ↔ accroche" value={spacing.titlePitchPx} min={0} max={120} step={1} suffix="px" onChange={(v) => setSpacing({ titlePitchPx: v })} />
            <StepSlider label="Accroche ↔ photo" value={spacing.pitchPhotoPx} min={0} max={120} step={1} suffix="px" onChange={(v) => setSpacing({ pitchPhotoPx: v })} />
            <StepSlider label="Photo ↔ description" value={spacing.photoDescPx} min={0} max={120} step={1} suffix="px" onChange={(v) => setSpacing({ photoDescPx: v })} />
            <p style={{ fontFamily: font.sans, fontSize: '8pt', color: color.noir70, margin: '4px 0 0', lineHeight: 1.4 }}>
              « Titre ↔ accroche » = marge au-dessus du contenu (le titre est rendu par le thème WordPress).
            </p>
          </Section>
        )}

        <Section label="Photos">
            {/* ── Couverture ───────────────────────────────────────────── */}
            <div style={{ fontFamily: font.sans, fontSize: '9pt', fontWeight: 700, color: color.violet, margin: '0 0 8px' }}>Couverture</div>
            <Select
              label="Photo utilisée comme couverture"
              value={photos.coverFilename ?? '__default__'}
              options={[
                { value: '__default__', label: '(Défaut Airtable)' },
                ...knownPhotos.map((p) => ({ value: p.filename, label: `${p.filename}${p.isCover ? ' (cover Airtable)' : ''}` })),
              ]}
              onChange={(v) => setPhotos({ coverFilename: v === '__default__' ? undefined : v })}
            />
            <Select label="Ratio couverture" value={photos.coverAspectRatio} options={aspectOptions} onChange={(v) => setPhotos({ coverAspectRatio: v })} />
            <Toggle label="Couverture pleine largeur" checked={photos.coverFullWidth} onChange={(v) => setPhotos({ coverFullWidth: v })} />
            <StepSlider label="Cadrage horizontal" value={photos.coverOffsetX ?? 50} min={0} max={100} suffix="%" onChange={(v) => setPhotos({ coverOffsetX: v })} />
            <StepSlider label="Cadrage vertical" value={photos.coverOffsetY ?? 50} min={0} max={100} suffix="%" onChange={(v) => setPhotos({ coverOffsetY: v })} />

            <hr style={{ border: 'none', borderTop: `1px solid ${ui.separateur}`, margin: '12px 0' }} />

            {/* ── Galerie : colonnes / ratio / gap ─────────────────────── */}
            <div style={{ fontFamily: font.sans, fontSize: '9pt', fontWeight: 700, color: color.violet, margin: '0 0 8px' }}>Galerie</div>
            <Select label="Nombre de photos en largeur" value={String(photos.galleryColumns)}
              options={[{ value: '0', label: 'Auto' }, { value: '1', label: '1 colonne' }, { value: '2', label: '2 colonnes' }, { value: '3', label: '3 colonnes' }, { value: '4', label: '4 colonnes' }]}
              onChange={(v) => setPhotos({ galleryColumns: Number(v) as 0 | 1 | 2 | 3 | 4 })} />
            <Select label="Ratio photos galerie" value={photos.galleryAspectRatio} options={aspectOptions} onChange={(v) => setPhotos({ galleryAspectRatio: v })} />
            <Slider label="Espacement galerie" value={photos.galleryGapPx} min={0} max={40} suffix="px" onChange={(v) => setPhotos({ galleryGapPx: v })} />

            {/* ── Photos additionnelles (slots ordonnés de la galerie) ───────── */}
            <details open style={{ marginTop: 12, borderTop: `1px solid ${ui.separateur}`, paddingTop: 4 }}>
              <summary style={summaryStyle}>Photos additionnelles</summary>
              <div style={{ paddingTop: 8 }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <button
                onClick={toggleGalleryEnabled}
                style={{
                  padding: '4px 10px',
                  fontFamily: font.sans, fontSize: '8pt', fontWeight: 600,
                  color: galleryEnabled ? 'white' : color.violet,
                  background: galleryEnabled ? (color.violet as string) : 'white',
                  border: `1px solid ${color.gris}`, borderRadius: radius.action, cursor: 'pointer',
                }}
              >
                {galleryEnabled ? 'Activée' : 'Désactivée'}
              </button>
              {galleryEnabled && configuredSlots.length > 0 && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 12, fontFamily: font.sans, fontSize: '9pt', color: color.noir70 }}>
                  <span>Nombre :</span>
                  <button
                    onClick={() => setSlotCount(configuredSlots.length - 1)}
                    disabled={configuredSlots.length <= 1}
                    style={{ padding: '2px 8px', fontFamily: font.sans, fontWeight: 600, background: 'white', color: color.violet, border: `1px solid ${color.gris}`, borderRadius: radius.action, cursor: configuredSlots.length <= 1 ? 'not-allowed' : 'pointer', opacity: configuredSlots.length <= 1 ? 0.4 : 1 }}
                  >−</button>
                  <span style={{ minWidth: 16, textAlign: 'center', fontWeight: 700, color: color.rouge }}>{configuredSlots.length}</span>
                  <button
                    onClick={() => setSlotCount(configuredSlots.length + 1)}
                    disabled={configuredSlots.length >= maxSlots}
                    title={configuredSlots.length >= maxSlots ? `Maximum atteint : ${maxSlots} photo(s) sur la fiche.` : 'Ajouter une photo'}
                    style={{ padding: '2px 8px', fontFamily: font.sans, fontWeight: 600, background: 'white', color: color.violet, border: `1px solid ${color.gris}`, borderRadius: radius.action, cursor: configuredSlots.length >= maxSlots ? 'not-allowed' : 'pointer', opacity: configuredSlots.length >= maxSlots ? 0.4 : 1 }}
                  >+</button>
                </div>
              )}
            </div>

            {galleryEnabled && knownPhotos.length === 0 && (
              <p style={{ fontFamily: font.sans, fontSize: '8pt', color: color.noir70, fontStyle: 'italic' }}>Aucune photo détectée sur cette fiche.</p>
            )}

            {galleryEnabled && configuredSlots.length === 0 && knownPhotos.length > 0 && (
              <p style={{ fontFamily: font.sans, fontSize: '8pt', color: color.noir70, lineHeight: 1.4 }}>
                Aucun slot configuré → la galerie affiche toutes les photos du projet sauf la couverture. Clique sur « Activée » puis utilise <strong>+</strong> pour ajouter un slot et choisir ses photos.
              </p>
            )}

            {galleryEnabled && configuredSlots.map((slot, i) => {
              const enabled = slot.enabled !== false;
              const photoOptions = knownPhotos.map((p, idx) => ({
                value: String(idx),
                label: `Photo ${idx + 1}${p.filename ? ' — ' + (p.filename.length > 20 ? p.filename.slice(0, 18) + '…' : p.filename) : ''}${idx === coverIndexInPool ? ' (couverture)' : ''}`,
              }));
              return (
                <div key={i} style={{ border: `1px solid ${color.gris}`, borderRadius: radius.action, padding: 8, marginBottom: 8, opacity: enabled ? 1 : 0.55 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <button
                      type="button"
                      onClick={() => setSlotAt(i, { enabled: !enabled })}
                      title={enabled ? 'Désactiver ce slot' : 'Réactiver ce slot'}
                      style={{
                        width: 18, height: 18, padding: 0, border: `1px solid ${color.gris}`, borderRadius: 2,
                        background: enabled ? (color.violet as string) : 'white', color: 'white', cursor: 'pointer',
                        fontSize: 11, lineHeight: '14px', fontWeight: 700, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >{enabled ? '✓' : ''}</button>
                    <span style={{ fontFamily: font.sans, fontSize: '9pt', fontWeight: 600, color: color.violet, minWidth: 56 }}>Photo {i + 1}</span>
                    <select
                      value={String(slot.photoIndex)}
                      onChange={(e) => setSlotAt(i, { photoIndex: Number(e.target.value) })}
                      style={{ flex: 1, minWidth: 0, fontFamily: font.sans, fontSize: '9pt', padding: '4px 6px', border: `1px solid ${color.gris}`, borderRadius: radius.action, background: 'white', color: color.noir }}
                    >
                      {photoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  {enabled && (
                    <>
                      <StepSlider label={`Taille ${i + 1}`}      value={slot.sizePercent ?? 100} min={0} max={100} suffix="%" onChange={(v) => setSlotAt(i, { sizePercent: v })} />
                      <StepSlider label={`Horizontal ${i + 1}`}  value={slot.offsetX ?? 50}      min={0} max={100} suffix="%" onChange={(v) => setSlotAt(i, { offsetX: v })} />
                      <StepSlider label={`Vertical ${i + 1}`}    value={slot.offsetY ?? 50}      min={0} max={100} suffix="%" onChange={(v) => setSlotAt(i, { offsetY: v })} />
                    </>
                  )}
                </div>
              );
            })}
              </div>
            </details>
        </Section>
      </div>
    </aside>
  );
}
