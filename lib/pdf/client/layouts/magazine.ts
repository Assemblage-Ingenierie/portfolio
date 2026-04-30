import type { Projet } from '@/types/projet';
import type { jsPDF } from 'jspdf';

type Doc = jsPDF;

const RD: [number, number, number] = [227, 5, 19];
const VT: [number, number, number] = [48, 50, 62];
const GR: [number, number, number] = [223, 228, 232];
const GR_LIGHT: [number, number, number] = [242, 242, 242];
const N70: [number, number, number] = [77, 77, 77];
const BK: [number, number, number] = [0, 0, 0];
const WH: [number, number, number] = [255, 255, 255];

function lh(pt: number, factor = 1.35): number {
  return (pt / 72) * 25.4 * factor;
}

function fmt(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function imgFmt(b64: string): 'JPEG' | 'PNG' {
  return b64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
}

/** Lit les dimensions d'une image base64 sans passer par HTMLImageElement (synchrone). */
function getImageSize(b64: string): { w: number; h: number } {
  const raw = atob(b64.split(',')[1]);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

  if (b64.startsWith('data:image/png')) {
    const w = ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
    const h = ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0;
    return { w, h };
  }

  // JPEG : chercher SOF marker (0xFF 0xC0-0xC3)
  for (let i = 2; i < bytes.length - 9;) {
    if (bytes[i] !== 0xFF) { i++; continue; }
    const m = bytes[i + 1];
    if (m >= 0xC0 && m <= 0xC3) {
      return { w: (bytes[i + 7] << 8) | bytes[i + 8], h: (bytes[i + 5] << 8) | bytes[i + 6] };
    }
    i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
  }
  return { w: 4, h: 3 }; // fallback 4:3
}

/**
 * Équivalent CSS background-size:cover; background-position:center
 * Clip via opérateurs PDF bruts pour éviter tout débordement.
 */
function drawImageCover(doc: Doc, b64: string, boxX: number, boxY: number, boxW: number, boxH: number): void {
  const { w: imgW, h: imgH } = getImageSize(b64);
  const imgAspect = imgW / imgH;
  const boxAspect = boxW / boxH;

  let drawW: number, drawH: number, drawX: number, drawY: number;
  if (imgAspect > boxAspect) {
    // Image plus large que la box : scale sur hauteur, centre horizontalement
    drawH = boxH;
    drawW = drawH * imgAspect;
    drawX = boxX - (drawW - boxW) / 2;
    drawY = boxY;
  } else {
    // Image plus haute que la box : scale sur largeur, centre verticalement
    drawW = boxW;
    drawH = drawW / imgAspect;
    drawX = boxX;
    drawY = boxY - (drawH - boxH) / 2;
  }

  // Clip via opérateurs PDF bruts (coordonnées en points, axe Y bas→haut)
  const pt = 72 / 25.4;
  const cx = (boxX * pt).toFixed(3);
  const cy = ((297 - boxY - boxH) * pt).toFixed(3); // Y inversé
  const cw = (boxW * pt).toFixed(3);
  const ch = (boxH * pt).toFixed(3);

  doc.saveGraphicsState();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).internal.out(`${cx} ${cy} ${cw} ${ch} re W n`);
  doc.addImage(b64, imgFmt(b64), drawX, drawY, drawW, drawH, undefined, 'FAST');
  doc.restoreGraphicsState();
}

