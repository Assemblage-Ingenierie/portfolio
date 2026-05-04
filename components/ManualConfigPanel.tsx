'use client';

import type { Projet } from '@/types/projet';
import type { ManualConfig, PhotoConfig, PhotoFormat } from '@/lib/pdf/manualConfig';
import { allPhotos } from '@/lib/pdf/templates/shared';

interface Props {
  projet: Projet;
  config: ManualConfig;
  onChange: (next: ManualConfig) => void;
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '9pt' }}>
      <span style={{ minWidth: 60, color: 'var(--ai-noir70)' }}>{label}</span>
      <input
        type="range" min={25} max={100} step={5}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: '#E30513' }}
      />
      <span style={{ minWidth: 36, textAlign: 'right', fontWeight: 700, color: 'var(--ai-rouge)' }}>{value}%</span>
    </div>
  );
}

const SECTION: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8,
  padding: '12px 16px',
  borderRight: '1px solid #DFE4E8',
  minWidth: 220,
};
const LAST_SECTION: React.CSSProperties = { ...SECTION, borderRight: 'none' };
const STITLE: React.CSSProperties = {
  fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--ai-rouge)', marginBottom: 2,
};
const ROW: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', fontSize: '9pt' };

export default function ManualConfigPanel({ projet, config, onChange }: Props) {
  const photos = allPhotos(projet);

  const photoOptions = photos.map((p, i) => ({
    value: i,
    label: `Photo ${i + 1}${p.filename ? ` — ${p.filename}` : ''}`,
  }));

  function updateMainPhoto(patch: Partial<PhotoConfig>) {
    onChange({ ...config, mainPhoto: { ...config.mainPhoto, ...patch } });
  }
  function updateMainPhoto2(patch: Partial<PhotoConfig>) {
    const current = config.mainPhoto2 ?? { index: Math.min(1, photos.length - 1), sizePercent: 100 };
    onChange({ ...config, mainPhoto2: { ...current, ...patch } });
  }
  function setFormat(format: PhotoFormat) {
    if (format === 'portrait' && !config.mainPhoto2) {
      onChange({
        ...config,
        mainPhotoFormat: 'portrait',
        mainPhoto2: { index: Math.min(1, photos.length - 1), sizePercent: 100 },
      });
    } else {
      onChange({ ...config, mainPhotoFormat: format });
    }
  }
  function setColumns(n: 1 | 2) { onChange({ ...config, textColumns: n }); }
  function toggleExtra() {
    if (config.extraPhoto) {
      onChange({ ...config, extraPhoto: undefined });
    } else {
      onChange({
        ...config,
        extraPhoto: { index: Math.min(2, photos.length - 1), sizePercent: 100 },
      });
    }
  }
  function updateExtra(patch: Partial<PhotoConfig>) {
    if (!config.extraPhoto) return;
    onChange({ ...config, extraPhoto: { ...config.extraPhoto, ...patch } });
  }

  const radioBtn = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px', borderRadius: 2, cursor: 'pointer',
    fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
    background: active ? 'var(--ai-violet)' : 'white',
    color: active ? 'white' : 'var(--ai-noir70)',
    border: active ? 'none' : '1px solid #DFE4E8',
  });

  const select: React.CSSProperties = {
    flex: 1, padding: '4px 6px', fontSize: '9pt',
    border: '1px solid #DFE4E8', borderRadius: 2, background: 'white',
  };

  return (
    <div style={{
      background: 'white',
      borderTop: '1px solid #DFE4E8',
      borderBottom: '1px solid #DFE4E8',
      display: 'flex',
      flexWrap: 'wrap',
      fontFamily: 'var(--sans)',
    }}>
      {/* PHOTO PRINCIPALE */}
      <div style={SECTION}>
        <div style={STITLE}>Photo principale</div>

        <div style={{ display: 'flex', gap: 4 }}>
          {(['paysage', 'portrait'] as PhotoFormat[]).map(f => (
            <button key={f} onClick={() => setFormat(f)} style={radioBtn(config.mainPhotoFormat === f)}>
              {f}
            </button>
          ))}
        </div>

        <div style={ROW}>
          <span style={{ minWidth: 60, color: 'var(--ai-noir70)' }}>Photo 1</span>
          <select
            value={config.mainPhoto.index}
            onChange={e => updateMainPhoto({ index: Number(e.target.value) })}
            style={select}
          >
            {photoOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <Slider label="Taille 1" value={config.mainPhoto.sizePercent} onChange={v => updateMainPhoto({ sizePercent: v })} />

        {config.mainPhotoFormat === 'portrait' && (
          <>
            <div style={ROW}>
              <span style={{ minWidth: 60, color: 'var(--ai-noir70)' }}>Photo 2</span>
              <select
                value={config.mainPhoto2?.index ?? 1}
                onChange={e => updateMainPhoto2({ index: Number(e.target.value) })}
                style={select}
              >
                {photoOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <Slider
              label="Taille 2"
              value={config.mainPhoto2?.sizePercent ?? 100}
              onChange={v => updateMainPhoto2({ sizePercent: v })}
            />
          </>
        )}
      </div>

      {/* TEXTE */}
      <div style={SECTION}>
        <div style={STITLE}>Texte description</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {([1, 2] as const).map(n => (
            <button key={n} onClick={() => setColumns(n)} style={radioBtn(config.textColumns === n)}>
              {n} colonne{n > 1 ? 's' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* PHOTO ADDITIONNELLE */}
      <div style={LAST_SECTION}>
        <div style={STITLE}>Photo additionnelle</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={toggleExtra} style={radioBtn(!!config.extraPhoto)}>
            {config.extraPhoto ? 'Activée' : 'Désactivée'}
          </button>
        </div>
        {config.extraPhoto && (
          <>
            <div style={ROW}>
              <span style={{ minWidth: 60, color: 'var(--ai-noir70)' }}>Photo</span>
              <select
                value={config.extraPhoto.index}
                onChange={e => updateExtra({ index: Number(e.target.value) })}
                style={select}
              >
                {photoOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <Slider
              label="Taille"
              value={config.extraPhoto.sizePercent}
              onChange={v => updateExtra({ sizePercent: v })}
            />
          </>
        )}
      </div>
    </div>
  );
}
