'use client';

// global-error remplace ENTIÈREMENT le root layout (donc il doit fournir ses
// propres <html>/<body>). Il ne se déclenche qu'en dernier recours, quand
// l'erreur survient dans le layout racine lui-même. On réimporte globals.css
// ici car le layout (qui l'importe normalement) est court-circuité — sans ça
// on perdrait la police Geomanist et les variables de marque.

import { useEffect } from 'react';
import './globals.css';
import styles from './error-screen.module.css';

const LOGO_URL =
  'https://hhkofvbptnrtwbazftlm.supabase.co/storage/v1/object/public/Branding/logo/logo_Ai_rouge.svg';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error]', error);
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <div className={styles.page}>
          <div className={styles.card}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.logoImg} src={LOGO_URL} alt="Assemblage ingénierie" />
            <p className={styles.code}>Erreur</p>
            <h1 className={styles.title}>L&apos;application a rencontré un problème</h1>
            <p className={styles.message}>
              Une erreur inattendue s&apos;est produite. Veuillez réessayer.
            </p>
            {error.digest && <p className={styles.digest}>Réf. : {error.digest}</p>}
            <div className={styles.actions}>
              <button className={styles.primaryBtn} onClick={() => reset()}>
                Réessayer
              </button>
              <a className={styles.secondaryBtn} href="/">
                Retour au portfolio
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
