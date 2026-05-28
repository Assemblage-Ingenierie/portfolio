'use client';

import { useState, useEffect } from 'react';
import type { Projet } from '@/types/projet';
import type {
  ManualConfig, PhotoConfig, PhotoFormat,
  KeywordsConfig, CertificationsConfig, PrestationAssemblageConfig,
} from '@/lib/pdf/manualConfig';
import { MAX_MAIN_PORTRAIT_PHOTOS } from '@/lib/pdf/manualConfig';
import type { BandeauConfig, BandeauStyle } from '@/lib/pdf/bandeauConfig';
import { allPhotos } from '@/lib/pdf/templates/shared';
import BandeauConfigPanel, { StyleRow } from '@/components/projet/BandeauConfigPanel';

// ─── Constantes ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'portfolio_layout_section';
const MAX_EXTRA_PHOTOS = 5;

type SectionId = 'typo' | 'main' | 'text' | 'extra' | 'keywords' | 'certifications' | 'prestation';

interface SectionDef { id: SectionId; label: string; devOnly?: boolean; }

const SECTIONS: SectionDef[] = [
  { id: 'typo',           label: 'Mise en page typographique' },
  { id: 'main',           label: 'Photo principale' },
  { id: 'text',           label: 'Texte description' },
  { id: 'extra',          label: 'Photos additionnelles' },
  { id: 'keywords',       label: 'Mots-clés' },
  { id: 'certifications', label: 'Certifications' },
  { id: 'prestation',     label: 'Prestation Assemblage', devOnly: true },
];

// ─── Styles partagés ─────────────────────────────────────────────────────────

const ROW: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', fontSize: '9pt' };
const SUBROW: React.CSSProperties = { ...ROW, paddingLeft: 8, borderLeft: '2px solid #DFE4E8' };

const radioBtn = (active: boolean): React.CSSProperties => ({
  padding: '4px 10px', borderRadius: 2, cursor: 'pointer',
  fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
  background: active ? 'var(--ai-violet)' : 'white',
  color: active ? 'white' : 'var(--ai-noir70)',
  border: active ? 'none' : '1px solid #DFE4E8',
});

const select: React.CSSProperties = {
  flex: 1, minWidth: 0, maxWidth: '100%',
  padding: '4px 6px', fontSize: '9pt',
  border: '1px solid #DFE4E8', borderRadius: 2, background: 'white',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncateFilename(name: string | undefined, maxLen = 18): string {
  if (!name) return '';
  return name.length <= maxLen ? name : name.slice(0, maxLen - 1) + '…';
}

// ─── Slider ──────────────────────────────────────────────────────────────────

interface SliderProps {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; unit?: string;
}

function Slider({ label, value, onChange, min = 25, max = 100, step = 5, unit = '%' }: SliderProps) {
  return (
    <div style={ROW}>
      <span style={{ minWidth: 60, color: 'var(--ai-noir70)' }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: '#E30513' }}
      />
      <input
        type="number" min={min} max={max} step={1} value={value}
        onChange={e => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        style={{
          width: 50, padding: '2px 4px', textAlign: 'right',
          fontFamily: 'var(--sans)', fontSize: '9pt', fontWeight: 700,
          color: 'var(--ai-rouge)', border: '1px solid #DFE4E8', borderRadius: 2, background: 'white',
        }}
      />
      <span style={{ minWidth: 14, color: 'var(--ai-noir70)' }}>{unit}</span>
    </div>
  );
}

// ─── Contenant générique d'un panneau ────────────────────────────────────────

function ContentPanel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 16px', fontFamily: 'var(--sans)' }}>
      {children}
    </div>
  );
}

// ─── Section : Photo principale ──────────────────────────────────────────────

interface MainPhotoProps { projet: Projet; config: ManualConfig; onChange: (next: ManualConfig) => void; }

