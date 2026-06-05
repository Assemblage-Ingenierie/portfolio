'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  WP_ASPECT_RATIOS,
  WP_FIELD_LABELS,
  ASSEMBLAGE_PALETTE,
  wpFieldOrder,
  resolveWpConfig,
  effectiveFieldStyle,
  effectivePhotoSettings,
  type WpConfig,
  type WpTemplate,
  type WpFieldKey,
  type WpFieldStyle,
} from '@/lib/wordpress/wpConfig';
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

type SectionId = 'typo' | 'fields' | 'spacing' | 'categories' | 'photos';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'typo', label: 'Typographie générale' },
  { id: 'fields', label: 'Champs du bandeau' },
  { id: 'spacing', label: 'Espacements' },
  { id: 'categories', label: 'Catégories' },
  { id: 'photos', label: 'Photos' },
];

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
  config, onChange, template, slug, tagsExportWp, knownPhotos,
}: {
  config: WpConfig; onChange: (next: WpConfig) => void; template: WpTemplate; slug: string; tagsExportWp: string[]; knownPhotos: KnownPhoto[];
}) {
  const [active, setActive] = useState<SectionId | null>('fields');

  const resolved = resolveWpConfig(config);
  const { typo, fields, photos, spacing } = resolved;
  const aspectOptions = WP_ASPECT_RATIOS.map((r) => ({ value: r, label: r }));

  const setTypo = (patch: Partial<typeof typo>) => onChange({ ...config, typo: { ...config.typo, ...patch } });
  const setPhotos = (patch: Partial<typeof photos>) => onChange({ ...config, photos: { ...config.photos, ...patch } });
  const setSpacing = (patch: Partial<typeof spacing>) => onChange({ ...config, spacing: { ...config.spacing, ...patch } });
  // Mise à jour d'un réglage par-photo (clé = filename).
  const setPerPhoto = (filename: string, patch: { enabled?: boolean; offsetX?: number; offsetY?: number }) => {
    const current = config.photos?.perPhoto ?? {};
    const merged = { ...current, [filename]: { ...(current[filename] ?? {}), ...patch } };
    onChange({ ...config, photos: { ...config.photos, perPhoto: merged } });
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

  return (
    <aside style={{ width: 300, flexShrink: 0, background: 'white', borderRight: `1px solid ${color.gris}`, display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 48px)' }}>
      <nav style={{ padding: 12, borderBottom: `1px solid ${ui.separateur}` }}>
        <Link href={`/projet/${slug}/edit`}
          style={{ display: 'block', textAlign: 'center', padding: '7px 10px', fontFamily: font.sans, fontSize: '8pt', fontWeight: 600, color: 'white', background: color.violet as string, borderRadius: radius.action, textDecoration: 'none', marginBottom: 8 }}>
          ✎ Éditer les champs
        </Link>
        <button onClick={() => onChange({})}
          style={{ width: '100%', padding: '6px 10px', fontFamily: font.sans, fontSize: '8pt', fontWeight: 600, color: color.violet, background: 'transparent', border: `1px solid ${color.gris}`, borderRadius: radius.action, cursor: 'pointer', marginBottom: 8 }}>
          ↺ Réinitialiser le style
        </button>
        <div style={{ fontFamily: font.sans, fontSize: '8pt', color: color.noir70, marginBottom: 8 }}>
          Template WP : <strong style={{ color: color.violet }}>{template}</strong> <span style={{ opacity: 0.7 }}>(via Vignette pôle)</span>
        </div>
        {SECTIONS.map((s) => (
          <button key={s.id} onClick={() => setActive(active === s.id ? null : s.id)}
            style={{ width: '100%', textAlign: 'left', padding: '8px 10px', fontFamily: font.sans, fontSize: '9pt', fontWeight: 600, color: active === s.id ? 'white' : color.violet, background: active === s.id ? (color.violet as string) : 'transparent', border: 'none', borderRadius: radius.action, cursor: 'pointer', marginBottom: 2 }}>
            {s.label}
          </button>
        ))}
      </nav>

      <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
        {active === 'typo' && (
          <>
            <Slider label="Taille description" value={typo.descriptionSizePx} min={11} max={24} suffix="px" onChange={(v) => setTypo({ descriptionSizePx: v })} />
            <Slider label="Interlignage description" value={typo.descriptionLineHeight} min={1.2} max={2.2} step={0.05} onChange={(v) => setTypo({ descriptionLineHeight: v })} />
            <Slider label="Taille champs clés (défaut)" value={typo.fieldsSizePt} min={9} max={18} suffix="pt" onChange={(v) => setTypo({ fieldsSizePt: v })} />
            <Slider label="Taille pitch (chapô)" value={typo.pitchSizePx} min={14} max={30} suffix="px" onChange={(v) => setTypo({ pitchSizePx: v })} />
            <Slider label="Taille titre de section" value={typo.sectionTitleSizePx} min={16} max={32} suffix="px" onChange={(v) => setTypo({ sectionTitleSizePx: v })} />
          </>
        )}

        {active === 'fields' && (
          <>
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

            {wpFieldOrder(template).map((key) => {
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
                          Taille {effSize}pt {ov.sizePt !== undefined && (
                            <button onClick={() => clearOverrideProp(key, 'sizePt')} title="Revenir au défaut global"
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: color.noir70 }}>↺</button>
                          )}
                        </span>
                        <input type="range" min={9} max={20} value={effSize}
                          onChange={(e) => setOverride(key, { sizePt: Number(e.target.value) })}
                          style={{ accentColor: color.rouge as string, width: 120 }} />
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
          </>
        )}

        {active === 'spacing' && (
          <>
            <Slider label="Titre ↔ accroche" value={spacing.titlePitchPx} min={0} max={120} suffix="px" onChange={(v) => setSpacing({ titlePitchPx: v })} />
            <Slider label="Accroche ↔ photo" value={spacing.pitchPhotoPx} min={0} max={120} suffix="px" onChange={(v) => setSpacing({ pitchPhotoPx: v })} />
            <Slider label="Photo ↔ description" value={spacing.photoDescPx} min={0} max={120} suffix="px" onChange={(v) => setSpacing({ photoDescPx: v })} />
            <p style={{ fontFamily: font.sans, fontSize: '8pt', color: color.noir70, margin: '4px 0 0', lineHeight: 1.4 }}>
              « Titre ↔ accroche » = marge au-dessus du contenu (le titre est rendu par le thème WordPress).
            </p>
          </>
        )}

        {active === 'categories' && (
          <>
            <p style={{ fontFamily: font.sans, fontSize: '8pt', color: color.noir70, margin: '0 0 12px', lineHeight: 1.5 }}>
              À l&apos;export, ces catégories (champ Airtable « Tags export WP ») sont <strong>cochées dans le panneau « Catégories » du post WordPress</strong> (créées si absentes). Le thème WP les affiche au-dessus du titre. Modifiez-les dans Airtable.
            </p>
            {tagsExportWp.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tagsExportWp.map((t) => (
                  <span key={t} style={{ fontFamily: font.sans, fontSize: '8pt', fontWeight: 600, color: color.violet, background: ui.separateur, border: `1px solid ${color.gris}`, borderRadius: radius.pill, padding: '3px 8px' }}>{t}</span>
                ))}
              </div>
            ) : (
              <p style={{ fontFamily: font.sans, fontSize: '8pt', color: color.noir70, fontStyle: 'italic' }}>Aucune catégorie (« Tags export WP » vide).</p>
            )}
          </>
        )}

        {active === 'photos' && (
          <>
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

            {/* ── Réglages par photo ───────────────────────────────────── */}
            <hr style={{ border: 'none', borderTop: `1px solid ${ui.separateur}`, margin: '12px 0' }} />
            <div style={{ fontFamily: font.sans, fontSize: '9pt', fontWeight: 700, color: color.violet, margin: '0 0 8px' }}>Photos individuelles</div>
            <p style={{ fontFamily: font.sans, fontSize: '8pt', color: color.noir70, margin: '0 0 12px', lineHeight: 1.4 }}>
              Active / désactive chaque photo et règle son cadrage (% horizontal / vertical, pas de 5 %, saisie manuelle possible). La photo choisie comme couverture est retirée de la galerie.
            </p>
            {knownPhotos.length === 0 && (
              <p style={{ fontFamily: font.sans, fontSize: '8pt', color: color.noir70, fontStyle: 'italic' }}>Aucune photo détectée sur cette fiche.</p>
            )}
            {knownPhotos.map((p) => {
              const eff = effectivePhotoSettings(resolved, p.filename);
              const isCoverEffective = (photos.coverFilename ?? knownPhotos.find((q) => q.isCover)?.filename) === p.filename;
              return (
                <div key={p.filename} style={{ border: `1px solid ${color.gris}`, borderRadius: radius.action, padding: 8, marginBottom: 8, opacity: eff.enabled ? 1 : 0.55 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ width: 56, height: 42, flexShrink: 0, borderRadius: 4, overflow: 'hidden', background: color.gris as string, position: 'relative' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={p.filename}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${eff.offsetX}% ${eff.offsetY}%`, display: 'block' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: font.sans, fontSize: '8pt', fontWeight: 600, color: color.violet, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.filename}>
                        {p.filename}
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: font.sans, fontSize: '8pt', color: color.noir70, cursor: 'pointer' }}>
                          <input type="checkbox" checked={eff.enabled} onChange={(e) => setPerPhoto(p.filename, { enabled: e.target.checked })} />
                          Activée
                        </label>
                        {isCoverEffective && (
                          <span style={{ fontFamily: font.sans, fontSize: '7.5pt', fontWeight: 700, color: color.rouge, letterSpacing: '0.05em' }}>• COUVERTURE</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {eff.enabled && !isCoverEffective && (
                    <>
                      <StepSlider label="Horizontal" value={eff.offsetX} min={0} max={100} suffix="%" onChange={(v) => setPerPhoto(p.filename, { offsetX: v })} />
                      <StepSlider label="Vertical" value={eff.offsetY} min={0} max={100} suffix="%" onChange={(v) => setPerPhoto(p.filename, { offsetY: v })} />
                    </>
                  )}
                </div>
              );
            })}

            {/* ── Prestation Assemblage (Dev uniquement) ──────────────── */}
            {template === 'Dev' && (
              <>
                <hr style={{ border: 'none', borderTop: `1px solid ${ui.separateur}`, margin: '12px 0' }} />
                <div style={{ fontFamily: font.sans, fontSize: '9pt', fontWeight: 700, color: color.violet, margin: '0 0 8px' }}>Prestation Assemblage</div>
                <p style={{ fontFamily: font.sans, fontSize: '8pt', color: color.noir70, margin: '0 0 8px', lineHeight: 1.4 }}>
                  Position du bloc par rapport à la description et à la galerie (template Dev uniquement).
                </p>
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
              </>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
