import { NextRequest, NextResponse } from 'next/server';
import { getProjet, updateProjetUrl } from '@/lib/airtable';
import { uploadMedia, createOrUpdatePost, extractWpPostId } from '@/lib/wordpress';
import type { Projet } from '@/types/projet';

const ROUGE  = '#E30513';
const VIOLET = '#30323E';
const GRIS   = '#DFE4E8';
const NOIR70 = '#4D4D4D';
const SERIF  = 'Georgia, serif';
const SANS   = "'Open Sans', system-ui, sans-serif";

function infoItem(label: string, value?: string | number, sub?: string): string {
  if (!value && value !== 0) return '';
  return `
    <div style="margin-bottom:10px;">
      <span style="display:block;font-family:${SANS};font-size:9px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${NOIR70};margin-bottom:2px;">${label}</span>
      <div style="font-family:${SERIF};font-size:13px;font-weight:600;line-height:1.2;color:#000;">${value}</div>
      ${sub ? `<div style="font-family:${SANS};font-size:10px;color:${NOIR70};margin-top:2px;">${sub}</div>` : ''}
    </div>`;
}

function buildWpMagazine(projet: Projet, coverUrl: string | undefined, photoUrls: string[]): string {
  const pitch = projet.pitch ?? '';
  const description = projet.description ?? '';
  const paragraphs = description.split(/\n\n+/).filter(Boolean);
  const badge = [projet.programme, projet.pole].filter(Boolean).join(' · ');
  const chiffresCles = projet.chiffresCles ?? [];

  const heroStyle = coverUrl
    ? `background-image:url(${coverUrl});background-size:cover;background-position:center;`
    : `background-color:${VIOLET};`;

  const galerie = photoUrls.length > 0
    ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:16px;height:120px;">
        ${photoUrls.slice(0, 3).map(u =>
          `<div style="background-image:url(${u});background-size:cover;background-position:center;background-color:${GRIS};"></div>`
        ).join('')}
      </div>`
    : '';

  const secondaire = [
    { label: 'Pôle', value: projet.pole },
    { label: 'Département', value: projet.departement },
    { label: 'Programme', value: projet.programme },
    { label: 'Rehab / Neuf', value: projet.rehabNeuf },
    { label: 'Mandataire', value: projet.mandataire },
    { label: 'BET associés', value: projet.betAssocies },
    { label: 'Entreprise', value: projet.entreprise },
    { label: 'Bailleur', value: projet.bailleur },
  ].filter(f => !!f.value);

  return `
<div style="font-family:${SANS};max-width:900px;margin:0 auto;background:white;">

  <!-- Hero -->
  <div style="position:relative;height:300px;${heroStyle}overflow:hidden;">
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(48,50,62,0.78) 100%);"></div>
    <div style="position:absolute;top:14px;right:28px;font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:white;z-index:2;">
      Assemblage ingénierie · <span style="color:${ROUGE};font-family:${SERIF};font-weight:700;font-size:14px;">.A</span>
    </div>
    <div style="position:absolute;bottom:0;left:0;right:0;padding:20px 28px;z-index:2;">
      ${badge ? `<div style="display:inline-block;background:${ROUGE};color:white;padding:2px 10px;font-family:${SANS};font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">${badge}</div>` : ''}
      <h1 style="font-family:${SERIF};font-size:34px;font-weight:400;line-height:1;letter-spacing:-0.02em;color:white;margin:0 0 6px;">${projet.nom}</h1>
      ${projet.adresse ? `<div style="font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.85);">${projet.adresse}</div>` : ''}
    </div>
  </div>

  <!-- Corps -->
  <div style="display:grid;grid-template-columns:220px 1fr;gap:0;padding:28px;">

    <!-- Sidebar -->
    <div style="border-right:1px solid ${GRIS};padding-right:24px;">
      ${pitch ? `<p style="font-family:${SERIF};font-size:14px;font-style:italic;line-height:1.4;color:${VIOLET};margin:0 0 14px;padding-bottom:14px;border-bottom:2px solid ${ROUGE};">${pitch}</p>` : ''}
      ${infoItem("Maître d'ouvrage", projet.moa)}
      ${infoItem('Mission', projet.missionAi, 'Assemblage ingénierie')}
      ${infoItem('Budget travaux', projet.budgetHT)}
      ${infoItem('Calendrier', projet.anneeLivraison, projet.surface ? `${projet.surface.toLocaleString('fr-FR')} m²` : undefined)}
      ${secondaire.length > 0 ? `
        <div style="margin-top:14px;padding-top:14px;border-top:1px dotted ${GRIS};">
          ${secondaire.map(f => infoItem(f.label, f.value)).join('')}
        </div>` : ''}
      ${chiffresCles.length > 0 ? `
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid ${GRIS};">
          ${chiffresCles.map(c => `
            <div style="margin-bottom:10px;">
              <div style="font-family:${SERIF};font-size:28px;font-weight:600;line-height:1;color:${VIOLET};letter-spacing:-0.02em;">${c.valeur}</div>
              <div style="font-family:${SANS};font-size:8px;font-weight:600;color:${NOIR70};letter-spacing:0.05em;text-transform:uppercase;margin-top:2px;">${c.label}</div>
            </div>`).join('')}
        </div>` : ''}
    </div>

    <!-- Principal -->
    <div style="padding-left:24px;">
      <h2 style="font-family:${SERIF};font-size:22px;font-weight:500;line-height:1.1;color:#000;letter-spacing:-0.01em;margin:0 0 16px;">${projet.nom}</h2>
      <div style="columns:2;column-gap:16px;column-rule:1px solid ${GRIS};">
        ${paragraphs.map((p, i) => `<p style="font-family:${SANS};font-size:11px;line-height:1.5;color:#000;margin-bottom:8px;${i === 0 ? 'break-inside:avoid;' : ''}">${p}</p>`).join('')}
      </div>
      ${galerie}
    </div>

  </div>

  <!-- Footer -->
  <div style="background:${VIOLET};color:white;padding:10px 28px;display:flex;justify-content:space-between;align-items:center;font-family:${SANS};font-size:9px;">
    <span style="font-family:${SERIF};font-size:16px;font-weight:700;color:${ROUGE};">.A</span>
    <div style="text-align:center;flex:1;padding:0 16px;opacity:0.8;">
      <strong>Assemblage ingénierie</strong> S.A.S · 137 rue d'Aboukir, 75002 Paris · contact@assemblage.net · assemblage.net
    </div>
    <div style="text-transform:uppercase;letter-spacing:0.08em;font-weight:600;color:${ROUGE};">${projet.affaire}</div>
  </div>