function MainPhotoSection({ projet, config, onChange }: MainPhotoProps) {
  const photos = allPhotos(projet);
  const photoOptions = photos.map((p, i) => ({
    value: i,
    label: `Photo ${i + 1}${p.filename ? ` — ${truncateFilename(p.filename)}` : ''}`,
  }));

  const setMain = (patch: Partial<PhotoConfig>) =>
    onChange({ ...config, mainPhoto: { ...config.mainPhoto, ...patch } });
  const setMain2 = (patch: Partial<PhotoConfig>) => {
    const cur = config.mainPhoto2 ?? { index: Math.min(1, photos.length - 1), sizePercent: 100 };
    onChange({ ...config, mainPhoto2: { ...cur, ...patch } });
  };
  const setFormat = (format: PhotoFormat) => {
    if (format === 'portrait' && !config.mainPhoto2) {
      onChange({ ...config, mainPhotoFormat: 'portrait', mainPhoto2: { index: Math.min(1, photos.length - 1), sizePercent: 100 } });
    } else {
      onChange({ ...config, mainPhotoFormat: format });
    }
  };

  const portraitExtras: PhotoConfig[] = config.mainPhotosExtra ?? [];
  const portraitCount = 1 + (config.mainPhoto2 ? 1 : 0) + portraitExtras.length;

  const setPortraitCount = (n: number) => {
    const target = Math.max(2, Math.min(MAX_MAIN_PORTRAIT_PHOTOS, n));
    if (target === 2) {
      onChange({ ...config, mainPhoto2: config.mainPhoto2 ?? { index: Math.min(1, photos.length - 1), sizePercent: 100 }, mainPhotosExtra: [] });
      return;
    }
    const targetExtras = target - 2;
    const next: PhotoConfig[] = [...portraitExtras];
    while (next.length < targetExtras) next.push({ index: Math.min(next.length + 2, photos.length - 1), sizePercent: 100 });
    if (next.length > targetExtras) next.length = targetExtras;
    onChange({ ...config, mainPhotosExtra: next });
  };

  const setPortraitExtraAt = (i: number, patch: Partial<PhotoConfig>) => {
    const next = [...portraitExtras];
    if (!next[i]) return;
    next[i] = { ...next[i], ...patch };
    onChange({ ...config, mainPhotosExtra: next });
  };

  return (
    <ContentPanel>
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
      <Slider label="Horizontal 1" value={config.mainPhoto.offsetPercent ?? 50} onChange={v => setMain({ offsetPercent: v })} min={0} max={100} step={5} />
      <Slider label="Vertical 1" value={config.mainPhoto.offsetVerticalPercent ?? 50} onChange={v => setMain({ offsetVerticalPercent: v })} min={0} max={100} step={5} />

      {config.mainPhotoFormat === 'portrait' && (
        <>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
            <span style={{ fontSize: '9pt', color: 'var(--ai-noir70)' }}>Nombre :</span>
            <button
              onClick={() => setPortraitCount(portraitCount - 1)}
              disabled={portraitCount <= 2}
              style={{ ...radioBtn(false), padding: '2px 8px', cursor: portraitCount <= 2 ? 'not-allowed' : 'pointer', opacity: portraitCount <= 2 ? 0.4 : 1 }}
            >−</button>
            <span style={{ minWidth: 16, textAlign: 'center', fontWeight: 700, color: 'var(--ai-rouge)' }}>{portraitCount}</span>
            <button
              onClick={() => setPortraitCount(portraitCount + 1)}
              disabled={portraitCount >= MAX_MAIN_PORTRAIT_PHOTOS}
              style={{ ...radioBtn(false), padding: '2px 8px', cursor: portraitCount >= MAX_MAIN_PORTRAIT_PHOTOS ? 'not-allowed' : 'pointer', opacity: portraitCount >= MAX_MAIN_PORTRAIT_PHOTOS ? 0.4 : 1 }}
            >+</button>
          </div>
          <div style={ROW}>
            <span style={{ minWidth: 60, color: 'var(--ai-noir70)' }}>Photo 2</span>
            <select value={config.mainPhoto2?.index ?? 1} onChange={e => setMain2({ index: Number(e.target.value) })} style={select}>
              {photoOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <Slider label="Taille 2" value={config.mainPhoto2?.sizePercent ?? 100} onChange={v => setMain2({ sizePercent: v })} />
          <Slider label="Horizontal 2" value={config.mainPhoto2?.offsetPercent ?? 50} onChange={v => setMain2({ offsetPercent: v })} min={0} max={100} step={5} />
          <Slider label="Vertical 2" value={config.mainPhoto2?.offsetVerticalPercent ?? 50} onChange={v => setMain2({ offsetVerticalPercent: v })} min={0} max={100} step={5} />

          {portraitExtras.map((e, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={ROW}>
                <span style={{ minWidth: 60, color: 'var(--ai-noir70)' }}>Photo {i + 3}</span>
                <select value={e.index} onChange={ev => setPortraitExtraAt(i, { index: Number(ev.target.value) })} style={select}>
                  {photoOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <Slider label={`Taille ${i + 3}`} value={e.sizePercent} onChange={v => setPortraitExtraAt(i, { sizePercent: v })} />
              <Slider label={`Horizontal ${i + 3}`} value={e.offsetPercent ?? 50} onChange={v => setPortraitExtraAt(i, { offsetPercent: v })} min={0} max={100} step={5} />
              <Slider label={`Vertical ${i + 3}`} value={e.offsetVerticalPercent ?? 50} onChange={v => setPortraitExtraAt(i, { offsetVerticalPercent: v })} min={0} max={100} step={5} />
            </div>
          ))}
        </>
      )}
    </ContentPanel>
  );
}

// ─── Section : Texte description ─────────────────────────────────────────────

function TextSection({ config, onChange }: { config: ManualConfig; onChange: (next: ManualConfig) => void }) {
  return (
    <ContentPanel>
      <div style={{ display: 'flex', gap: 4 }}>
        {([1, 2] as const).map(n => (
          <button key={n} onClick={() => onChange({ ...config, textColumns: n })} style={radioBtn(config.textColumns === n)}>
            {n} colonne{n > 1 ? 's' : ''}
          </button>
        ))}
      </div>
      <Slider
        label={config.textColumns === 1 ? '% texte' : '% col 1'}
        value={config.textCol1Percent}
        onChange={v => onChange({ ...config, textCol1Percent: v })}
        min={0} max={100} step={5}
      />
      {config.textColumns === 2 && (
        <Slider
          label="% col 2"
          value={config.textCol2Percent}
          onChange={v => onChange({ ...config, textCol2Percent: v })}
          min={0} max={100} step={5}
        />
      )}
    </ContentPanel>
  );
}

// ─── Section : Photos additionnelles ─────────────────────────────────────────

interface ExtraProps { projet: Projet; config: ManualConfig; onChange: (next: ManualConfig) => void; }

function ExtraPhotosSection({ projet, config, onChange }: ExtraProps) {
  const photos = allPhotos(projet);
  const photoOptions = photos.map((p, i) => ({
    value: i,
    label: `Photo ${i + 1}${p.filename ? ` — ${truncateFilename(p.filename)}` : ''}`,
  }));
  const extras = config.extraPhotos ?? [];

  const toggleExtras = () => {
    if (extras.length > 0) onChange({ ...config, extraPhotos: [] });
    else onChange({ ...config, extraPhotos: [{ index: Math.min(2, photos.length - 1), sizePercent: 100 }] });
  };
  const setExtraCount = (n: number) => {
    const target = Math.max(1, Math.min(MAX_EXTRA_PHOTOS, n));
    const next = [...extras];
    while (next.length < target) next.push({ index: Math.min(next.length + 2, photos.length - 1), sizePercent: 100 });
    if (next.length > target) next.length = target;
    onChange({ ...config, extraPhotos: next });
  };
  const setExtraAt = (i: number, patch: Partial<PhotoConfig>) => {
    const next = [...extras];
    if (!next[i]) return;
    next[i] = { ...next[i], ...patch };
    onChange({ ...config, extraPhotos: next });
  };

  return (
    <ContentPanel>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={toggleExtras} style={radioBtn(extras.length > 0)}>
          {extras.length > 0 ? 'Activée' : 'Désactivée'}
        </button>
        {extras.length > 0 && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 12, fontSize: '9pt', color: 'var(--ai-noir70)' }}>
            <span>Nombre :</span>
            <button
              onClick={() => setExtraCount(extras.length - 1)} disabled={extras.length <= 1}
              style={{ ...radioBtn(false), padding: '2px 8px', cursor: extras.length <= 1 ? 'not-allowed' : 'pointer', opacity: extras.length <= 1 ? 0.4 : 1 }}
            >−</button>
            <span style={{ minWidth: 16, textAlign: 'center', fontWeight: 700, color: 'var(--ai-rouge)' }}>{extras.length}</span>
            <button
              onClick={() => setExtraCount(extras.length + 1)} disabled={extras.length >= MAX_EXTRA_PHOTOS}
              style={{ ...radioBtn(false), padding: '2px 8px', cursor: extras.length >= MAX_EXTRA_PHOTOS ? 'not-allowed' : 'pointer', opacity: extras.length >= MAX_EXTRA_PHOTOS ? 0.4 : 1 }}
            >+</button>
          </div>
        )}
      </div>

      {extras.map((e, i) => {
        const isEnabled = e.enabled !== false;
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, opacity: isEnabled ? 1 : 0.5 }}>
            <div style={SUBROW}>
              <button
                type="button"
                onClick={() => setExtraAt(i, { enabled: !isEnabled })}
                title={isEnabled ? 'Désactiver cette photo' : 'Réactiver cette photo'}
                style={{
                  width: 18, height: 18, padding: 0, border: '1px solid #DFE4E8', borderRadius: 2,
                  background: isEnabled ? 'var(--ai-violet)' : 'white', color: 'white', cursor: 'pointer',
                  fontSize: 11, lineHeight: '14px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 18px',
                }}
              >{isEnabled ? '✓' : ''}</button>
              <span style={{ minWidth: 50, color: 'var(--ai-noir70)' }}>Photo {i + 1}</span>
              <select value={e.index} onChange={ev => setExtraAt(i, { index: Number(ev.target.value) })} style={select}>
                {photoOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div style={SUBROW}><Slider label={`Taille ${i + 1}`} value={e.sizePercent} onChange={v => setExtraAt(i, { sizePercent: v })} /></div>
            <div style={SUBROW}><Slider label={`Horizontal ${i + 1}`} value={e.offsetPercent ?? 50} onChange={v => setExtraAt(i, { offsetPercent: v })} min={0} max={100} step={5} /></div>
            <div style={SUBROW}><Slider label={`Vertical ${i + 1}`} value={e.offsetVerticalPercent ?? 50} onChange={v => setExtraAt(i, { offsetVerticalPercent: v })} min={0} max={100} step={5} /></div>
          </div>
        );
      })}
    </ContentPanel>
  );
}

