'use client';

/**
 * Palette de couleurs Assemblage + sélecteur personnalisé. Utilisé partout
 * où l'utilisateur choisit une couleur (texte, fond, lignes du bandeau…).
 *
 * Les 5 couleurs préréglées correspondent à la charte interne (cf. tokens
 * CSS dans styles/tokens.css). L'input type="color" reste disponible pour
 * une couleur arbitraire.
 */

export interface ColorPreset {
  name: string;
  value: string;
}

export const COLOR_PRESETS: ReadonlyArray<ColorPreset> = [
  { name: 'Rouge principal',   value: '#E30513' },
  { name: 'Rouge clair',       value: '#F9E1E3' },
  { name: 'Violet sombre',     value: '#30323E' },
  { name: 'Gris clair',        value: '#DFE4E8' },
  { name: 'Gris très clair',   value: '#F2F2F2' },
];

interface Props {
  value: string | undefined;
  onChange: (color: string) => void;
  /** Valeur affichée dans le picker quand `value` est undefined. */
  fallback?: string;
  disabled?: boolean;
  /** Titre du picker personnalisé (HTML title attr). */
  customTitle?: string;
}

const SWATCH: React.CSSProperties = {
  width: '16px',
  height: '20px',
  padding: 0,
  border: '1px solid #DFE4E8',
  borderRadius: '2px',
  cursor: 'pointer',
  flex: '0 0 16px',
};
const SWATCH_ACTIVE: React.CSSProperties = {
  ...SWATCH,
  border: '2px solid var(--ai-violet)',
  outline: '1px solid white',
  outlineOffset: '-2px',
};
const CUSTOM_PICKER: React.CSSProperties = {
  width: '28px',
  height: '20px',
  padding: '1px',
  border: '1px solid #DFE4E8',
  borderRadius: '2px',
  cursor: 'pointer',
  background: 'white',
  flex: '0 0 28px',
};

function isPreset(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return COLOR_PRESETS.some((p) => p.value.toLowerCase() === v);
}

export default function ColorSelector({ value, onChange, fallback = '#000000', disabled, customTitle }: Props) {
  const lower = value?.toLowerCase();
  const valueIsCustom = !!value && !isPreset(value);

  return (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flexWrap: 'wrap', opacity: disabled ? 0.4 : 1 }}>
      {COLOR_PRESETS.map((p) => {
        const active = lower === p.value.toLowerCase();
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => !disabled && onChange(p.value)}
            disabled={disabled}
            title={`${p.name} (${p.value})`}
            aria-label={p.name}
            style={{ ...(active ? SWATCH_ACTIVE : SWATCH), background: p.value, cursor: disabled ? 'not-allowed' : 'pointer' }}
          />
        );
      })}
      <input
        type="color"
        value={value ?? fallback}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        title={customTitle ?? 'Couleur personnalisée'}
        style={{
          ...CUSTOM_PICKER,
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: valueIsCustom ? '2px solid var(--ai-violet)' : undefined,
        }}
      />
    </div>
  );
}
