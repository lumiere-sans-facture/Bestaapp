import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Préférence d'apparence : « clair », « sombre » ou « système » (suit l'OS).
// Un réglage d'APPAREIL, pas une donnée métier — stocké en local uniquement,
// jamais répliqué par Supabase (voir remoteSync.js : rien à voir ici).
const STORAGE_KEY = 'bestasolar_theme';
const THEME_COLOR = { clair: '#0a2472', sombre: '#0b1020' };

const ThemeContext = createContext(null);

const estSombreSysteme = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

// Applique le thème au document : `data-theme` force clair/sombre, son
// absence laisse le CSS suivre `prefers-color-scheme` (thème « système »).
// Posé aussi par le script inline de index.html avant le premier rendu —
// ici pour les changements en cours de session.
const appliquerAuDocument = (theme) => {
  const root = document.documentElement;
  if (theme === 'clair' || theme === 'sombre') root.dataset.theme = theme === 'sombre' ? 'dark' : 'light';
  else delete root.dataset.theme;
  const sombre = theme === 'sombre' || (theme === 'systeme' && estSombreSysteme());
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', sombre ? THEME_COLOR.sombre : THEME_COLOR.clair);
};

export function ThemeProvider({ children }) {
  // Par défaut, toujours clair — l'app ne se met JAMAIS en sombre toute
  // seule en suivant l'OS ; « Système » reste un choix explicite de
  // l'utilisateur, pas le point de départ.
  const [theme, setThemeState] = useState(() => localStorage.getItem(STORAGE_KEY) || 'clair');

  useEffect(() => { appliquerAuDocument(theme); }, [theme]);

  // Thème « système » (choisi explicitement) : suit un changement de
  // préférence OS en direct, sans attendre un rechargement de la page.
  useEffect(() => {
    if (theme !== 'systeme') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => appliquerAuDocument('systeme');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  // Toujours écrit en toutes lettres — y compris « clair », le défaut :
  // sans ça, un « système » choisi puis reparti en « clair » retomberait,
  // absence de clé oblige, sur le défaut redevenu ambigu.
  const setTheme = useCallback((t) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme doit être utilisé dans <ThemeProvider>');
  return ctx;
}