// ─── Section : Mots-clés ─────────────────────────────────────────────────────

function KeywordsSection({ projet, config, onChange }: { projet: Projet; config: ManualConfig; onChange: (next: ManualConfig) => void }) {
  const kw = config.keywords ?? { show: false };
  const hasMotsCles = projet.motsCles && projet.motsCles.length > 0;
  const update = (patch: Partial<KeywordsConfig>) => onChange({ ...config, keywords: { ...kw, ...patch } });

  return (
    <ContentPanel>
      <div style={ROW}>
        <button onClick={() => update({ show: !kw.show })} style={radioBtn(!!kw.show)} disabled={!hasMotsCles}>
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
          <Slider label="Horizontal" value={kw.offsetPercent ?? 50} onChange={v => update({ offsetPercent: v })} min={0} max={100} step={5} />
          <Slider label="Vertical" value={kw.offsetVerticalPercent ?? 50} onChange={v => update({ offsetVerticalPercent: v })} min={0} max={100} step={5} />
          <Slider label="Espacement" value={kw.lineSpacing ?? 1} onChange={v => update({ lineSpacing: v })} min={0} max={20} step={1} unit="mm" />
          <div style={{ marginTop: 6 }}>
            <label style={{ display: 'block', fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 6 }}>
              Mise en page (police, taille, B/I/U, couleur texte, surlignage)
            </label>
            <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', margin: '0 0 6px' }}>
              Une virgule dans le champ Airtable « Mots-clés » crée un retour à la ligne.
            </p>
            <StyleRow
              style={(kw.style ?? {}) as BandeauStyle}
              onChange={st => {
                const isEmpty = !st.fontFamily && st.fontSize === undefined && !st.bold && !st.italic && !st.underline && !st.color && !st.background;
                update({ style: isEmpty ? undefined : st });
              }}
            />
          </div>
        </>
      )}
    </ContentPanel>
  );
}