</div>`;
}

function buildWpEditorial(projet: Projet, coverUrl: string | undefined, photoUrls: string[]): string {
  const pitch = projet.pitch ?? '';
  const description = projet.description ?? '';
  const paragraphs = description.split(/\n\n+/).filter(Boolean);
  const chiffresCles = projet.chiffresCles ?? [];

  const allPhotos = [coverUrl, ...photoUrls].filter(Boolean) as string[];

  const hasSecondaire = !!(
    projet.pole || projet.departement || projet.programme || projet.rehabNeuf ||
    projet.mandataire || projet.betAssocies || projet.entreprise || projet.bailleur
  );

  const photoGrid = allPhotos.length > 0
    ? `<div style="display:grid;grid-template-columns:${allPhotos.length === 1 ? '1fr' : allPhotos.length === 2 ? '1fr 1fr' : '2fr 1fr 1fr'};gap:4px;height:160px;margin-top:16px;">
        ${allPhotos.slice(0, 4).map(u =>
          `<div style="background-image:url(${u});background-size:cover;background-position:center;background-color:${GRIS};"></div>`
        ).join('')}
      </div>`
    : '';

  return `
<div style="font-family:${SANS};max-width:900px;margin:0 auto;background:white;">

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid ${ROUGE};padding-bottom:6px;margin-bottom:16px;">
    <div style="font-family:${SANS};font-size:9px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${VIOLET};">Assemblage ingénierie · Référence Projet</div>
    <div style="font-family:${SANS};font-size:9px;font-weight:600;color:${NOIR70};">● ${projet.statut}</div>
  </div>

  <!-- Titre -->
  <div style="margin-bottom:20px;">
    ${projet.adresse ? `<div style="font-family:${SANS};font-size:9px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${ROUGE};margin-bottom:6px;">${projet.adresse}</div>` : ''}
    <h1 style="font-family:${SERIF};font-size:34px;font-weight:400;line-height:1;letter-spacing:-0.02em;color:#000;margin:0 0 10px;">${projet.nom}</h1>
    ${pitch ? `<p style="font-family:${SERIF};font-size:15px;font-style:italic;line-height:1.4;color:${VIOLET};margin:0;">${pitch}</p>` : ''}
  </div>

  <!-- Info grid -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:14px 0;border-top:1px solid ${GRIS};border-bottom:1px solid ${GRIS};margin-bottom:20px;">
    ${infoItem("Maître d'ouvrage", projet.moa)}
    ${infoItem('Architecte', projet.architecte)}
    ${infoItem('Budget · Surface', projet.budgetHT, projet.surface ? `${projet.surface.toLocaleString('fr-FR')} m²` : undefined)}
    ${infoItem('Calendrier', projet.anneeLivraison, projet.missionAi ?? undefined)}
  </div>

  ${hasSecondaire ? `
  <div style="display:flex;flex-wrap:wrap;gap:12px 24px;padding-bottom:14px;border-bottom:1px dotted ${GRIS};margin-bottom:20px;">
    ${[
      { label: 'Pôle', value: projet.pole },
      { label: 'Département', value: projet.departement },
      { label: 'Programme', value: projet.programme },
      { label: 'Rehab / Neuf', value: projet.rehabNeuf },
      { label: 'Mandataire', value: projet.mandataire },
      { label: 'BET associés', value: projet.betAssocies },
      { label: 'Entreprise', value: projet.entreprise },
      { label: 'Bailleur', value: projet.bailleur },
    ].filter(f => !!f.value).map(f => infoItem(f.label, f.value)).join('')}
  </div>` : ''}

  <!-- Contenu : texte + photos -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:20px;">
    <div>
      ${paragraphs.map((p, i) => `<p style="font-family:${SANS};font-size:11px;line-height:1.6;color:#000;margin-bottom:8px;${i === 0 ? `font-size:12px;font-weight:500;` : ''}">${p}</p>`).join('')}
      ${chiffresCles.length > 0 ? `
        <div style="border-top:1px solid ${ROUGE};padding-top:10px;margin-top:10px;">
          <div style="font-family:${SANS};font-size:8px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${ROUGE};margin-bottom:6px;">Chiffres clés</div>
          ${chiffresCles.map(c => `
            <div style="display:flex;justify-content:space-between;font-family:${SANS};font-size:10px;padding:4px 0;border-bottom:1px dotted ${GRIS};">
              ${c.label} <strong style="font-family:${SERIF};font-weight:600;">${c.valeur}</strong>
            </div>`).join('')}
        </div>` : ''}
    </div>
    <div>
      ${photoGrid}
    </div>
  </div>

  <!-- Footer -->
  <div style="background:${VIOLET};color:white;padding:10px 28px;display:flex;justify-content:space-between;align-items:center;font-family:${SANS};font-size:9px;">
    <span style="font-family:${SERIF};font-size:16px;font-weight:700;color:${ROUGE};">.A</span>
    <div style="text-align:center;flex:1;padding:0 16px;opacity:0.8;">
      <strong>Assemblage ingénierie</strong> S.A.S · 137 rue d'Aboukir, 75002 Paris · contact@assemblage.net · assemblage.net
    </div>
    <div style="text-transform:uppercase;letter-spacing:0.08em;font-weight:600;color:${ROUGE};">${projet.affaire}</div>
  </div>

