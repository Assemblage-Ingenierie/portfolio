'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Composant générique de saisie multi-select.
 * - Affiche les valeurs courantes sous forme de chips (avec × pour retirer)
 * - Dropdown des options disponibles (filtrable par saisie)
 * - Permet d'ajouter une valeur libre via Entrée (typecast Airtable la crée
 *   automatiquement comme nouvelle option)
 *
 * Les options sont fournies par le parent — typiquement via fetch d'une route
 * d'API qui consulte la metadata Airtable.
 */

interface Props {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  options: string[];
  /** Texte placeholder pour l'input de saisie. */
  placeholder?: string;
  /** Si `true`, l'utilisateur ne peut sélectionner qu'une seule valeur (single-select). */
  single?: boolean;
  /** Sous-titre d'aide affiché sous le champ. */
  hint?: string;
  /** Si `true`, le composant est désactivé (lecture seule visuelle). */
  disabled?: boolean;
}

const LABEL: React.CSSProperties = {
  display: 'block', fontFamily: 'var(--sans)', fontSize: '7pt', fontWeight: 700,
  letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-noir70)',
  marginBottom: '4px',
};

const BOX: React.CSSProperties = {
  position: 'relative',
  border: '1px solid #DFE4E8', borderRadius: '2px', background: 'white',
  padding: '4px 6px', minHeight: '34px',
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px',
  fontFamily: 'var(--sans)', fontSize: '10pt',
};

const CHIP: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  background: '#F2F2F2', color: 'var(--ai-noir)',
  border: '1px solid #DFE4E8', borderRadius: '2px',
  padding: '2px 6px 2px 8px', fontSize: '9pt', lineHeight: 1.3,
};

const CHIP_X: React.CSSProperties = {
  border: 'none', background: 'transparent', cursor: 'pointer',
  color: 'var(--ai-noir70)', fontSize: '11pt', padding: '0 2px', lineHeight: 1,
};

const TEXT_INPUT: React.CSSProperties = {
  border: 'none', outline: 'none', background: 'transparent',
  flex: '1 1 80px', minWidth: '80px',
  fontFamily: 'var(--sans)', fontSize: '10pt',
  padding: '4px 2px',
};

const DROPDOWN: React.CSSProperties = {
  position: 'absolute', left: 0, right: 0, top: '100%',
  marginTop: '2px',
  background: 'white', border: '1px solid #DFE4E8', borderRadius: '2px',
  boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
  maxHeight: '220px', overflowY: 'auto',
  zIndex: 20,
};

const OPTION: React.CSSProperties = {
  padding: '6px 10px', cursor: 'pointer',
  fontFamily: 'var(--sans)', fontSize: '9.5pt',
};

const HINT: React.CSSProperties = {
  fontSize: '7pt', color: 'var(--ai-noir70)', marginTop: '4px',
};

export default function MultiSelectField({
  label, values, onChange, options, placeholder, single, hint, disabled,
}: Props) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Ferme le dropdown au clic à l'extérieur.
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  function addValue(v: string) {
    const trimmed = v.trim();
    if (!trimmed) return;
    if (values.includes(trimmed)) return; // pas de doublon
    if (single) {
      onChange([trimmed]);
    } else {
      onChange([...values, trimmed]);
    }
    setInput('');
  }

  function removeValue(v: string) {
    onChange(values.filter(x => x !== v));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (input.trim()) addValue(input);
    } else if (e.key === 'Backspace' && !input && values.length > 0) {
      // Backspace sur input vide → retire la dernière chip
      removeValue(values[values.length - 1]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  // Filtre les options : exclut celles déjà sélectionnées, applique la
  // saisie courante (case-insensitive substring).
  const inputLower = input.trim().toLowerCase();
  const filteredOptions = options
    .filter(o => !values.includes(o))
    .filter(o => !inputLower || o.toLowerCase().includes(inputLower));

  // Pour single-select : si une valeur est déjà sélectionnée, on offre quand
  // même la possibilité de la remplacer en cliquant sur une autre option.
  const showCreateHint = inputLower && !options.some(o => o.toLowerCase() === inputLower);

  return (
    <div>
      <label style={LABEL}>{label}</label>
      <div
        ref={boxRef}
        style={{
          ...BOX,
          background: disabled ? '#F2F2F2' : 'white',
          cursor: disabled ? 'not-allowed' : 'text',
        }}
        onClick={() => { if (!disabled) setOpen(true); }}
      >
        {values.map(v => (
          <span key={v} style={CHIP}>
            {v}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeValue(v); }}
                style={CHIP_X}
                aria-label={`Retirer ${v}`}
                title={`Retirer ${v}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); if (!open) setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={values.length === 0 ? (placeholder ?? 'Choisir ou taper une valeur…') : ''}
            style={TEXT_INPUT}
          />
        )}

        {open && !disabled && (
          <div style={DROPDOWN}>
            {filteredOptions.length === 0 && !showCreateHint && (
              <div style={{ ...OPTION, color: 'var(--ai-noir70)', fontStyle: 'italic', cursor: 'default' }}>
                Aucune option disponible
              </div>
            )}
            {filteredOptions.map(opt => (
              <div
                key={opt}
                onClick={(e) => { e.stopPropagation(); addValue(opt); setOpen(false); }}
                style={OPTION}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F2F2F2')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
              >
                {opt}
              </div>
            ))}
            {showCreateHint && (
              <div
                onClick={(e) => { e.stopPropagation(); addValue(input); setOpen(false); }}
                style={{ ...OPTION, borderTop: filteredOptions.length > 0 ? '1px solid #DFE4E8' : 'none' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F9E1E3')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
              >
                <span style={{ color: 'var(--ai-rouge)', fontWeight: 600 }}>+ Créer</span>
                <span style={{ marginLeft: 6 }}>{`« ${input.trim()} »`}</span>
              </div>
            )}
          </div>
        )}
      </div>
      {hint && <p style={HINT}>{hint}</p>}
    </div>
  );
}
