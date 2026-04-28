'use client';

import styles from './attente.module.css';

interface Props {
  email: string;
  onLogout: () => void;
}

export default function AttenteContent({ email, onLogout }: Props) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoText}>Assemblage ingénierie</span>
          <span className={styles.logoDot}>·A</span>
        </div>
        <h1 className={styles.title}>Accès en attente</h1>
        <p className={styles.text}>
          Votre compte <strong>{email}</strong> est enregistré.<br />
          Un administrateur doit approuver votre accès avant que vous puissiez consulter le portfolio.
        </p>
        <button onClick={onLogout} className={styles.logoutBtn}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
