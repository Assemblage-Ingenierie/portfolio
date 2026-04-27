import type { Projet } from '@/types/projet';
import TagsZone from '@/components/ui/TagsZone';
import s from '@/styles/layout-editorial.module.css';

interface Props {
  projet: Projet;
  overrides?: Partial<Pick<Projet, 'pitch' | 'description' | 'chiffresCles'>>;
}

function InfoItem({ label, value, sub }: { label: string; value?: string | number; sub?: string }) {
  if (!value && value !== 0) return null;
  return (
    <div className={s.infoItem}>
      <span className={s.infoLabel}>{label}</span>
      <div className={s.infoValue}>{value}</div>
      {sub && <div className={s.infoValueSub}>{sub}</div>}
    </div>
  );
}

function SecItem({ label, value }: { label: string; value?: string | number }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <span className={s.infoSecLabel}>{label}</span>
      <div className={s.infoSecValue}>{String(value)}</div>
    </div>
  );
}

export default function LayoutEditorial({ projet, overrides }: Props) {
  const pitch = overrides?.pitch ?? projet.pitch;
  const description = overrides?.description ?? projet.description;
  const chiffresCles = overrides?.chiffresCles ?? projet.chiffresCles;

  const hasPhotos = !!projet.photoCouverture || (projet.photosProjet && projet.photosProjet.length > 0);

  const allPhotos = [
    projet.photoCouverture,
    ...(projet.photosProjet ?? []),
  ].filter(Boolean) as { url: string; filename: string }[];

  const hasSecondaire = !!(
    projet.pole || projet.departement || projet.programme || projet.rehabNeuf ||
    projet.mandataire || projet.betAssocies || projet.entreprise || projet.bailleur
  );

  const paragraphs = description.split(/\n\n+/).filter(Boolean);

  return (
    <article className={s.page}>
      <header className={s.header}>
        <div className={s.headerMeta}>Assemblage ingénierie · Référence Projet</div>
        <div className={s.headerStatut}>● {projet.statut}</div>
      </header>

      <div className={s.titreBloc}>
        {projet.adresse && <div className={s.surtitre}>{projet.adresse}</div>}
        <h1 className={s.h1}>{projet.nom}</h1>
        {pitch && <p className={s.pitch}>{pitch}</p>}
      </div>

      <div className={s.infoGrid}>
        <InfoItem label="Maître d'ouvrage" value={projet.moa} />
        <InfoItem label="Architecte" value={projet.architecte} />
        <InfoItem
          label="Budget · Surface"
          value={projet.budgetHT}
          sub={projet.surface ? `${projet.surface.toLocaleString('fr-FR')} m²` : undefined}
        />
        <InfoItem
          label="Calendrier"
          value={projet.anneeLivraison}
          sub={projet.missionAi ?? undefined}
        />
      </div>

      {hasSecondaire && (
        <div className={s.infoSecondaire}>
          <SecItem label="Pôle" value={projet.pole} />
          <SecItem label="Département" value={projet.departement} />
          <SecItem label="Programme" value={projet.programme} />
          <SecItem label="Rehab / Neuf" value={projet.rehabNeuf} />
          <SecItem label="Mandataire" value={projet.mandataire} />
          <SecItem label="BET associés" value={projet.betAssocies} />
          <SecItem label="Entreprise" value={projet.entreprise} />
          <SecItem label="Bailleur" value={projet.bailleur} />
        </div>
      )}

      <div className={`${s.contenu} ${!hasPhotos ? s.contenuNoPhotos : ''}`}>
        <div className={s.texte}>
          {paragraphs.map((para, i) => (
            <p key={i} className={`${s.texteP} ${i === 0 ? s.lettrine : ''}`}>{para}</p>
          ))}

          {chiffresCles && chiffresCles.length > 0 && (
            <div style={{ borderTop: '1px solid var(--ai-rouge)', paddingTop: '2.5mm', marginTop: '2mm' }}>
              <h3 style={{ fontFamily: 'var(--sans)', fontSize: '8pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai-rouge)', marginBottom: '1.5mm' }}>
                Chiffres clés
              </h3>
              <ul style={{ listStyle: 'none' }}>
                {chiffresCles.map((c, i) => (
                  <li key={i} style={{ fontFamily: 'var(--sans)', fontSize: '8.5pt', lineHeight: '1.4', padding: '0.8mm 0', borderBottom: '1px dotted var(--ai-gris)', display: 'flex', justifyContent: 'space-between' }}>
                    {c.label} <strong style={{ fontFamily: 'var(--serif)', fontWeight: 600 }}>{c.valeur}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {hasPhotos && (
          <div className={s.photos}>
            {allPhotos[0] && (
              <div className={`${s.photo} ${s.photo1}`} style={{ backgroundImage: `url(${allPhotos[0].url})` }} />
            )}
            {allPhotos[1] && (
              <div className={`${s.photo} ${s.photo2}`} style={{ backgroundImage: `url(${allPhotos[1].url})` }} />
            )}
            {allPhotos[2] && (
              <div className={`${s.photo} ${s.photo3}`} style={{ backgroundImage: `url(${allPhotos[2].url})` }} />
            )}
            {allPhotos[3] && (
              <div className={`${s.photo} ${s.photo4}`} style={{ backgroundImage: `url(${allPhotos[3].url})` }} />
            )}
          </div>
        )}
      </div>

      <TagsZone projet={projet} variant="editorial" />

      <footer className={s.footer}>
        <span className={s.footerSigle}>.A</span>
        <div className={s.footerLegal}>
          <strong>Assemblage ingénierie</strong> S.A.S · 137 rue d&apos;Aboukir, 75002 Paris · contact@assemblage.net · assemblage.net
        </div>
        <div className={s.footerRef}>{projet.affaire}</div>
      </footer>
    </article>
  );
}
