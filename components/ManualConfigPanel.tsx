'use client';

import type { Projet } from '@/types/projet';
import type { ManualConfig, PhotoConfig, PhotoFormat } from '@/lib/pdf/manualConfig';
import { allPhotos } from '@/lib/pdf/templates/shared';

interface Props {
  projet: Projet;
  config: ManualConfig;
  onChange: (next: ManualConfig) => void;
}

const SECTION: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8,
  padding: '12px 16px',
  borderRight: '1px solid #DFE4E8',
  minWidth: 240,
};
const LAST_SECTION: React.CSSProperties = { ...SECTION, borderRight: 'none', flex: 1 };
const STITLE: React.CSSProperties = {
  fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--ai-rouge)', marginBottom: 2,
};
const ROW: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', fontSize: '9pt' };
const SUBROW: React.CSSProperties = { ...ROW, paddingLeft: 8, borderLeft: '2px solid #DFE4E8' };

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={ROW}>
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

const MAX_EXTRA_PHOTOS_1COL = 5;

export default function ManualConfigPanel({ projet, config, onChange }: Props) {
  const photos = allPhotos(projet);
  const photoOptions = photos.map((p, i) => ({
    value: i,
    label: `Photo ${i + 1}${p.filename ? ` — ${p.filename}` : ''}`,
  }));

  // Mutateurs
  const setMain = (patch: Partial<PhotoConfig>) =>
    onChange({ ...config, mainPhoto: { ...config.mainPhoto, ...patch } });
  const setMain2 = (patch: Partial<PhotoConfig>) => {
    const cur = config.mainPhoto2 ?? { index: Math.min(1, photos.length - 1), sizePercent: 100 };
    onChange({ ...config, mainPhoto2: { ...cur, ...patch } });
  };
  const setFormat = (format: PhotoFormat) => {
    if (format === 'portrait' && !config.mainPhoto2) {
      onChange({
        ...config,
        mainPhotoFormat: 'portrait',
        mainPhoto2: { index: Math.min(1, photos.length - 1), sizePercent: 100 },
      });
    } else {
      onChange({ ...config, mainPhotoFormat: format });
    }
  };
  const setColumns = (n: 1 | 2) => {
    // En 2-col, on garde uniquement la 1ʳᵉ photo additionnelle.
    if (n === 2 && (config.extraPhotos?.length ?? 0) > 1) {
      onChange({ ...config, textColumns: 2, extraPhotos: config.extraPhotos!.slice(0, 1) });
    } else {
      onChange({ ...config, textColumns: n });
    }
  };

  const extras = config.extraPhotos ?? [];
  const toggleExtras = () => {
    if (extras.length > 0) {
      onChange({ ...config, extraPhotos: [] });
    } else {
      onChange({
        ...config,
        extraPhotos: [{ index: Math.min(2, photos.length - 1), sizePercent: 100 }],
      });
    }
  };
  const setExtraCount = (n: number) => {
    const target = Math.max(1, Math.min(MAX_EXTRA_PHOTOS_1COL, n));
    const next = [...extras];
    while (next.length < target) {
      next.push({
        index: Math.min(next.length + 2, photos.length - 1),
        sizePercent: 100,
      });
    }
    if (next.length > target) next.length = target;
    onChange({ ...config, extraPhotos: next });
  };
  const setExtraAt = (i: number, patch: Partial<PhotoConfig>) => {
    const next = [...extras];
    if (!next[i]) return;
    next[i] = { ...next[i], ...patch };
    onChange({ ...config, extraPhotos: next });
  };

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
            <button key={f} onClick={() => setFormat(f)} style={radioBtn(config.mainPhotoFormat === f)}>{f}</button>
          ))}
        </div>
        <div style={ROW}>
          <span style={{ minWidth: 60, color: 'var(--ai-noir70)' }}>Photo 1</span>
          <select value={config.mainPhoto.index} onChange={e => setMain({ index: Number(e.target.value) })} style={select}>
            {photoOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <Slider label="Taille 1" value={config.mainPhoto.sizePercent} onChange={v => setMain({ sizePercent: v })} />
        {config.mainPhotoFormat === 'portrait' && (
          <>
            <div style={ROW}>
              <span style={{ minWidth: 60, color: 'var(--ai-noir70)' }}>Photo 2</span>
              <select value={config.mainPhoto2?.index ?? 1} onChange={e => setMain2({ index: Number(e.target.value) })} style={select}>
                {photoOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <Slider label="Taille 2" value={config.mainPhoto2?.sizePercent ?? 100} onChange={v => setMain2({ sizePercent: v })} />
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

      {/* PHOTOS ADDITIONNELLES */}
      <div style={LAST_SECTION}>
        <div style={STITLE}>Photo{extras.length > 1 ? 's' : ''} additionnelle{extras.length > 1 ? 's' : ''}</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={toggleExtras} style={radioBtn(extras.length > 0)}>
            {extras.length > 0 ? 'Activée' : 'Désactivée'}
          </button>
          {extras.length > 0 && config.textColumns === 1 && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 12, fontSize: '9pt', color: 'var(--ai-noir70)' }}>
              <span>Nombre :</span>
              <button
                onClick={() => setExtraCount(extras.length - 1)}
                disabled={extras.length <= 1}
                style={{ ...radioBtn(false), padding: '2px 8px', cursor: extras.length <= 1 ? 'not-allowed' : 'pointer', opacity: extras.length <= 1 ? 0.4 : 1 }}
              >−</button>
              <span style={{ minWidth: 16, textAlign: 'center', fontWeight: 700, color: 'var(--ai-rouge)' }}>{extras.length}</span>
              <button
                onClick={() => setExtraCount(extras.length + 1)}
                disabled={extras.length >= MAX_EXTRA_PHOTOS_1COL}
                style={{ ...radioBtn(false), padding: '2px 8px', cursor: extras.length >= MAX_EXTRA_PHOTOS_1COL ? 'not-allowed' : 'pointer', opacity: extras.length >= MAX_EXTRA_PHOTOS_1COL ? 0.4 : 1 }}
              >+</button>
            </div>
          )}
        </div>

        {extras.map((e, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={SUBROW}>
              <span style={{ minWidth: 60, color: 'var(--ai-noir70)' }}>Photo {i + 1}</span>
              <select value={e.index} onChange={ev => setExtraAt(i, { index: Number(ev.target.value) })} style={select}>
                {photoOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div style={SUBROW}>
              <Slider label={`Taille ${i + 1}`} value={e.sizePercent} onChange={v => setExtraAt(i, { sizePercent: v })} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
