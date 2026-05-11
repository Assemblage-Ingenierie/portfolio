'use client';

import type { Projet } from '@/types/projet';
import type { ManualConfig, PhotoConfig, PhotoFormat, KeywordsConfig } from '@/lib/pdf/manualConfig';
import type { BandeauStyle } from '@/lib/pdf/bandeauConfig';
import { allPhotos } from '@/lib/pdf/templates/shared';
import { StyleRow } from '@/components/projet/BandeauConfigPanel';

type PanelSide = 'left' | 'right' | 'all';

interface Props {
  projet: Projet;
  config: ManualConfig;
  onChange: (next: ManualConfig) => void;
  /**
   * - `'all'` (default) : layout horizontal historique (au-dessus de l'aperçu).
   * - `'left'`  : colonne verticale = Photos additionnelles + Mots-clés.
   * - `'right'` : colonne verticale = Photo principale + Texte description.
   */
  side?: PanelSide;
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

const radioBtn = (active: boolean): React.CSSProperties => ({
  padding: '4px 10px', borderRadius: 2, cursor: 'pointer',
  fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
  background: active ? 'var(--ai-violet)' : 'white',
  color: active ? 'white' : 'var(--ai-noir70)',
  border: active ? 'none' : '1px solid #DFE4E8',
});

interface SliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

function Slider({ label, value, onChange, min = 25, max = 100, step = 5, unit = '%' }: SliderProps) {
  // Saisie numérique fine : à côté du slider (qui reste sur step=5), un input
  // number qui accepte n'importe quelle valeur entière dans [min, max] avec
  // step=1 pour permettre un réglage précis sans utiliser le slider.
  return (
    <div style={ROW}>
      <span style={{ minWidth: 60, color: 'var(--ai-noir70)' }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: '#E30513' }}
      />
      <input
        type="number"
        min={min} max={max} step={1}
        value={value}
        onChange={e => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        style={{
          width: 50, padding: '2px 4px', textAlign: 'right',
          fontFamily: 'var(--sans)', fontSize: '9pt', fontWeight: 700,
          color: 'var(--ai-rouge)',
          border: '1px solid #DFE4E8', borderRadius: 2, background: 'white',
        }}
        title={`Valeur précise (${min}–${max})`}
      />
      <span style={{ minWidth: 14, color: 'var(--ai-noir70)' }}>{unit}</span>
    </div>
  );
}

const MAX_EXTRA_PHOTOS = 5;

export default function ManualConfigPanel({ projet, config, onChange, side = 'all' }: Props) {
  const photos = allPhotos(projet);
  const photoOptions = photos.map((p, i) => ({
    value: i,
    label: `Photo ${i + 1}${p.filename ? ` — ${p.filename}` : ''}`,
  }));

  // Mutateurs photo principale
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

  // Texte (sliders en % de caractères du texte total)
  const setColumns = (n: 1 | 2) => onChange({ ...config, textColumns: n });
  const setCol1Pct = (v: number) => onChange({ ...config, textCol1Percent: v });
  const setCol2Pct = (v: number) => onChange({ ...config, textCol2Percent: v });

  // Photos additionnelles
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
    const target = Math.max(1, Math.min(MAX_EXTRA_PHOTOS, n));
    const next = [...extras];
    while (next.length < target) {
      next.push({ index: Math.min(next.length + 2, photos.length - 1), sizePercent: 100 });
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

  const select: React.CSSProperties = {
    flex: 1, padding: '4px 6px', fontSize: '9pt',
    border: '1px solid #DFE4E8', borderRadius: 2, background: 'white',
  };

  // Visibilité des sections par côté
  const showMain = side === 'all' || side === 'right';
  const showText = side === 'all' || side === 'right';
  const showExtra = side === 'all' || side === 'left';
  const showKeywords = side === 'all' || side === 'left';

  const isVertical = side !== 'all';
  // En layout vertical (sidebar), les sections sont empilées : pas de bordure
  // droite (qui sert d'espacement horizontal), on utilise borderBottom.
  const containerStyle: React.CSSProperties = isVertical
    ? {
        background: 'white',
        border: '1px solid #DFE4E8',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--sans)',
        width: '100%',
      }
    : {
        background: 'white',
        borderTop: '1px solid #DFE4E8',
        borderBottom: '1px solid #DFE4E8',
        display: 'flex',
        flexWrap: 'wrap',
        fontFamily: 'var(--sans)',
      };
  // En mode sidebar, override la bordure : verticale entre sections
  const sectionOverride: React.CSSProperties = isVertical
    ? { borderRight: 'none', borderBottom: '1px solid #DFE4E8', minWidth: 0 }
    : {};
  const lastSectionOverride: React.CSSProperties = isVertical
    ? { borderRight: 'none', borderBottom: 'none', flex: 'unset', minWidth: 0 }
    : {};

  return (
    <div style={containerStyle}>
      {/* PHOTO PRINCIPALE */}
      {showMain && (
      <div style={{ ...SECTION, ...sectionOverride }}>
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
        <Slider
          label="Horizontal 1"
          value={config.mainPhoto.offsetPercent ?? 50}
          onChange={v => setMain({ offsetPercent: v })}
          min={0} max={100} step={5}
        />
        <Slider
          label="Vertical 1"
          value={config.mainPhoto.offsetVerticalPercent ?? 50}
          onChange={v => setMain({ offsetVerticalPercent: v })}
          min={0} max={100} step={5}
        />
        {config.mainPhotoFormat === 'portrait' && (
          <>
            <div style={ROW}>
              <span style={{ minWidth: 60, color: 'var(--ai-noir70)' }}>Photo 2</span>
              <select value={config.mainPhoto2?.index ?? 1} onChange={e => setMain2({ index: Number(e.target.value) })} style={select}>
                {photoOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <Slider label="Taille 2" value={config.mainPhoto2?.sizePercent ?? 100} onChange={v => setMain2({ sizePercent: v })} />
            <Slider
              label="Horizontal 2"
              value={config.mainPhoto2?.offsetPercent ?? 50}
              onChange={v => setMain2({ offsetPercent: v })}
              min={0} max={100} step={5}
            />
            <Slider
              label="Vertical 2"
              value={config.mainPhoto2?.offsetVerticalPercent ?? 50}
              onChange={v => setMain2({ offsetVerticalPercent: v })}
              min={0} max={100} step={5}
            />
          </>
        )}
      </div>
      )}

      {/* TEXTE */}
      {showText && (
      <div style={{ ...SECTION, ...sectionOverride }}>
        <div style={STITLE}>Texte description</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {([1, 2] as const).map(n => (
            <button key={n} onClick={() => setColumns(n)} style={radioBtn(config.textColumns === n)}>
              {n} colonne{n > 1 ? 's' : ''}
            </button>
          ))}
        </div>
        <Slider
          label={config.textColumns === 1 ? '% texte' : '% col 1'}
          value={config.textCol1Percent}
          onChange={setCol1Pct}
          min={0} max={100} step={5} unit="%"
        />
        {config.textColumns === 2 && (
          <Slider
            label="% col 2"
            value={config.textCol2Percent}
            onChange={setCol2Pct}
            min={0} max={100} step={5} unit="%"
          />
        )}
      </div>
      )}

      {/* PHOTOS ADDITIONNELLES */}
      {showExtra && (
      <div style={{ ...SECTION, ...sectionOverride }}>
        <div style={STITLE}>Photo{extras.length > 1 ? 's' : ''} additionnelle{extras.length > 1 ? 's' : ''}</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={toggleExtras} style={radioBtn(extras.length > 0)}>
            {extras.length > 0 ? 'Activée' : 'Désactivée'}
          </button>
          {extras.length > 0 && (
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
                disabled={extras.length >= MAX_EXTRA_PHOTOS}
                style={{ ...radioBtn(false), padding: '2px 8px', cursor: extras.length >= MAX_EXTRA_PHOTOS ? 'not-allowed' : 'pointer', opacity: extras.length >= MAX_EXTRA_PHOTOS ? 0.4 : 1 }}
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
            <div style={SUBROW}>
              <Slider
                label={`Horizontal ${i + 1}`}
                value={e.offsetPercent ?? 50}
                onChange={v => setExtraAt(i, { offsetPercent: v })}
                min={0} max={100} step={5}
              />
            </div>
            <div style={SUBROW}>
              <Slider
                label={`Vertical ${i + 1}`}
                value={e.offsetVerticalPercent ?? 50}
                onChange={v => setExtraAt(i, { offsetVerticalPercent: v })}
                min={0} max={100} step={5}
              />
            </div>
          </div>
        ))}
      </div>
      )}

      {/* MOTS-CLÉS — liste flottante optionnelle */}
      {showKeywords && (
        <KeywordsSection
          projet={projet}
          config={config.keywords}
          onChange={(kw) => onChange({ ...config, keywords: kw })}
          containerStyleOverride={lastSectionOverride}
        />
      )}
    </div>
  );
}

interface KeywordsSectionProps {
  projet: Projet;
  config: KeywordsConfig | undefined;
  onChange: (next: KeywordsConfig) => void;
  containerStyleOverride?: React.CSSProperties;
}

function KeywordsSection({ projet, config, onChange, containerStyleOverride }: KeywordsSectionProps) {
  const kw = config ?? { show: false };
  const hasMotsCles = projet.motsCles && projet.motsCles.length > 0;
  const update = (patch: Partial<KeywordsConfig>) => onChange({ ...kw, ...patch });

  return (
    <div style={{ ...LAST_SECTION, ...containerStyleOverride }}>
      <div style={STITLE}>Mots-clés</div>
      <div style={ROW}>
        <button
          onClick={() => update({ show: !kw.show })}
          style={radioBtn(kw.show)}
          disabled={!hasMotsCles}
        >
          {kw.show ? 'Liste activée' : 'Activer la liste'}
        </button>
      </div>
      {!hasMotsCles && (
        <p style={{ fontSize: '8pt', color: 'var(--ai-noir70)', margin: 0 }}>
          Aucun mot-clé renseigné côté Airtable pour ce projet.
        </p>
      )}
      {hasMotsCles && (
        <p style={{ fontSize: '8pt', color: 'var(--ai-noir70)', margin: '4px 0 0' }}>
          {projet.motsCles.length} mot{projet.motsCles.length > 1 ? 's' : ''}-clé{projet.motsCles.length > 1 ? 's' : ''} : {projet.motsCles.join(', ')}
        </p>
      )}
      {kw.show && hasMotsCles && (
        <>
          <Slider
            label="Horizontal"
            value={kw.offsetPercent ?? 50}
            onChange={(v) => update({ offsetPercent: v })}
            min={0} max={100} step={5}
          />
          <Slider
            label="Vertical"
            value={kw.offsetVerticalPercent ?? 50}
            onChange={(v) => update({ offsetVerticalPercent: v })}
            min={0} max={100} step={5}
          />
          <Slider
            label="Espacement"
            value={kw.lineSpacing ?? 1}
            onChange={(v) => update({ lineSpacing: v })}
            min={0} max={20} step={1}
            unit="mm"
          />
          <div style={{ marginTop: 6 }}>
            <label style={{ display: 'block', fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 6 }}>
              Mise en page (police, taille, B/I/U, couleur texte, surlignage)
            </label>
            <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', margin: '0 0 6px' }}>
              Une virgule dans le champ Airtable « Mots-clés » crée un retour à la ligne.
              Tout ce qui est entre deux virgules reste sur la même ligne.
            </p>
            <StyleRow
              style={(kw.style ?? {}) as BandeauStyle}
              onChange={(st) => {
                const isEmpty =
                  !st.fontFamily && st.fontSize === undefined &&
                  !st.bold && !st.italic && !st.underline &&
                  !st.color && !st.background;
                update({ style: isEmpty ? undefined : st });
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
