'use client';

import type { BandeauConfig, BandeauStyle, BandeauLinesStyle, FontFamilyChoice } from '@/lib/pdf/bandeauConfig';
import ColorSelector from './ColorSelector';

interface Props {
  value: BandeauConfig;
  onChange: (next: BandeauConfig) => void;
}

const SECTIONS: { key: keyof BandeauConfig; label: string; help: string }[] = [
  { key: 'titre',  label: 'Titre de la fiche',           help: 'Le nom du projet (titre principal h1).' },
  { key: 'status', label: 'Statut (en haut à droite)',   help: '"● Livré · 2025"' },
  { key: 'labels', label: 'Libellés du bandeau',         help: '"Architecte", "Budget", "Surface"…' },
  { key: 'values', label: 'Valeurs du bandeau',          help: '"Encore Heureux", "8,2 M€ HT", "4 242 m²"…' },
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
    </div>
  );
}

export { StyleRow };

export default function BandeauConfigPanel({ value, onChange }: Props) {
  function updateSection(key: keyof BandeauConfig, style: BandeauStyle) {
    // Si toutes les propriétés sont vides, on retire la section pour garder
    // la config minimale et utiliser les défauts CSS du template.
    const isEmpty =
      !style.fontFamily &&
      style.fontSize === undefined &&
      !style.bold && !style.italic && !style.underline &&
      !style.color && !style.background;
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
