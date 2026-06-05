'use client';

import { useMemo } from 'react';
import type { Projet } from '@/types/projet';
import { buildWpContent } from '@/lib/wordpress/builders';
import type { WpConfig } from '@/lib/wordpress/wpConfig';
import { ui } from '@/lib/ui/tokens';

/**
 * Aperçu fidèle du rendu WordPress (Export WP 1 / builder Editorial).
 *
 * Le builder `buildWpContent` est une fonction pure : on l'exécute côté client
 * avec les URLs d'images Airtable (pas besoin d'upload WordPress pour l'aperçu).
 * Le HTML — auto-suffisant et inline-stylé — est injecté dans une iframe via
 * `srcDoc`, ce qui isole le CSS du builder du reste de l'app et reproduit le
 * contexte d'un post WordPress embarqué.
 *
 * Largeur ~ colonne de contenu d'un article (pas A4) : on ne mesure aucun
 * débordement (le web scrolle), contrairement à `TemplatePreview`.
 */
export default function WordpressPreview({
  projet,
  wpConfig,
}: {
  projet: Projet;
  wpConfig?: WpConfig;
}) {
  const inner = useMemo(
    () =>
      buildWpContent(
        projet,
        projet.photoCouverture?.url,
        (projet.photosProjet ?? []).map((p) => p.url),
        wpConfig,
      ),
    [projet, wpConfig],
  );

  // Document complet pour l'iframe : on charge Open Sans (utilisé par le
  // builder) + un wrapper qui imite la colonne de contenu d'un article.
  const html = useMemo(
    () => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
<style>
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body { padding: 40px 32px 64px; }
  .wp-preview-wrap { max-width: 1000px; margin: 0 auto; }
  img { max-width: 100%; }
</style>
</head>
<body>
<div class="wp-preview-wrap">${inner}</div>
</body>
</html>`,
    [inner],
  );

  // Hash léger → `key` sur l'iframe : remount fiable au changement de contenu
  // (même contournement que TemplatePreview pour le srcDoc de Chrome).
  const iframeKey = useMemo(() => {
    let h = 0;
    for (let i = 0; i < html.length; i++) h = ((h << 5) - h + html.charCodeAt(i)) | 0;
    return h;
  }, [html]);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '24px 16px 48px',
        background: ui.fondPage,
        minHeight: 'calc(100vh - 48px)',
        width: '100%',
      }}
    >
      <iframe
        key={iframeKey}
        title={`Aperçu WordPress — ${projet.nom}`}
        srcDoc={html}
        style={{
          width: '100%',
          maxWidth: 1100,
          minHeight: 'calc(100vh - 120px)',
          border: 'none',
          background: 'white',
          borderRadius: 12,
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        }}
      />
    </div>
  );
}
