'use client';

import { color } from '@/lib/ui/tokens';

/**
 * Double-slider d'intervalle (min / max), partagé entre les pages portfolio.
 * Styles dans `app/globals.css` sous la classe `.range-slider`.
 */
export function RangeSlider({
  min, max, valueMin, valueMax, onChange, minWidth = 180,
}: {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  onChange: (min: number, max: number) => void;
  minWidth?: number;
}) {
  const range = max - min || 1;
  const pctLeft = ((valueMin - min) / range) * 100;
  const pctRight = ((max - valueMax) / range) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', fontWeight: 700, color: color.rouge }}>
        <span>{valueMin}</span><span>{valueMax}</span>
      </div>
      <div className="range-slider">
        <div style={{
          position: 'absolute', top: '50%', left: 0, right: 0,
          height: '4px', background: color.gris, borderRadius: '2px',
          transform: 'translateY(-50%)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '50%',
          left: `${pctLeft}%`, right: `${pctRight}%`,
          height: '4px', background: color.rouge, borderRadius: '2px',
          transform: 'translateY(-50%)', pointerEvents: 'none',
        }} />
        <input
          type="range" min={min} max={max} value={valueMin}
          style={{ zIndex: valueMin >= valueMax ? 3 : 1 }}
          onChange={e => onChange(Math.min(Number(e.target.value), valueMax), valueMax)}
        />
        <input
          type="range" min={min} max={max} value={valueMax}
          style={{ zIndex: valueMin >= valueMax ? 2 : 3 }}
          onChange={e => onChange(valueMin, Math.max(Number(e.target.value), valueMin))}
        />
      </div>
    </div>
  );
}
