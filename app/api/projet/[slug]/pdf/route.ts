import { NextRequest, NextResponse } from 'next/server';
import { getProjet } from '@/lib/airtable';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const projet = await getProjet(slug);

  if (!projet) {
    return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const pageUrl = `${appUrl}/projet/${slug}?print=true`;

  try {
    let browser;

    if (process.env.NODE_ENV === 'production' || process.env.USE_CHROMIUM_LAMBDA) {
      const chromium = (await import('@sparticuz/chromium')).default;
      const puppeteer = (await import('puppeteer-core')).default;
      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      const puppeteer = await import('puppeteer');
      browser = await puppeteer.launch({ headless: true });
    }

    const page = await browser.newPage();
    await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 30000 });

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
