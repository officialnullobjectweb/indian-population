'use client';

import { useEffect, useState } from 'react';

export default function ThemeButton() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const saved = (() => {
      try {
        return localStorage.getItem('india-map-theme');
      } catch {
        return null;
      }
    })();
    const initial =
      saved === 'dark' || saved === 'light'
        ? saved
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    applyTheme(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyTheme(t) {
    const dark = t === 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem('india-map-theme', t);
    } catch {
      /* private mode */
    }
    setTheme(t);
  }

  const dark = theme === 'dark';
  return (
    <button
      id="theme-btn"
      type="button"
      aria-pressed={dark ? 'true' : 'false'}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => applyTheme(dark ? 'light' : 'dark')}
    >
      <svg
        id="theme-icon-moon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        hidden={dark}
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      <svg
        id="theme-icon-sun"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        hidden={!dark}
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
