'use client';

import { useState } from 'react';
import {
  DEFAULT_WP_CONFIG,
  WP_ASPECT_RATIOS,
  type WpConfig,
} from '@/lib/wordpress/wpConfig';
import { color, font, radius, ui } from '@/lib/ui/tokens';

/**
 * Sidebar de contrôles de la stylisation de l'export WordPress.
 * Inspirée de `LayoutSidebar` (nav accordéon + sliders) mais autonome :
 * elle n'édite que `WpConfig` (typo + disposition photos).
 */

type SectionId = 'typo' | 'photos';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'typo', label: 'Typographie' },
  { id: 'photos', label: 'Photos' },
];

const rowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginBottom: 16,
};

const labelStyle: React.CSSProperties = {
  fontFamily: font.sans,
  fontSize: '9pt',
  fontWeight: 600,
  color: color.violet,
  display: 'flex',
  justifyContent: 'space-between',
};

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>
        <span>{label}</span>
        <span style={{ color: color.noir70, fontWeight: 400 }}>
          {value}
          {suffix ?? ''}
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

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>
        <span>{label}</span>
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontFamily: font.sans,
          fontSize: '9pt',
          padding: '6px 8px',
          border: `1px solid ${color.gris}`,
          borderRadius: radius.action,
          background: 'white',
          color: color.noir,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        ...rowStyle,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
      }}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span style={{ ...labelStyle, fontWeight: 600 }}>{label}</span>
    </label>
  );
}

export default function WpLayoutSidebar({
  config,
  onChange,
}: {
  config: WpConfig;
  onChange: (next: WpConfig) => void;
}) {
  const [active, setActive] = useState<SectionId | null>('typo');

  const typo = { ...DEFAULT_WP_CONFIG.typo, ...(config.typo ?? {}) };
  const photos = { ...DEFAULT_WP_CONFIG.photos, ...(config.photos ?? {}) };

  const setTypo = (patch: Partial<typeof typo>) =>
    onChange({ ...config, typo: { ...typo, ...patch } });
  const setPhotos = (patch: Partial<typeof photos>) =>
    onChange({ ...config, photos: { ...photos, ...patch } });

  const aspectOptions = WP_ASPECT_RATIOS.map((r) => ({ value: r, label: r }));

  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        background: 'white',
        borderRight: `1px solid ${color.gris}`,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100vh - 48px)',
      }}
    >
      <nav style={{ padding: 12, borderBottom: `1px solid ${ui.separateur}` }}>
        <button
          onClick={() => onChange({})}
          style={{
            width: '100%',
            padding: '6px 10px',
            fontFamily: font.sans,
            fontSize: '8pt',
            fontWeight: 600,
            color: color.violet,
            background: 'transparent',
            border: `1px solid ${color.gris}`,
            borderRadius: radius.action,
            cursor: 'pointer',
            marginBottom: 8,
          }}
        >
          ↺ Réinitialiser le style
        </button>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(active === s.id ? null : s.id)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '8px 10px',
              fontFamily: font.sans,
              fontSize: '9pt',
              fontWeight: 600,
              color: active === s.id ? 'white' : color.violet,
              background: active === s.id ? (color.violet as string) : 'transparent',
              border: 'none',
              borderRadius: radius.action,
              cursor: 'pointer',
              marginBottom: 2,
            }}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
        {active === 'typo' && (
          <>
            <Slider
              label="Taille description"
              value={typo.descriptionSizePx}
              min={11}
              max={24}
              suffix="px"
              onChange={(v) => setTypo({ descriptionSizePx: v })}
            />
            <Slider
              label="Interlignage description"
              value={typo.descriptionLineHeight}
              min={1.2}
              max={2.2}
              step={0.05}
              onChange={(v) => setTypo({ descriptionLineHeight: v })}
            />
            <Slider
              label="Taille champs clés"
              value={typo.fieldsSizePt}
              min={9}
              max={18}
              suffix="pt"
              onChange={(v) => setTypo({ fieldsSizePt: v })}
            />
            <Slider
              label="Taille pitch (chapô)"
              value={typo.pitchSizePx}
              min={14}
              max={30}
              suffix="px"
              onChange={(v) => setTypo({ pitchSizePx: v })}
            />
            <Slider
              label="Taille titre de section"
              value={typo.sectionTitleSizePx}
              min={16}
              max={32}
              suffix="px"
              onChange={(v) => setTypo({ sectionTitleSizePx: v })}
            />
          </>
        )}

        {active === 'photos' && (
          <>
            <Select
              label="Ratio photo de couverture"
              value={photos.coverAspectRatio}
              options={aspectOptions}
              onChange={(v) => setPhotos({ coverAspectRatio: v })}
            />
            <Toggle
              label="Couverture pleine largeur"
              checked={photos.coverFullWidth}
              onChange={(v) => setPhotos({ coverFullWidth: v })}
            />
            <Select
              label="Colonnes galerie"
              value={String(photos.galleryColumns)}
              options={[
                { value: '0', label: 'Auto' },
                { value: '1', label: '1 colonne' },
                { value: '2', label: '2 colonnes' },
                { value: '3', label: '3 colonnes' },
              ]}
              onChange={(v) =>
                setPhotos({ galleryColumns: Number(v) as 0 | 1 | 2 | 3 })
              }
            />
            <Select
              label="Ratio photos galerie"
              value={photos.galleryAspectRatio}
              options={aspectOptions}
              onChange={(v) => setPhotos({ galleryAspectRatio: v })}
            />
            <Slider
              label="Espacement galerie"
              value={photos.galleryGapPx}
              min={0}
              max={40}
              suffix="px"
              onChange={(v) => setPhotos({ galleryGapPx: v })}
            />
          </>
        )}
      </div>
    </aside>
  );
}
