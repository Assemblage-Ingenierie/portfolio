'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Projet, TemplateChoice } from '@/types/projet';
import { TEMPLATE_OPTIONS } from '@/types/projet';
import { useViewMode } from '@/lib/auth/useViewMode';
import type {
  ManualConfig, PhotoConfig, PhotoFormat,
  CertificationsConfig, PrestationAssemblageConfig,
} from '@/lib/pdf/manualConfig';
import { MAX_MAIN_PORTRAIT_PHOTOS } from '@/lib/pdf/manualConfig';
import type { BandeauConfig, BandeauStyle } from '@/lib/pdf/bandeauConfig';
import { allPhotos } from '@/lib/pdf/templates/shared';
import BandeauConfigPanel, { StyleRow } from '@/components/projet/BandeauConfigPanel';
import {
  ASSEMBLAGE_DEFAULT_BANDEAU,
  ASSEMBLAGE_DEFAULT_MANUAL,
} from '@/lib/pdf/assemblageDefaults';
import { color } from '@/lib/ui/tokens';

// ─── Constantes ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'portfolio_layout_section';
const MAX_EXTRA_PHOTOS = 5;

type SectionId = 'typo' | 'main' | 'text' | 'extra' | 'certifications' | 'prestation';

interface SectionDef { id: SectionId; label: string; devOnly?: boolean; }

// "Mots-clés" retiré du menu : depuis le passage à la position figée sous le
// statut (cf. headerHtml dans shared.ts), la liste flottante n'est plus
// configurable côté UI.
const SECTIONS: SectionDef[] = [
  { id: 'typo',           label: 'Mise en page' },
  { id: 'main',           label: 'Photo principale' },
  { id: 'text',           label: 'Texte description' },
  { id: 'extra',          label: 'Photos additionnelles' },
  { id: 'certifications', label: 'Certifications' },
  { id: 'prestation',     label: 'Prestation Assemblage', devOnly: true },
];

// ─── Styles partagés ─────────────────────────────────────────────────────────

const ROW: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', fontSize: '9pt' };
const SUBROW: React.CSSProperties = { ...ROW, paddingLeft: 8, borderLeft: `2px solid ${color.gris}` };

const radioBtn = (active: boolean): React.CSSProperties => ({
  padding: '4px 10px', borderRadius: 2, cursor: 'pointer',
  fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700,
  background: active ? 'var(--ai-violet)' : 'white',
  color: active ? 'white' : 'var(--ai-noir70)',
  border: active ? 'none' : `1px solid ${color.gris}`,
});

const select: React.CSSProperties = {
  flex: 1, minWidth: 0, maxWidth: '100%',
  padding: '4px 6px', fontSize: '9pt',
  border: `1px solid ${color.gris}`, borderRadius: 2, background: 'white',
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
  /** Si défini : seuil au-dessus duquel le slider n'a plus d'effet visuel
   *  (la photo a atteint sa taille naturelle max). La portion droite du
   *  rail est grisée pour signaler la zone "morte". */
  saturatedAbove?: number;
}

function Slider({ label, value, onChange, min = 25, max = 100, step = 5, unit = '%', saturatedAbove }: SliderProps) {
  const showOverlay =
    typeof saturatedAbove === 'number' &&
    Number.isFinite(saturatedAbove) &&
    saturatedAbove > min &&
    saturatedAbove < max;
  const overlayLeftPct = showOverlay ? ((saturatedAbove - min) / (max - min)) * 100 : 0;
  return (
    <div style={ROW}>
      <span style={{ minWidth: 60, color: 'var(--ai-noir70)' }}>{label}</span>
      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: color.rouge, width: '100%' }}
        />
        {showOverlay && (
          <div
            title={`Taille maximale atteinte à ${saturatedAbove}% — au-delà la photo ne grandit plus.`}
            style={{
              position: 'absolute',
              left: `${overlayLeftPct}%`,
              right: 0,
              top: '50%',
              height: 6,
              marginTop: -3,
              background: 'rgba(155, 155, 155, 0.55)',
              pointerEvents: 'none',
              borderRadius: 3,
            }}
          />
        )}
      </div>
      <input
        type="number" min={min} max={max} step={1} value={value}
        onChange={e => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        style={{
          width: 50, padding: '2px 4px', textAlign: 'right',
          fontFamily: 'var(--sans)', fontSize: '9pt', fontWeight: 700,
          color: 'var(--ai-rouge)', border: `1px solid ${color.gris}`, borderRadius: 2, background: 'white',
        }}
      />
      <span style={{ minWidth: 14, color: 'var(--ai-noir70)' }}>{unit}</span>
    </div>
  );
}

/**
 * Mesure les dimensions naturelles d'une image. Renvoie null tant que l'image
 * n'est pas chargée (utilisé pour la détection de saturation des sliders Taille).
 */
function useImageNaturalSize(url: string | undefined): { width: number; height: number } | null {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    if (!url) { setSize(null); return; }
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) setSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = url;
    return () => { cancelled = true; };
  }, [url]);
  return size;
}