</div>`;
}

function buildWpContent(projet: Projet, coverUrl: string | undefined, photoUrls: string[]): string {
  return projet.layout === 'Magazine'
    ? buildWpMagazine(projet, coverUrl, photoUrls)
    : buildWpEditorial(projet, coverUrl, photoUrls);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const projet = await getProjet(slug);

  if (!projet) {
    return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
  }

  try {
    // 1. Upload cover photo
    let coverId: number | undefined;
    let coverUrl: string | undefined;
    if (projet.photoCouverture) {
      const uploaded = await uploadMedia(projet.photoCouverture.url, `${slug}-cover.jpg`);
      coverId = uploaded.id;
      coverUrl = uploaded.url;
    }

    // 2. Upload project photos
    const photoUrls: string[] = [];
    for (let i = 0; i < (projet.photosProjet ?? []).length; i++) {
      const photo = projet.photosProjet![i];
      const uploaded = await uploadMedia(photo.url, `${slug}-photo-${i + 1}.jpg`);
      photoUrls.push(uploaded.url);
    }

    // 3. Build styled WordPress HTML matching the defined layout
    const content = buildWpContent(projet, coverUrl, photoUrls);

    // 4. Create or update post
    const existingId = projet.urlWordpress ? extractWpPostId(projet.urlWordpress) : undefined;
    const { id, url } = await createOrUpdatePost(
      {
        title: projet.nom,
        slug: projet.slug,
        content,
        excerpt: projet.pitch,
        status: 'draft',
        featured_media: coverId,
      },
      existingId
    );

    // 5. Write back URL to Airtable (non-blocking)
    let airtableWarning: string | undefined;
    try {
      await updateProjetUrl(slug, url);
    } catch (airtableErr) {
      console.warn('Airtable URL write-back failed (non-fatal):', airtableErr);
      airtableWarning = 'URL non sauvegardée dans Airtable';
    }

    return NextResponse.json({ id, url, warning: airtableWarning });
  } catch (err) {
    console.error('Publish error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
