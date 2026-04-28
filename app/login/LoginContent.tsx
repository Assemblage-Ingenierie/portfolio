'use client';

import { useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import styles from './login.module.css';

export default function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setLoading(true);
    setMessage('');
    const sb = getSupabaseClient();
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) { setMessage(error.message); setLoading(false); }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const sb = getSupabaseClient();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    setMessage(error ? error.message : 'Lien envoyé ! Vérifiez votre boîte mail.');
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const sb = getSupabaseClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setMessage(error.message);
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoText}>Assemblage ingénierie</span>
          <span className={styles.logoDot}>·A</span>
        </div>
        <h1 className={styles.title}>Portfolio</h1>

        <button className={styles.googleBtn} onClick={handleGoogle} disabled={loading}>
          <GoogleIcon />
          Continuer avec Google
        </button>

        <div className={styles.divider}><span>ou</span></div>

        <div className={styles.tabs}>
          <button
            className={mode === 'password' ? styles.tabActive : styles.tab}
            onClick={() => { setMode('password'); setMessage(''); }}
          >Email + mot de passe</button>
          <button
            className={mode === 'magic' ? styles.tabActive : styles.tab}
            onClick={() => { setMode('magic'); setMessage(''); }}
          >Magic link</button>
        </div>

        {mode === 'password' ? (
          <form onSubmit={handlePassword} className={styles.form}>
            <input type="email" placeholder="Email" value={email} required
              onChange={e => setEmail(e.target.value)} className={styles.input} />
            <input type="password" placeholder="Mot de passe" value={password} required
              onChange={e => setPassword(e.target.value)} className={styles.input} />
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMagicLink} className={styles.form}>
            <input type="email" placeholder="Email" value={email} required
              onChange={e => setEmail(e.target.value)} className={styles.input} />
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Envoi…' : 'Envoyer le lien'}
            </button>
          </form>
        )}

        {message && <p className={styles.message}>{message}</p>}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.88v2.07A8 8 0 0 0 8.98 17z"/>
      <path fill="#FBBC05" d="M4.51 10.52A4.8 4.8 0 0 1 4.26 9c0-.52.09-1.03.25-1.52V5.41H1.88A8 8 0 0 0 .98 9c0 1.29.31 2.52.9 3.59l2.63-2.07z"/>
      <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 8.98 1a8 8 0 0 0-7.1 4.41l2.63 2.07c.63-1.89 2.39-3.9 4.47-3.9z"/>
    </svg>
  );
}