/**
 * Conversion px → mm à 96 DPI (standard CSS pour les exports PDF / iframe).
 * Si la photo naturelle est plus petite que le conteneur, elle sature avant
 * d'atteindre 100% du slider — on retourne ce seuil pour grisage visuel.
 */
const MM_PER_PX = 25.4 / 96;
function photoSaturationPercent(
  natural: { width: number; height: number } | null,
  containerWidthMm: number,
): number | undefined {
  if (!natural) return undefined;
  const naturalMm = natural.width * MM_PER_PX;
  if (naturalMm >= containerWidthMm) return undefined;
  const pct = Math.round((naturalMm / containerWidthMm) * 100);
  if (pct < 25 || pct >= 100) return undefined;
  return pct;
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
  // Container approximatif de la photo principale en paysage : largeur utile
  // d'une page A4 moins les marges latérales (~186mm). Détecte la saturation
  // du slider Taille 1 pour griser la portion sans effet. En mode portrait
  // la photo principale est rendue dans une grille N colonnes — on ignore
  // pour l'instant (saturation plus rare, calcul plus complexe).
  const CONTAINER_PAYSAGE_MM = 186;
  const mainPhotoUrl = photos[config.mainPhoto.index]?.url;
  const mainNaturalSize = useImageNaturalSize(mainPhotoUrl);
  const mainSaturatedAbove = config.mainPhotoFormat === 'paysage'
    ? photoSaturationPercent(mainNaturalSize, CONTAINER_PAYSAGE_MM)
    : undefined;

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
      <Slider label="Taille 1" value={config.mainPhoto.sizePercent} onChange={v => setMain({ sizePercent: v })} saturatedAbove={mainSaturatedAbove} />
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
  // Container des photos additionnelles : largeur utile A4 ~186mm. Chaque
  // slot grandit jusqu'à cette largeur quand sizePercent=100. Si la photo
  // naturelle est plus petite, on grise la portion morte du slider.
  const EXTRA_CONTAINER_MM = 186;
  // Hook appelé pour chaque slot extra (max 5). Les hooks doivent être appelés
  // dans le même ordre à chaque render → on alloue les 5 slots inconditionnellement.
  const extraUrl0 = photos[extras[0]?.index ?? 0]?.url;
  const extraUrl1 = photos[extras[1]?.index ?? 0]?.url;
  const extraUrl2 = photos[extras[2]?.index ?? 0]?.url;
  const extraUrl3 = photos[extras[3]?.index ?? 0]?.url;
  const extraUrl4 = photos[extras[4]?.index ?? 0]?.url;
  const extraSizes = [
    useImageNaturalSize(extras[0] ? extraUrl0 : undefined),
    useImageNaturalSize(extras[1] ? extraUrl1 : undefined),
    useImageNaturalSize(extras[2] ? extraUrl2 : undefined),
    useImageNaturalSize(extras[3] ? extraUrl3 : undefined),
    useImageNaturalSize(extras[4] ? extraUrl4 : undefined),
  ];
  const extraSaturatedAbove = (i: number): number | undefined =>
    photoSaturationPercent(extraSizes[i] ?? null, EXTRA_CONTAINER_MM);

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
                  width: 18, height: 18, padding: 0, border: `1px solid ${color.gris}`, borderRadius: 2,
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
            <div style={SUBROW}><Slider label={`Taille ${i + 1}`} value={e.sizePercent} onChange={v => setExtraAt(i, { sizePercent: v })} saturatedAbove={extraSaturatedAbove(i)} /></div>
            <div style={SUBROW}><Slider label={`Horizontal ${i + 1}`} value={e.offsetPercent ?? 50} onChange={v => setExtraAt(i, { offsetPercent: v })} min={0} max={100} step={5} /></div>
            <div style={SUBROW}><Slider label={`Vertical ${i + 1}`} value={e.offsetVerticalPercent ?? 50} onChange={v => setExtraAt(i, { offsetVerticalPercent: v })} min={0} max={100} step={5} /></div>
          </div>
        );
      })}
    </ContentPanel>
  );
}

// ─── Section : Certifications ────────────────────────────────────────────────

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
          {pa.columns === 2 && (
            <>
              {/* Sliders de répartition du texte entre col 1 et col 2. col1=100
                  + col2=0 → tout le texte en col 1 (largeur = moitié de page). */}
              <Slider label="% col 1" value={pa.col1Percent ?? 50} onChange={v => update({ col1Percent: v })} min={0} max={100} step={5} />
              <Slider label="% col 2" value={pa.col2Percent ?? 50} onChange={v => update({ col2Percent: v })} min={0} max={100} step={5} />
            </>
          )}
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
  /** Template courant + handler de changement — exposé dans la nav (admin).
   *  Le sélecteur Template a été déplacé de la toolbar vers la sidebar. */
  template?: TemplateChoice;
  onTemplateChange?: (next: TemplateChoice) => void;
  /** Recadrage photos : état + toggle, contrôlés par ProjetView. */
  cropEditMode?: boolean;
  onCropEditModeChange?: (next: boolean) => void;
}

const PANEL_WIDTH_KEY = 'portfolio_layout_panel_width';
const PANEL_WIDTH_MIN = 180;
const PANEL_WIDTH_MAX = 600;

