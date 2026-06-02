import type { MetadataRoute } from 'next';

/**
 * robots.txt — App interne d'Assemblage (portfolio de références), protégée
 * par auth Supabase. Elle n'a pas vocation à être indexée ni crawlée : chaque
 * requête d'un crawler sur une page (entrée de cache froide) déclenche un ISR
 * write côté Vercel. On bloque donc tous les robots polis (Google, Bing, et la
 * plupart des bots d'aperçu de lien) pour couper cette source de writes.
 *
 * NOTE : ceci désindexe aussi /public/portfolio (l'extranet public). Si un jour
 * tu veux que cet extranet soit trouvable sur Google, retire-le du Disallow
 * (ex. `disallow: ['/'], allow: ['/public/']`) et override le `robots` metadata
 * sur cette route.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  };
}
