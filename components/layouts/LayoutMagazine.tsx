import type { Projet } from '@/types/projet';
import TagsZone from '@/components/blocks/TagsZone';
import s from '@/styles/layout-magazine.module.css';

interface Props {
  projet: Projet;
  overrides?: Partial<Pick<Projet, 'pitch' | 'description' | 'chiffresCles'>>;
}

function InfoItem({ label, value, sub }: { label: string; value?: string | number; sub?: string }) {
  if (!value && value !== 0) return null;
  return (
    <div className={s.infoItem}>
      <span className={s.infoLabel}>{label}</span>
      <div className={s.infoValue}>{String(value)}</div>
      {sub && <div className={s.infoValueSub}>{sub}</div>}
    </div>
  );
}

export default function LayoutMagazine({ projet, overrides }: Props) {
  const pitch = overrides?.pitch ?? projet.pitch;
  const description = overrides?.description ?? projet.description;
  const chiffresCles = overrides?.chiffresCles ?? projet.chiffresCles;

  const hasPhotos = !!projet.photoCouverture || (projet.photosProjet && projet.photosProjet.length > 0);
  const heroStyle = projet.photoCouverture
    ? { backgroundImage: `url(${projet.photoCouverture.url})` }
    : {};

  const secondaireFields = [
    { label: 'Pôle', value: projet.pole },
    { label: 'Département', value: projet.departement },
    { label: 'Programme', value: projet.programme },
    { label: 'Rehab / Neuf', value: projet.rehabNeuf },
    { label: 'Mandataire', value: projet.mandataire },
    { label: 'BET associés', value: projet.betAssocies },
    { label: 'Entreprise', value: projet.entreprise },
    { label: 'Bailleur', value: projet.bailleur },
  ].filter((f) => !!f.value);

  const paragraphs = description.split(/\n\n+/).filter(Boolean);

  const badge = [projet.programme, projet.pole].filter(Boolean).join(' · ');

  return (
    <article className={s.page}>
      <header className={s.hero} style={heroStyle}>
        <div className={s.heroOverlay} />
        <div className={s.heroMarque}>
          Assemblage ingénierie · <span className={s.heroMarqueSigle}>.A</span>
        </div>
        <div className={s.heroContent}>
          {badge && <span className={s.badge}>{badge}</span>}
          <h1 className={s.heroH1}>{projet.nom}</h1>
          {projet.adresse && <div className={s.heroLieu}>{projet.adresse}</div>}
        </div>
      </header>

      <div className={s.corps}>
        <aside className={s.sidebar}>
          {pitch && <p className={s.sidebarPitch}>{pitch}</p>}

          <InfoItem label="Maître d'ouvrage" value={projet.moa} />
          <InfoItem label="Mission" value={projet.missionAi} sub="Assemblage ingénierie" />
          <InfoItem label="Budget travaux" value={projet.budgetHT} />
          <InfoItem
            label="Calendrier"
            value={projet.anneeLivraison ? `${projet.anneeLivraison}` : undefined}
            sub={projet.surface ? `${projet.surface.toLocaleString('fr-FR')} m²` : undefined}
          />

          {secondaireFields.length > 0 && (
            <div className={s.infoSecondaire}>
              {secondaireFields.map((f) => (
                <div key={f.label} className={s.infoItem}>
                  <span className={s.infoLabel}>{f.label}</span>
                  <div className={s.infoValue}>{f.value}</div>
                </div>
              ))}
            </div>
          )}

          {chiffresCles && chiffresCles.length > 0 && (
            <div className={s.chiffres}>
              {chiffresCles.map((c, i) => (
                <div key={i} className={s.grosChiffre}>
                  <div className={s.nombre}>{c.valeur}</div>
                  <div className={s.legende}>{c.label}</div>
                </div>
              ))}
            </div>
          )}
        </aside>

        <main className={s.principal}>
          <h2 className={s.principalH2}>{projet.nom}</h2>
          <div className={s.articleText}>
            {paragraphs.map((para, i) => (
              <p key={i} className={`${s.articleP} ${i === 0 ? s.intro : ''}`}>{para}</p>
            ))}
          </div>

          {hasPhotos && projet.photosProjet && projet.photosProjet.length > 0 && (
            <div className={s.galerie}>
              {projet.photosProjet.slice(0, 3).map((photo, i) => (
                <div
                  key={i}
                  className={s.galeriePhoto}
                  style={{ backgroundImage: `url(${photo.url})` }}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <TagsZone projet={projet} variant="magazine" />

      <footer className={s.footer}>
        <span className={s.footerSigle}>.A</span>
        <div className={s.footerLegal}>
          <strong>Assemblage ingénierie</strong> S.A.S · 137 rue d&apos;Aboukir, 75002 Paris · contact@assemblage.net
        </div>
        <div className={s.footerRef}>{projet.affaire}</div>
      </footer>
    </article>
  );
}