// ─── Section : Certifications ────────────────────────────────────────────────
// Comportement strictement identique à KeywordsSection — copié plutôt que
// factorisé pour rester lisible (les deux blocs sont conceptuellement
// indépendants côté UX).

function CertificationsSection({ projet, config, onChange }: { projet: Projet; config: ManualConfig; onChange: (next: ManualConfig) => void }) {
  const cert = config.certifications ?? { show: false };
  const hasCertifs = projet.certifications && projet.certifications.length > 0;
  const update = (patch: Partial<CertificationsConfig>) =>
    onChange({ ...config, certifications: { ...cert, ...patch } });

  return (
    <ContentPanel>
      <div style={ROW}>
        <button onClick={() => update({ show: !cert.show })} style={radioBtn(!!cert.show)} disabled={!hasCertifs}>
          {cert.show ? 'Liste activée' : 'Activer la liste'}
        </button>
      </div>
      {!hasCertifs && (
        <p style={{ fontSize: '8pt', color: 'var(--ai-noir70)', margin: 0 }}>
          Aucune certification renseignée côté Airtable pour ce projet.
        </p>
      )}
      {hasCertifs && (
        <p style={{ fontSize: '8pt', color: 'var(--ai-noir70)', margin: '4px 0 0' }}>
          {projet.certifications.length} certification{projet.certifications.length > 1 ? 's' : ''} : {projet.certifications.join(', ')}
        </p>
      )}
      {cert.show && hasCertifs && (
        <>
          <Slider label="Horizontal" value={cert.offsetPercent ?? 50} onChange={v => update({ offsetPercent: v })} min={0} max={100} step={5} />
          <Slider label="Vertical" value={cert.offsetVerticalPercent ?? 50} onChange={v => update({ offsetVerticalPercent: v })} min={0} max={100} step={5} />
          <Slider label="Espacement" value={cert.lineSpacing ?? 1} onChange={v => update({ lineSpacing: v })} min={0} max={20} step={1} unit="mm" />
          <div style={{ marginTop: 6 }}>
            <label style={{ display: 'block', fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 6 }}>
              Mise en page (police, taille, B/I/U, couleur texte, surlignage)
            </label>
            <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', margin: '0 0 6px' }}>
              Une virgule dans le champ Airtable « Certification » crée un retour à la ligne.
            </p>
            <StyleRow
              style={(cert.style ?? {}) as BandeauStyle}
              onChange={st => {
                const isEmpty = !st.fontFamily && st.fontSize === undefined && !st.bold && !st.italic && !st.underline && !st.color && !st.background;
                update({ style: isEmpty ? undefined : st });
              }}
            />
          </div>
        </>
      )}
    </ContentPanel>
  );
}