export default function LayoutSidebar({ projet, config, onChange, bandeauConfig, onBandeauChange, isDev, template, onTemplateChange, cropEditMode, onCropEditModeChange }: Props) {
  const { viewMode } = useViewMode();
  const isAdminView = viewMode === 'admin';
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
            <BandeauConfigPanel
              value={bandeauConfig}
              onChange={onBandeauChange}
              projet={projet}
              onResetAll={() => {
                // Applique les preregages Assemblage UNIQUEMENT en memoire
                // (state React). Aucune ecriture Airtable a ce stade —
                // l'utilisateur doit cliquer sur "Sauvegarder la mise en
                // page" pour persister. La confirmation previent seulement
                // l'ecrasement accidentel des reglages courants.
                const confirmed = window.confirm(
                  'Appliquer les préréglages Assemblage ?\n\n'
                  + 'Le bandeau et la mise en page seront remplacés '
                  + 'en aperçu. Rien n’est encore sauvegardé : '
                  + 'clique sur « Sauvegarder la mise en page » pour valider.'
                );
                if (!confirmed) return;
                onBandeauChange(ASSEMBLAGE_DEFAULT_BANDEAU);
                onChange(ASSEMBLAGE_DEFAULT_MANUAL);
              }}
            />
          </div>
        );
      case 'main':     return <MainPhotoSection projet={projet} config={config} onChange={onChange} />;
      case 'text':     return <TextSection config={config} onChange={onChange} />;
      case 'extra':    return <ExtraPhotosSection projet={projet} config={config} onChange={onChange} />;
      case 'certifications': return <CertificationsSection projet={projet} config={config} onChange={onChange} />;
      case 'prestation': return <PrestationSection projet={projet} config={config} onChange={onChange} />;
      default:         return null;
    }
  }

  return (
    <div style={{ display: 'flex', alignSelf: 'stretch', flexShrink: 0 }}>
      {/* Navigation accordion */}
      <nav style={{ width: 170, background: 'white', borderRight: `1px solid ${color.gris}`, display: 'flex', flexDirection: 'column' }}>
        {/* Code affaire (champ Airtable "Affaire", fldjks1eYKuwqPtcs) en tête
            de nav, au-dessus de "Éditer les champs" — repère la fiche éditée. */}
        {projet.affaire && (
          <div style={{
            padding: '10px 14px', borderBottom: `1px solid ${color.gris}`,
            fontFamily: 'var(--sans)', fontSize: '8.5pt', fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'var(--ai-violet)', background: 'white',
            wordBreak: 'break-word',
          }}>
            {projet.affaire}
          </div>
        )}
        {/* Sélecteur Template (déplacé depuis la toolbar) — admin uniquement,
            à la suite du titre et avant « Éditer les champs ». Masqué en vue user. */}
        {isAdminView && template && onTemplateChange && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderBottom: `1px solid ${color.gris}`,
          }}>
            <span style={{
              fontFamily: 'var(--sans)', fontSize: '7.5pt', fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ai-noir70)',
            }}>Template</span>
            <select
              value={template}
              onChange={(e) => onTemplateChange(e.target.value as TemplateChoice)}
              style={{
                flex: 1, minWidth: 0, padding: '4px 6px', fontSize: '8.5pt',
                fontFamily: 'var(--sans)', fontWeight: 700, color: 'var(--ai-violet)',
                border: `1px solid ${color.gris}`, borderRadius: 2, background: 'white',
              }}
            >
              {TEMPLATE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}
        {/* Boutons d'édition (déplacés depuis la toolbar) */}
        <Link
          href={`/projet/${projet.slug}/edit`}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '11px 14px', textDecoration: 'none',
            border: 'none', borderBottom: `1px solid ${color.gris}`,
            borderLeft: '3px solid transparent',
            cursor: 'pointer',
            fontFamily: 'var(--sans)', fontSize: '7.5pt', fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'var(--ai-violet)', background: 'white',
          }}
        >
          ✎ Éditer les champs
        </Link>
        {onCropEditModeChange && (
          <button
            onClick={() => onCropEditModeChange(!cropEditMode)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '11px 14px',
              border: 'none', borderBottom: `1px solid ${color.gris}`,
              borderLeft: cropEditMode ? '3px solid var(--ai-rouge)' : '3px solid transparent',
              cursor: 'pointer',
              fontFamily: 'var(--sans)', fontSize: '7.5pt', fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              color: cropEditMode ? 'var(--ai-rouge)' : 'var(--ai-violet)',
              background: cropEditMode ? '#FFF5F5' : 'white',
            }}
          >
            {cropEditMode ? '✓ Terminer le recadrage' : '✂ Recadrer les photos'}
          </button>
        )}
        {visibleSections.map(s => (
          <button
            key={s.id}
            onClick={() => toggle(s.id)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '11px 14px',
              border: 'none', borderBottom: `1px solid ${color.gris}`,
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
              background: color.gris,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--ai-rouge)')}
            onMouseLeave={e => (e.currentTarget.style.background = color.gris)}
            title="Étirer le panneau"
          />
        </div>
      )}
    </div>
  );
}
