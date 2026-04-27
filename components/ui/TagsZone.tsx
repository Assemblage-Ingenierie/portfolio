import type { Projet } from '@/types/projet';

interface Props {
  projet: Pick<Projet, 'certifications' | 'materiaux' | 'motsCles' | 'tagsSiteWeb'>;
  variant?: 'editorial' | 'magazine';
}

const tagCertStyle: React.CSSProperties = {
  fontFamily: "var(--sans)", fontSize: '7.5pt', fontWeight: 600,
  padding: '0.8mm 2.5mm', background: 'var(--ai-violet)', color: 'white',
  borderRadius: '1mm', lineHeight: '1.3', whiteSpace: 'nowrap',
};
const tagMatStyle: React.CSSProperties = {
  fontFamily: "var(--sans)", fontSize: '7.5pt', fontWeight: 600,
  padding: '0.8mm 2.5mm', background: 'var(--ai-gris)', color: 'var(--ai-noir)',
  borderRadius: '1mm', lineHeight: '1.3', whiteSpace: 'nowrap',
};
const tagMcStyle: React.CSSProperties = {
  fontFamily: "var(--sans)", fontSize: '7.5pt', fontWeight: 400,
  padding: '0.8mm 2.5mm', background: 'transparent', color: 'var(--ai-noir70)',
  border: '1px solid var(--ai-gris)', borderRadius: '1mm', lineHeight: '1.3',
  whiteSpace: 'nowrap', fontStyle: 'italic',
};
const groupLabelStyle: React.CSSProperties = {
  fontFamily: "var(--sans)", fontSize: '6.5pt', fontWeight: 700,
  letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ai-noir70)',
  marginRight: '1mm',
};

export default function TagsZone({ projet, variant = 'editorial' }: Props) {
  const { certifications, materiaux, motsCles, tagsSiteWeb } = projet;
  const hasContent = certifications.length > 0 || materiaux.length > 0 || motsCles.length > 0 || tagsSiteWeb.length > 0;

  if (!hasContent) return null;

  const containerStyle: React.CSSProperties = variant === 'magazine'
    ? { padding: '4mm 18mm', background: 'var(--ai-gris-tres-clair)', display: 'flex', flexWrap: 'wrap', gap: '3mm 5mm', alignItems: 'flex-start' }
    : { display: 'flex', flexWrap: 'wrap', gap: '3mm 5mm', alignItems: 'flex-start', padding: '3mm 0 0 0', borderTop: '1px dotted var(--ai-gris)' };

  const tagStyle: React.CSSProperties = variant === 'magazine'
    ? { ...tagMatStyle, background: 'white' }
    : tagMatStyle;

  return (
    <div style={containerStyle}>
      {certifications.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.5mm' }}>
          <span style={groupLabelStyle}>Certification</span>
          {certifications.map((c) => <span key={c} style={tagCertStyle}>{c}</span>)}
        </div>
      )}
      {materiaux.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.5mm' }}>
          <span style={groupLabelStyle}>Matériaux</span>
          {materiaux.map((m) => <span key={m} style={tagStyle}>{m}</span>)}
        </div>
      )}
      {tagsSiteWeb.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.5mm' }}>
          <span style={groupLabelStyle}>Mots-clés</span>
          {tagsSiteWeb.map((t) => <span key={t} style={tagMcStyle}>{t}</span>)}
        </div>
      )}
      {motsCles.length > 0 && motsCles !== tagsSiteWeb && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.5mm' }}>
          {tagsSiteWeb.length === 0 && <span style={groupLabelStyle}>Mots-clés</span>}
          {motsCles.map((m) => <span key={m} style={tagMcStyle}>{m}</span>)}
        </div>
      )}
    </div>
  );
}
