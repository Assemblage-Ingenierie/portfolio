'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  WP_ASPECT_RATIOS,
  ASSEMBLAGE_PALETTE,
  ASSEMBLAGE_WP_DEFAULTS,
  WP_MAX_GALLERY_SLOTS,
  resolveWpConfig,
  defaultGallerySlot,
  type WpConfig,
  type WpTemplate,
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
 * Sidebar en menus déroulants (`<details>`). Sections restantes : « Prestation
 * Assemblage » (template Dev uniquement) et « Photos ».
 *
 * « Typographie générale », « Champs du bandeau » et « Espacements » ont été
 * retirées le 31/08/26 — pour tous les rôles, admin compris. Les valeurs
 * correspondantes de `WpConfig` (typo / fields / spacing) sont toujours lues
 * par le builder : elles viennent de la config sauvegardée en Airtable ou du
 * preset `ASSEMBLAGE_WP_DEFAULTS`, que le bouton « Appliquer les paramètres
 * par défaut WordPress » (admin, cf. `useViewMode`) repose.
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
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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

const SIDEBAR_WIDTH_KEY = 'portfolio_wp_sidebar_width';
const SIDEBAR_WIDTH_MIN = 280;
const SIDEBAR_WIDTH_MAX = 720;
const SIDEBAR_WIDTH_DEFAULT = 380;

