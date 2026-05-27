'use client';

import type {
  BandeauConfig, BandeauStyle, BandeauLinesStyle,
  FontFamilyChoice, TextAlignChoice, TextTransformChoice,
} from '@/lib/pdf/bandeauConfig';
import ColorSelector from './ColorSelector';

interface Props {
  value: BandeauConfig;
  onChange: (next: BandeauConfig) => void;
}

type StyleSectionKey = Exclude<keyof BandeauConfig, 'lines' | 'titleMetaGap' | 'photoTextGap'>;

const SECTIONS: { key: StyleSectionKey; label: string; help: string }[] = [
  { key: 'titre',       label: 'Titre de la fiche',           help: 'Le nom du projet (titre principal h1).' },
  { key: 'status',      label: 'Statut (en haut à droite)',   help: '"● Livré · 2025"' },
  { key: 'labels',      label: 'Libellés du bandeau',         help: '"Architecte", "Budget", "Surface"…' },
  { key: 'values',      label: 'Valeurs du bandeau',          help: '"Encore Heureux", "8,2 M€ HT", "4 242 m²"…' },
  { key: 'description', label: 'Description projet',          help: 'Le texte courant de la fiche (paragraphes Markdown). Appliqué sur tous les templates.' },
  { key: 'prestationAssemblage', label: 'Prestation Assemblage', help: 'Bloc rich text dédié, rendu uniquement par le template Dev (titre + valeur).' },
];

const LABEL_S: React.CSSProperties = {
  display: 'block', fontFamily: 'var(--sans)', fontSize: '7pt', fontWeight: 700,
  letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)',
  marginBottom: '4px',
};
const INPUT_S: React.CSSProperties = {
  width: '100%', fontFamily: 'var(--sans)', fontSize: '10pt',
  padding: '6px 8px', border: '1px solid #DFE4E8', borderRadius: '2px',
  background: 'white', outline: 'none',
};
const ROW: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  alignItems: 'center',
  marginBottom: '6px',
};
const COLOR_INPUT: React.CSSProperties = {
  width: '40px', height: '32px',
  padding: '2px',
  border: '1px solid #DFE4E8', borderRadius: '2px',
  background: 'white', cursor: 'pointer',
  flex: '0 0 40px',
};
const TOGGLE: React.CSSProperties = {
  padding: '4px 10px', border: '1px solid #DFE4E8', borderRadius: '2px',
  background: 'white', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: '10pt',
};
const TOGGLE_ON: React.CSSProperties = {
  ...TOGGLE,
  background: 'var(--ai-violet)', color: 'white', borderColor: 'var(--ai-violet)',
};