export function drawMagazine(doc: Doc, projet: Projet, images: Record<string, string>): void {
  const L = 18;  // left margin
  const R = 192; // right edge
  const W = 174; // content width
  const HERO_H = 80;

  // ── Hero ─────────────────────────────────────────────────────────────────
  const coverB64 = projet.photoCouverture ? images[projet.photoCouverture.url] : null;
  if (coverB64) {
    drawImageCover(doc, coverB64, 0, 0, 210, HERO_H);
  } else {
    doc.setFillColor(...VT);
    doc.rect(0, 0, 210, HERO_H, 'F');
  }

  // Overlay foncé (bas du hero)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { GState } = (window as any).jspdf ?? {};
    if (GState) {
      doc.setGState(new GState({ opacity: 0.65 }));
      doc.setFillColor(...VT);
      doc.rect(0, 40, 210, 40, 'F');
      doc.setGState(new GState({ opacity: 1 }));
    }
  } catch {
    // Pas de support GState — overlay sans opacité
    doc.setFillColor(30, 32, 45);
    doc.rect(0, 55, 210, 25, 'F');
  }

  // Marque en haut à droite — ".A" en rouge suivi du label en blanc
  doc.setFont('Newsreader', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...RD);
  doc.text('.A', R, 12, { align: 'right' });
  const sigleW = doc.getTextWidth('.A');
  doc.setFont('OpenSans', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...WH);
  doc.text(' · Assemblage ingénierie', R - sigleW, 12, { align: 'right' });

  // Badge rouge — mesurer avec la font du badge avant de tracer le rect
  const badge = [projet.programme, projet.pole].filter(Boolean).join(' · ');
  if (badge) {
    doc.setFont('OpenSans', 'bold');
    doc.setFontSize(7.5);
    const badgeText = badge.toUpperCase();
    const badgeW = doc.getTextWidth(badgeText) + 8;
    doc.setFillColor(...RD);
    doc.rect(L, 57, badgeW, 5.5, 'F');
    doc.setTextColor(...WH);
    doc.text(badgeText, L + 4, 61.2);
  }

  // H1
  doc.setFont('Newsreader', 'normal');
  doc.setFontSize(26);
  doc.setTextColor(...WH);
  const h1Lines: string[] = doc.splitTextToSize(projet.nom, W);
  doc.text(h1Lines.slice(0, 2), L, 69);

  // Adresse
  if (projet.adresse) {
    doc.setFont('OpenSans', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...WH);
    doc.text(projet.adresse.toUpperCase(), L, 77);
  }

  // ── Corps ─────────────────────────────────────────────────────────────────
  // Sidebar : x=18, w=57mm (65mm - 8mm padding-right)
  // Séparateur rouge : x=83mm
  // Main : x=91mm, w=101mm

  const BODY_Y = HERO_H + 10; // 90mm
  const SIDEBAR_X = L;
  const SIDEBAR_W = 57;
  const SEP_X = L + 65; // 83mm
  const MAIN_X = SEP_X + 8; // 91mm
  const MAIN_W = R - MAIN_X; // ≈ 101mm
  const FOOTER_Y = 282;

  let sy = BODY_Y; // sidebar y
  let my = BODY_Y; // main y

  // Séparateur vertical rouge
  doc.setDrawColor(...RD);
  doc.setLineWidth(0.5);
  doc.line(SEP_X, BODY_Y - 3, SEP_X, FOOTER_Y - 4);

  // ── Sidebar ───────────────────────────────────────────────────────────────

  // Pitch
  if (projet.pitch) {
    doc.setFont('Newsreader', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(...VT);
    const pitchLines: string[] = doc.splitTextToSize(projet.pitch, SIDEBAR_W);
    doc.text(pitchLines, SIDEBAR_X, sy);
    sy += pitchLines.length * lh(11) + 3;
    // Ligne rouge sous le pitch
    doc.setDrawColor(...RD);
    doc.setLineWidth(0.5);
    doc.line(SIDEBAR_X, sy, SIDEBAR_X + SIDEBAR_W, sy);
    sy += 4;
  }

  // Info items sidebar
  const sideInfoItems = [
    { label: "Maître d'ouvrage", value: projet.moa },
    { label: 'Mission', value: projet.missionAi, sub: 'Assemblage ingénierie' },
    { label: 'Budget travaux', value: projet.budgetHT },
    {
      label: 'Calendrier',
      value: projet.anneeLivraison?.toString(),
      sub: projet.surface ? `${fmt(projet.surface)} m²` : undefined,
    },
  ].filter(i => i.value);

  for (const item of sideInfoItems) {
    if (sy > FOOTER_Y - 10) break;
    doc.setFont('OpenSans', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...N70);
    doc.text((item.label ?? '').toUpperCase(), SIDEBAR_X, sy);
    sy += lh(6.5);

    doc.setFont('Newsreader', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BK);
    const vLines: string[] = doc.splitTextToSize(String(item.value ?? ''), SIDEBAR_W);
    doc.text(vLines, SIDEBAR_X, sy);
    sy += vLines.length * lh(10);

    if (item.sub) {
      doc.setFont('OpenSans', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...N70);
      doc.text(item.sub, SIDEBAR_X, sy);
      sy += lh(7.5);
    }
    sy += 2.5;
  }

  // Info secondaire (pôle, département, etc.)
  const secItems = [
    ['Pôle', projet.pole], ['Département', projet.departement], ['Programme', projet.programme],
    ['Rehab / Neuf', projet.rehabNeuf], ['Mandataire', projet.mandataire],
    ['BET associés', projet.betAssocies],
  ].filter(([, v]) => v) as [string, string][];

  if (secItems.length && sy < FOOTER_Y - 30) {
    doc.setDrawColor(...GR);
    doc.setLineWidth(0.2);
    doc.line(SIDEBAR_X, sy, SIDEBAR_X + SIDEBAR_W, sy);
    sy += 4;

    for (const [label, value] of secItems) {
      if (sy > FOOTER_Y - 10) break;
      doc.setFont('OpenSans', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(...N70);
      doc.text(label.toUpperCase(), SIDEBAR_X, sy);
      sy += lh(6);
      doc.setFont('OpenSans', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...BK);
      doc.text(value, SIDEBAR_X, sy);
      sy += lh(8.5) + 1.5;
    }
  }

  // Chiffres clés
  if (projet.chiffresCles?.length && sy < FOOTER_Y - 30) {
    doc.setDrawColor(...GR);
    doc.setLineWidth(0.3);
    doc.line(SIDEBAR_X, sy, SIDEBAR_X + SIDEBAR_W, sy);
    sy += 5;

    for (const c of projet.chiffresCles) {
      if (sy > FOOTER_Y - 15) break;
      doc.setFont('Newsreader', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(...VT);
      doc.text(String(c.valeur), SIDEBAR_X, sy);
      sy += lh(22, 1.1);
      doc.setFont('OpenSans', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...N70);
      doc.text(String(c.label).toUpperCase(), SIDEBAR_X, sy);
      sy += lh(7.5) + 2;
    }
  }

  // ── Main ──────────────────────────────────────────────────────────────────

  // H2
  doc.setFont('Newsreader', 'normal');
  doc.setFontSize(18);
  doc.setTextColor(...BK);
  const h2Lines: string[] = doc.splitTextToSize(projet.nom, MAIN_W);
  doc.text(h2Lines.slice(0, 2), MAIN_X, my);
  my += Math.min(h2Lines.length, 2) * lh(18) + 3;

  // Texte article (simple colonne — le 2-col CSS est trop complexe à reproduire en jsPDF)
  const paragraphs = projet.description.split(/\n\n+/).filter(Boolean);
  doc.setFont('OpenSans', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BK);

  for (const p of paragraphs) {
    const lines: string[] = doc.splitTextToSize(p, MAIN_W);
    const needed = lines.length * lh(9);
    if (my + needed > FOOTER_Y - 40) break;
    doc.text(lines, MAIN_X, my);
    my += needed + 2;
  }

  // Galerie photos (3 photos sur 32mm de haut)
  const galleryPhotos = (projet.photosProjet ?? []).slice(0, 3);
  if (galleryPhotos.length > 0 && my < FOOTER_Y - 40) {
    my += 3;
    const gW = (MAIN_W - 2 * 2) / 3; // 3 photos avec 2mm de gap
    for (let i = 0; i < galleryPhotos.length; i++) {
      const gx = MAIN_X + i * (gW + 2);
      const b64 = images[galleryPhotos[i].url];
      if (b64) {
        doc.addImage(b64, imgFmt(b64), gx, my, gW, 32, undefined, 'FAST');
      } else {
        doc.setFillColor(...GR);
        doc.rect(gx, my, gW, 32, 'F');
      }
    }
    my += 34;
  }

  // ── Tags ──────────────────────────────────────────────────────────────────
  const { certifications, materiaux, tagsSiteWeb } = projet;
  const hasTags = certifications.length || materiaux.length || tagsSiteWeb.length;
  const tagsY = Math.max(sy, my) + 3;

  if (hasTags && tagsY < FOOTER_Y - 12) {
    doc.setFillColor(...GR_LIGHT);
    doc.rect(0, tagsY - 2, 210, 10, 'F');

    let tx = L;
    const allTags = [
      ...certifications.map(t => ({ text: t, dark: true })),
      ...materiaux.map(t => ({ text: t, dark: false })),
      ...tagsSiteWeb.map(t => ({ text: t, dark: false })),
    ];

    for (const tag of allTags) {
      doc.setFont('OpenSans', 'bold');
      doc.setFontSize(7.5);
      const tw = doc.getTextWidth(tag.text) + 5;
      if (tx + tw > R) break;
      if (tag.dark) {
        doc.setFillColor(...VT);
        doc.setTextColor(...WH);
      } else {
        doc.setFillColor(...WH);
        doc.setTextColor(...BK);
      }
      doc.roundedRect(tx, tagsY, tw, 4.5, 0.8, 0.8, 'F');
      doc.text(tag.text, tx + 2.5, tagsY + 3.2);
      tx += tw + 2;
    }
  }

  // ── Footer violet ─────────────────────────────────────────────────────────
  doc.setFillColor(...VT);
  doc.rect(0, FOOTER_Y, 210, 297 - FOOTER_Y, 'F');

  const fY = FOOTER_Y + 5;
  doc.setFont('Newsreader', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...RD);
  doc.text('.A', L, fY);

  doc.setFont('OpenSans', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(200, 200, 210);
  doc.text(
    "Assemblage ingénierie S.A.S · 137 rue d'Aboukir, 75002 Paris · contact@assemblage.net",
    105,
    fY,
    { align: 'center' }
  );

  doc.setFont('OpenSans', 'bold');
  doc.setTextColor(...RD);
  doc.text(projet.affaire, R, fY, { align: 'right' });
}