export default function WpLayoutSidebar({
  config, onChange, template, slug, knownPhotos,
}: {
  config: WpConfig; onChange: (next: WpConfig) => void; template: WpTemplate; slug: string; knownPhotos: KnownPhoto[];
}) {
  // Mode de vue. Depuis le 31/08/26, les sections « Typographie générale »,
  // « Champs du bandeau » et « Espacements » ne sont plus dans la sidebar (ni
  // pour les admins) : `isUserView` ne sert plus qu'à réserver aux admins le
  // bouton « Appliquer les paramètres par défaut WordPress » (et son « Voir les
  // paramètres »), seul moyen restant de poser ces valeurs.
  // Géré dans `lib/auth/useViewMode.ts` ; le toggle est dans la toolbar.
  const { viewMode } = useViewMode();
  const isUserView = viewMode === 'user';

  // Largeur redimensionnable de la sidebar (poignée à droite, glisser pour
  // élargir/rétrécir). Persistée en localStorage.
  const [width, setWidth] = useState(SIDEBAR_WIDTH_DEFAULT);
  const [showDefaults, setShowDefaults] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (saved) setWidth(Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, Number(saved))));
  }, []);
  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const clamp = (n: number) => Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, n));
    function onMove(ev: MouseEvent) { setWidth(clamp(startW + ev.clientX - startX)); }
    function onUp(ev: MouseEvent) {
      const next = clamp(startW + ev.clientX - startX);
      setWidth(next);
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(next));
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const resolved = resolveWpConfig(config);
  const { photos, prestation } = resolved;
  const aspectOptions = WP_ASPECT_RATIOS.map((r) => ({ value: r, label: r }));
  const fontOptions = [{ value: 'sans', label: 'Open Sans' }, { value: 'serif', label: 'Georgia' }];

  const setPhotos = (patch: Partial<typeof photos>) => onChange({ ...config, photos: { ...config.photos, ...patch } });
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

  // Applique les préréglages « par défaut WordPress » (typo + champs + espacements)
  // par-dessus la config courante. Les réglages photos / catégories / prestation
  // de la fiche sont préservés (merge superficiel). La persistance via /fields ne
  // touche que la clé `wp` du ProjectConfig → les configs PDF restent intactes.
  const applyDefaults = () => {
    if (!confirm('Appliquer les paramètres par défaut WordPress (typographie générale, champs du bandeau, espacements) ? Les réglages photos et catégories de cette fiche sont conservés.')) return;
    onChange({ ...config, ...ASSEMBLAGE_WP_DEFAULTS });
  };

  return (
    <aside style={{ width, flexShrink: 0, background: 'white', borderRight: `1px solid ${color.gris}`, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, position: 'relative' }}>
      {/* Poignée de redimensionnement (glisser à gauche/droite). */}
      <div
        onMouseDown={startResize}
        title="Glisser pour redimensionner la sidebar"
        style={{ position: 'absolute', top: 0, right: -3, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 5 }}
      />
      <nav style={{ padding: 12, borderBottom: `1px solid ${ui.separateur}` }}>
        <Link href={`/projet/${slug}/edit`}
          style={{ display: 'block', textAlign: 'center', padding: '7px 10px', fontFamily: font.sans, fontSize: '8pt', fontWeight: 600, color: 'white', background: color.violet as string, borderRadius: radius.action, textDecoration: 'none', marginBottom: 8 }}>
          ✎ Éditer les champs
        </Link>
        {!isUserView && (
          <>
            <button onClick={applyDefaults}
              title="Applique la typographie générale, les champs du bandeau et les espacements par défaut. Les photos et catégories de la fiche sont conservées."
              style={{ width: '100%', padding: '7px 10px', fontFamily: font.sans, fontSize: '8pt', fontWeight: 600, color: 'white', background: color.rouge as string, border: 'none', borderRadius: radius.action, cursor: 'pointer', marginBottom: 4 }}>
              ★ Appliquer les paramètres par défaut WordPress
            </button>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button onClick={() => setShowDefaults(v => !v)}
                style={{ padding: '2px 6px', fontFamily: font.sans, fontSize: '7.5pt', color: color.violet, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', opacity: 0.75 }}>
                {showDefaults ? '▲ Masquer' : '▼ Voir les paramètres'}
              </button>
            </div>
            {showDefaults && (
              <div style={{ background: '#f6f7f9', border: `1px solid ${color.gris}`, borderRadius: 6, padding: '8px 10px', marginBottom: 8, fontFamily: font.sans, fontSize: '7.5pt', lineHeight: 1.7, color: color.violet }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>Typographie générale</div>
                <div>Description : {ASSEMBLAGE_WP_DEFAULTS.typo?.descriptionSizePx}px · interlignage {ASSEMBLAGE_WP_DEFAULTS.typo?.descriptionLineHeight}</div>
                <div>Champs bandeau (défaut) : {ASSEMBLAGE_WP_DEFAULTS.typo?.fieldsSizePt} pt</div>
                <div>Pitch : {ASSEMBLAGE_WP_DEFAULTS.typo?.pitchSizePx}px · Titres sections : {ASSEMBLAGE_WP_DEFAULTS.typo?.sectionTitleSizePx}px</div>
                <div style={{ fontWeight: 700, marginTop: 6, marginBottom: 2 }}>Champs du bandeau</div>
                <div>Libellés : {ASSEMBLAGE_WP_DEFAULTS.fields?.labelBold ? 'gras' : 'normal'} · noir</div>
                <div>Valeurs : {ASSEMBLAGE_WP_DEFAULTS.fields?.valueBold ? 'gras' : 'normal'} · noir</div>
                <div>Mission AI libellé : <span style={{ color: color.rouge }}>rouge</span> · {ASSEMBLAGE_WP_DEFAULTS.fields?.overrides?.missionAi?.labelSizePt} pt</div>
                <div>Mission AI valeur : noir · {ASSEMBLAGE_WP_DEFAULTS.fields?.overrides?.missionAi?.sizePt} pt · gras · petites cap.</div>
                <div>Programme secondaire : noir · normal</div>
                <div style={{ fontWeight: 700, marginTop: 6, marginBottom: 2 }}>Espacements</div>
                <div>Titre ↔ accroche : {ASSEMBLAGE_WP_DEFAULTS.spacing?.titlePitchPx}px</div>
                <div>Accroche ↔ photo : {ASSEMBLAGE_WP_DEFAULTS.spacing?.pitchPhotoPx}px</div>
                <div>Photo ↔ description : {ASSEMBLAGE_WP_DEFAULTS.spacing?.photoDescPx}px</div>
                <div style={{ fontWeight: 700, marginTop: 6, marginBottom: 2 }}>Police</div>
                <div>Geomanist (fallback Open Sans)</div>
              </div>
            )}
          </>
        )}
        <div style={{ fontFamily: font.sans, fontSize: '8pt', color: color.noir70, marginBottom: 0 }}>
          Template WP : <strong style={{ color: color.violet }}>{template}</strong> <span style={{ opacity: 0.7 }}>(via Vignette pôle)</span>
        </div>
      </nav>

      <div style={{ padding: 16, overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {/* Sections « Typographie générale », « Champs du bandeau » et
            « Espacements » retirées de la sidebar (31/08/26) : elles ne sont
            plus réglables depuis l’UI, y compris en vue admin. Les valeurs
            correspondantes (typo / fields / spacing de WpConfig) restent
            utilisées par le builder — elles proviennent désormais de la config
            sauvegardée en Airtable ou du preset ASSEMBLAGE_WP_DEFAULTS, que le
            bouton « Appliquer les paramètres par défaut WordPress » repose. */}

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
