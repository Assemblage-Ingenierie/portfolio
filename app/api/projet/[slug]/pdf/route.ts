import { existsSync } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { getProjet } from '@/lib/airtable';
import { requireApprovedUser } from '@/lib/supabase/requireApprovedUser';
import { renderPdfHtml } from '@/lib/pdf/renderHtml';

function findLocalChrome(): string {
  if (process.env.CHROME_EXECUTABLE_PATH) return process.env.CHROME_EXECUTABLE_PATH;

  const localAppData = process.env.LOCALAPPDATA ?? '';
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${localAppData}\\Google\\Chrome\\Application\\chrome.exe`,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    `${localAppData}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ];

  const found = candidates.find(p => p && existsSync(p));
  if (found) return found;

  throw new Error(
    'Aucun navigateur Chromium trouvé. Installer Chrome ou Edge, ou définir CHROME_EXECUTABLE_PATH dans .env.local'
  );
}

export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireApprovedUser(req);
  if (auth instanceof NextResponse) return auth;

  const { slug } = await params;
  const projet = await getProjet(slug);

  if (!projet) {
    return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
  }

  try {
    let browser;

    if (process.env.NODE_ENV === 'production' || process.env.USE_CHROMIUM_LAMBDA) {
      const chromium = (await import('@sparticuz/chromium')).default;
      const puppeteer = (await import('puppeteer-core')).default;

      chromium.setGraphicsMode = false;

      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      const puppeteer = (await import('puppeteer-core')).default;
      browser = await puppeteer.launch({
        executablePath: findLocalChrome(),
        headless: true,
        args: ['--no-sandbox', '--disable-gpu'],
      });
    }

    const page = await browser.newPage();
    const html = renderPdfHtml(projet);

    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    await browser.close();

    const filename = `${projet.affaire}_${slug}.pdf`;

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('PDF generation error:', err);
    return NextResponse.json({ error: 'Erreur lors de la génération du PDF' }, { status: 500 });
  }
}