// ─── Section : Prestation Assemblage (Dev only) ───────────────────────────────

function PrestationSection({ projet, config, onChange }: { projet: Projet; config: ManualConfig; onChange: (next: ManualConfig) => void }) {
  const pa: PrestationAssemblageConfig = config.prestationAssemblage ?? { show: true };
  const isActive = pa.show !== false;
  const hasValue = Boolean((projet.prestationAssemblage ?? '').trim());
  const update = (patch: Partial<PrestationAssemblageConfig>) =>
    onChange({ ...config, prestationAssemblage: { ...pa, ...patch } });

  return (
    <ContentPanel>
      <div style={ROW}>
        <button onClick={() => update({ show: !isActive })} style={radioBtn(isActive)} disabled={!hasValue}>
          {isActive ? 'Bloc activé' : 'Activer le bloc'}
        </button>
      </div>
      {!hasValue && (
        <p style={{ fontSize: '8pt', color: 'var(--ai-noir70)', margin: 0 }}>
          Champ Airtable « Prestation Assemblage » vide pour ce projet.
        </p>
      )}
      {isActive && hasValue && (
        <>
          <div style={{ display: 'flex', gap: 4 }}>
            {([1, 2] as const).map(n => (
              <button key={n} onClick={() => update({ columns: n })} style={radioBtn((pa.columns ?? 1) === n)}>
                {n} colonne{n > 1 ? 's' : ''}
              </button>
            ))}
          </div>
          <Slider label="Horizontal" value={pa.offsetPercent ?? 50} onChange={v => update({ offsetPercent: v })} min={0} max={100} step={5} />
          <Slider label="Vertical" value={pa.offsetVerticalPercent ?? 50} onChange={v => update({ offsetVerticalPercent: v })} min={0} max={100} step={5} />
          <div style={{ marginTop: 6 }}>
            <label style={{ display: 'block', fontSize: '7pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)', marginBottom: 6 }}>
              Mise en page (police, taille, B/I/U, couleur texte, surlignage)
            </label>
            <StyleRow
              style={(pa.style ?? {}) as BandeauStyle}
              onChange={st => {
                const isEmpty = !st.fontFamily && st.fontSize === undefined && !st.bold && !st.italic && !st.underline && !st.color && !st.background;
                update({ style: isEmpty ? undefined : st });
              }}
            />
          </div>
        </>
      )}
    </ContentPanel>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

interface Props {
  projet: Projet;
  config: ManualConfig;
  onChange: (next: ManualConfig) => void;
  bandeauConfig: BandeauConfig;
  onBandeauChange: (next: BandeauConfig) => void;
  isDev?: boolean;
}

const PANEL_WIDTH_KEY = 'portfolio_layout_panel_width';
const PANEL_WIDTH_MIN = 180;
const PANEL_WIDTH_MAX = 600;

export default function LayoutSidebar({ projet, config, onChange, bandeauConfig, onBandeauChange, isDev }: Props) {
  const [active, setActive] = useState<SectionId | null>(null);
  const [panelWidth, setPanelWidth] = useState(280);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as SectionId | null;
    if (saved) setActive(saved);
    const savedWidth = localStorage.getItem(PANEL_WIDTH_KEY);
    if (savedWidth) setPanelWidth(Math.max(PANEL_WIDTH_MIN, Math.min(PANEL_WIDTH_MAX, Number(savedWidth))));
  }, []);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidth;

    function onMove(ev: MouseEvent) {
      const next = Math.max(PANEL_WIDTH_MIN, Math.min(PANEL_WIDTH_MAX, startW + ev.clientX - startX));
      setPanelWidth(next);
    }
    function onUp(ev: MouseEvent) {
      const next = Math.max(PANEL_WIDTH_MIN, Math.min(PANEL_WIDTH_MAX, startW + ev.clientX - startX));
      setPanelWidth(next);
      localStorage.setItem(PANEL_WIDTH_KEY, String(next));
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function toggle(id: SectionId) {
    setActive(prev => {
      const next = prev === id ? null : id;
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
      return next;
    });
  }

  const visibleSections = SECTIONS.filter(s => !s.devOnly || isDev);

  function renderContent() {
    switch (active) {
      case 'typo':
        return (
          <div style={{ padding: '12px 16px', fontFamily: 'var(--sans)' }}>
            <BandeauConfigPanel value={bandeauConfig} onChange={onBandeauChange} projet={projet} />
          </div>
        );
      case 'main':     return <MainPhotoSection projet={projet} config={config} onChange={onChange} />;
      case 'text':     return <TextSection config={config} onChange={onChange} />;
      case 'extra':    return <ExtraPhotosSection projet={projet} config={config} onChange={onChange} />;
      case 'keywords': return <KeywordsSection projet={projet} config={config} onChange={onChange} />;
      case 'certifications': return <CertificationsSection projet={projet} config={config} onChange={onChange} />;
      case 'prestation': return <PrestationSection projet={projet} config={config} onChange={onChange} />;
      default:         return null;
    }
  }

  return (
    <div style={{ display: 'flex', alignSelf: 'stretch', flexShrink: 0 }}>
      {/* Navigation accordion */}
      <nav style={{ width: 170, background: 'white', borderRight: '1px solid #DFE4E8', display: 'flex', flexDirection: 'column' }}>
        {visibleSections.map(s => (
          <button
            key={s.id}
            onClick={() => toggle(s.id)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '11px 14px',
              border: 'none', borderBottom: '1px solid #DFE4E8',
              borderLeft: active === s.id ? '3px solid var(--ai-rouge)' : '3px solid transparent',
              cursor: 'pointer',
              fontFamily: 'var(--sans)', fontSize: '7.5pt', fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              color: active === s.id ? 'var(--ai-rouge)' : 'var(--ai-noir70)',
              background: active === s.id ? '#FFF5F5' : 'white',
              transition: 'background 0.1s',
            }}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* Panneau de contenu + handle de resize */}
      {active && (
        <div style={{ display: 'flex', position: 'relative' }}>
          <div style={{
            width: panelWidth, background: 'white',
            overflowY: 'auto', maxHeight: 'calc(100vh - 48px)',
          }}>
            {renderContent()}
          </div>
          {/* Handle de resize */}
          <div
            onMouseDown={startResize}
            style={{
              width: 5, flexShrink: 0, cursor: 'col-resize',
              background: '#DFE4E8',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--ai-rouge)')}
            onMouseLeave={e => (e.currentTarget.style.background = '#DFE4E8')}
            title="Étirer le panneau"
          />
        </div>
      )}
    </div>
  );
}