function StyleRow({ style, onChange }: { style: BandeauStyle; onChange: (s: BandeauStyle) => void }) {
  const set = <K extends keyof BandeauStyle>(k: K, v: BandeauStyle[K]) => onChange({ ...style, [k]: v });

  return (
    <div>
      <div style={ROW}>
        <select
          value={style.fontFamily ?? ''}
          onChange={(e) => set('fontFamily', (e.target.value || undefined) as FontFamilyChoice | undefined)}
          style={{ ...INPUT_S, width: 'auto', flex: '1 1 110px', minWidth: '110px' }}
        >
          <option value="">Police défaut</option>
          <option value="sans">Sans (Open Sans)</option>
          <option value="serif">Serif (Newsreader)</option>
        </select>
        <input
          type="number"
          step="0.5"
          min="6"
          max="24"
          value={style.fontSize ?? ''}
          onChange={(e) => set('fontSize', e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="Taille (pt)"
          style={{ ...INPUT_S, width: '90px', flex: '0 0 90px' }}
        />
        <div style={{ display: 'flex', gap: '4px', flex: '0 0 auto' }}>
          <button type="button" onClick={() => set('bold', !style.bold)} style={style.bold ? TOGGLE_ON : TOGGLE} title="Gras"><b>B</b></button>
          <button type="button" onClick={() => set('italic', !style.italic)} style={style.italic ? TOGGLE_ON : TOGGLE} title="Italique"><i>I</i></button>
          <button type="button" onClick={() => set('underline', !style.underline)} style={style.underline ? TOGGLE_ON : TOGGLE} title="Souligné"><u>U</u></button>
        </div>
        <div style={{ flex: '1 1 100%', display: 'grid', gridTemplateColumns: '36px 1fr', gap: '4px', alignItems: 'center', fontSize: '8pt', color: 'var(--ai-noir70)' }}>
          <span>Texte</span>
          <ColorSelector value={style.color} onChange={(c) => set('color', c)} customTitle="Couleur de texte personnalisée" />
          <span>Fond</span>
          <ColorSelector
            value={style.background}
            onChange={(c) => set('background', c)}
            fallback="#ffffff"
            customTitle="Couleur de surlignage personnalisée"
            allowNone
          />
        </div>
      </div>

      {/* Rangée typo fine : interligne, espacement lettres/mots, alignement, casse */}
      <div style={ROW}>
        <input
          type="number" step="0.05" min="0.8" max="2.5"
          value={style.lineHeight ?? ''}
          onChange={(e) => set('lineHeight', e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="Interligne"
          title="Interligne (line-height, sans unité). Ex. 1.15, 1.3, 1.5."
          style={{ ...INPUT_S, width: '100px', flex: '0 0 100px' }}
        />
        <input
          type="number" step="0.01" min="-0.1" max="0.4"
          value={style.letterSpacing ?? ''}
          onChange={(e) => set('letterSpacing', e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="Lettres (em)"
          title="Espacement entre lettres en em. Négatif resserre."
          style={{ ...INPUT_S, width: '110px', flex: '0 0 110px' }}
        />
        <input
          type="number" step="0.05" min="-0.2" max="1"
          value={style.wordSpacing ?? ''}
          onChange={(e) => set('wordSpacing', e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="Mots (em)"
          title="Espacement entre mots en em."
          style={{ ...INPUT_S, width: '100px', flex: '0 0 100px' }}
        />
        <select
          value={style.textAlign ?? ''}
          onChange={(e) => set('textAlign', (e.target.value || undefined) as TextAlignChoice | undefined)}
          title="Alignement du texte"
          style={{ ...INPUT_S, width: 'auto', flex: '1 1 110px', minWidth: '110px' }}
        >
          <option value="">Alignement défaut</option>
          <option value="left">Gauche</option>
          <option value="center">Centré</option>
          <option value="right">Droite</option>
          <option value="justify">Justifié</option>
        </select>
        <select
          value={style.textTransform ?? ''}
          onChange={(e) => set('textTransform', (e.target.value || undefined) as TextTransformChoice | undefined)}
          title="Transformation de casse"
          style={{ ...INPUT_S, width: 'auto', flex: '1 1 110px', minWidth: '110px' }}
        >
          <option value="">Casse défaut</option>
          <option value="none">Normale</option>
          <option value="uppercase">MAJUSCULES</option>
          <option value="lowercase">minuscules</option>
          <option value="capitalize">Initiales</option>
        </select>
      </div>

      {/* Rangée spacing : marges et paddings en mm */}
      <div style={ROW}>
        <input
          type="number" step="0.5" min="-20" max="40"
          value={style.marginTop ?? ''}
          onChange={(e) => set('marginTop', e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="Marge haut (mm)"
          title="Marge supérieure en mm. Peut être négative pour rapprocher."
          style={{ ...INPUT_S, width: '130px', flex: '0 0 130px' }}
        />
        <input
          type="number" step="0.5" min="-20" max="40"
          value={style.marginBottom ?? ''}
          onChange={(e) => set('marginBottom', e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="Marge bas (mm)"
          title="Marge inférieure en mm."
          style={{ ...INPUT_S, width: '130px', flex: '0 0 130px' }}
        />
        <input
          type="number" step="0.5" min="0" max="20"
          value={style.paddingX ?? ''}
          onChange={(e) => set('paddingX', e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="Padding X (mm)"
          title="Padding horizontal (gauche + droite) en mm. Utile avec un fond surligné."
          style={{ ...INPUT_S, width: '130px', flex: '0 0 130px' }}
        />
        <input
          type="number" step="0.5" min="0" max="20"
          value={style.paddingY ?? ''}
          onChange={(e) => set('paddingY', e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="Padding Y (mm)"
          title="Padding vertical (haut + bas) en mm."
          style={{ ...INPUT_S, width: '130px', flex: '0 0 130px' }}
        />
      </div>
    </div>
  );
}

export { StyleRow };

export default function BandeauConfigPanel({ value, onChange }: Props) {
  function updateSection(key: StyleSectionKey, style: BandeauStyle) {
    // Si toutes les propriétés sont vides, on retire la section pour garder
    // la config minimale et utiliser les défauts CSS du template.
    const isEmpty =
      !style.fontFamily &&
      style.fontSize === undefined &&
      !style.bold && !style.italic && !style.underline &&
      !style.color && !style.background &&
      style.lineHeight === undefined &&
      style.letterSpacing === undefined &&
      style.wordSpacing === undefined &&
      !style.textAlign && !style.textTransform &&
      style.marginTop === undefined &&
      style.marginBottom === undefined &&
      style.paddingX === undefined &&
      style.paddingY === undefined;
    const next = { ...value };
    if (isEmpty) {
      delete next[key];
    } else {
      next[key] = style;
    }
    onChange(next);
  }

  function resetAll() {
    onChange({});
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
        <p style={{ fontSize: '8pt', color: 'var(--ai-noir70)', margin: 0 }}>
          Surcharges optionnelles. Laisser vide pour utiliser les valeurs par défaut du template.
        </p>
        <button type="button" onClick={resetAll} style={{ ...TOGGLE, fontSize: '8pt' }}>
          Réinitialiser
        </button>
      </div>
      {SECTIONS.map((s) => (
        <div key={s.key} style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px dotted #DFE4E8' }}>
          <label style={LABEL_S}>{s.label}</label>
          <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', margin: '0 0 6px' }}>{s.help}</p>
          <StyleRow style={value[s.key] ?? {}} onChange={(st) => updateSection(s.key, st)} />
        </div>
      ))}
      <LinesRow value={value.lines ?? {}} onChange={(l) => onChange({ ...value, lines: l })} />
      <TitleMetaGapRow
        value={value.titleMetaGap}
        onChange={(v) => {
          const next = { ...value };
          if (v === undefined || v === 50) delete next.titleMetaGap;
          else next.titleMetaGap = v;
          onChange(next);
        }}
      />
      <PhotoTextGapRow
        value={value.photoTextGap}
        onChange={(v) => {
          const next = { ...value };
          if (v === undefined || v === 50) delete next.photoTextGap;
          else next.photoTextGap = v;
          onChange(next);
        }}
      />
    </div>
  );
}

function PhotoTextGapRow({ value, onChange }: { value: number | undefined; onChange: (v: number | undefined) => void }) {
  const v = value ?? 50;
  return (
    <div style={{ marginBottom: '14px', paddingBottom: '14px' }}>
      <label style={LABEL_S}>Espacement photo ↔ description</label>
      <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', margin: '0 0 6px' }}>
        Rapproche ou éloigne le bloc Description projet de la photo principale. 50 = défaut, &lt; 50 = rapproché, &gt; 50 = éloigné. Appliqué sur Str-Env et Dev.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <input
          type="range"
          min={0} max={100} step={5}
          value={v}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: '1 1 160px', accentColor: '#E30513' }}
        />
        <input
          type="number"
          min={0} max={100} step={1}
          value={v}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.max(0, Math.min(100, n)));
          }}
          style={{ ...INPUT_S, width: '70px', flex: '0 0 70px', textAlign: 'right' }}
        />
        <button type="button" onClick={() => onChange(undefined)} style={{ ...TOGGLE, fontSize: '8pt' }} title="Réinitialiser à la valeur par défaut">
          Reset
        </button>
      </div>
    </div>
  );
}

function TitleMetaGapRow({ value, onChange }: { value: number | undefined; onChange: (v: number | undefined) => void }) {
  const v = value ?? 50;
  return (
    <div style={{ marginBottom: '14px', paddingBottom: '14px' }}>
      <label style={LABEL_S}>Espacement titre ↔ bandeau</label>
      <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', margin: '0 0 6px' }}>
        Rapproche ou éloigne le bandeau métadonnées du titre. 50 = défaut, &lt; 50 = rapproché, &gt; 50 = éloigné. Appliqué sur les 4 templates.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <input
          type="range"
          min={0} max={100} step={5}
          value={v}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: '1 1 160px', accentColor: '#E30513' }}
        />
        <input
          type="number"
          min={0} max={100} step={1}
          value={v}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.max(0, Math.min(100, n)));
          }}
          style={{ ...INPUT_S, width: '70px', flex: '0 0 70px', textAlign: 'right' }}
        />
        <button type="button" onClick={() => onChange(undefined)} style={{ ...TOGGLE, fontSize: '8pt' }} title="Réinitialiser à la valeur par défaut">
          Reset
        </button>
      </div>
    </div>
  );
}

function LinesRow({ value, onChange }: { value: BandeauLinesStyle; onChange: (v: BandeauLinesStyle) => void }) {
  // Convention : `show` non défini = visible par défaut. Le toggle bascule
  // explicitement vers false / true (jamais undefined) pour que l'intention
  // de l'utilisateur soit persistée.
  const visible = value.show !== false;
  return (
    <div style={{ marginBottom: '14px', paddingBottom: '14px' }}>
      <label style={LABEL_S}>Lignes horizontales du bandeau</label>
      <p style={{ fontSize: '7pt', color: 'var(--ai-noir70)', margin: '0 0 6px' }}>
        Les deux traits qui encadrent le bandeau métadonnées (au-dessus de Maître d&apos;ouvrage et sous le bandeau).
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => onChange({ ...value, show: !visible })}
          style={visible ? TOGGLE_ON : TOGGLE}
          title={visible ? 'Masquer les lignes' : 'Afficher les lignes'}
        >
          {visible ? '✓ Affichées' : '✕ Masquées'}
        </button>
        <input
          type="number"
          step="0.5"
          min="0.25"
          max="6"
          value={value.width ?? ''}
          onChange={(e) => onChange({ ...value, width: e.target.value === '' ? undefined : Number(e.target.value) })}
          placeholder="Épaisseur (pt)"
          disabled={!visible}
          style={{ ...INPUT_S, width: '110px', flex: '0 0 110px', opacity: visible ? 1 : 0.4 }}
        />
        <div style={{ flex: '1 1 100%' }}>
          <ColorSelector
            value={value.color}
            onChange={(c) => onChange({ ...value, color: c })}
            disabled={!visible}
            customTitle="Couleur de ligne personnalisée"
          />
        </div>
      </div>
    </div>
  );
}
