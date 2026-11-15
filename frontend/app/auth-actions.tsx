'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logout = async () => {
    setError('');
    setIsLoggingOut(true);

    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) {
        setError('Could not log out. Please try again.');
        return;
      }

      router.replace('/login');
      router.refresh();
    } catch {
      setError('Could not reach the sign-out service. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="auth-actions">
      <button className="logout-button" type="button" onClick={logout} disabled={isLoggingOut}>
        {isLoggingOut ? 'Signing out...' : 'Log out'}
      </button>
      {error ? <span className="logout-error" role="alert">{error}</span> : null}
    </div>
  );
}
