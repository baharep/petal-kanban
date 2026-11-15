'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { resetProjects } from '../projects-store';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.status === 401) {
        setError('Invalid username or password.');
        return;
      }
      if (!response.ok) {
        setError('Sign-in is unavailable right now. Please try again.');
        return;
      }

      resetProjects();
      router.replace('/');
      router.refresh();
    } catch {
      setError('Could not reach the sign-in service. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <Link className="brand-mark auth-brand" href="/" aria-label="Petal">
          <span className="brand-badge" aria-hidden="true">
            <span className="petal petal-one" />
            <span className="petal petal-two" />
            <span className="petal petal-three" />
            <span className="petal-center" />
          </span>
          <span className="brand-name">Petal<span className="brand-period">.</span></span>
        </Link>
        <p className="eyebrow"><span /> DEVELOPMENT DEMO</p>
        <h1 id="login-title">Welcome back<span className="brand-period">.</span></h1>
        <p className="auth-description">Sign in to open your project workspace.</p>

        <form className="auth-form" onSubmit={submitLogin}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            className="input-field"
            autoComplete="username"
            autoFocus
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            className="input-field"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          <button className="new-card-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="auth-demo-note">
          Demo only. Use <strong>user</strong> and <strong>password</strong>. This sign-in is not for production.
        </p>
      </section>
    </main>
  );
}
