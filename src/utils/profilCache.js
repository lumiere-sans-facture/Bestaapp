// Dernier profil adopté sur cet appareil (identité, rôle, organisation).
//
// C'est ce qui permet d'OUVRIR l'app sans réseau. Le profil vit côté serveur :
// sans copie locale, une session pourtant valide ne pouvait pas être restaurée
// hors-ligne, et l'utilisateur se retrouvait devant l'écran de connexion —
// qu'il ne pouvait pas franchir non plus, faute de réseau. Ses données étaient
// là, sur l'appareil, inaccessibles.
//
// Ce n'est PAS un droit d'accès : la session Supabase et la RLS décident seules
// de ce que le serveur accepte. Le cache ne fait que rendre l'app utilisable
// avec ce qu'elle a déjà en local.

const CLE = 'bestasolar_profil';

/**
 * Profil mémorisé, à condition qu'il corresponde à l'email de la session en
 * cours. Ce contrôle n'est pas une formalité : sans lui, deux comptes utilisés
 * sur le même appareil ouvriraient l'un sur le profil de l'autre.
 */
export const lireProfilCache = (email) => {
  if (!email) return null;
  try {
    const cache = JSON.parse(localStorage.getItem(CLE));
    return cache?.email?.toLowerCase() === email.toLowerCase() ? cache : null;
  } catch {
    return null; // stockage indisponible ou contenu illisible
  }
};

/** Mémorise le profil adopté. Sans email, rien n'est écrit (illisible ensuite). */
export const ecrireProfilCache = (profil) => {
  try {
    if (profil?.email) localStorage.setItem(CLE, JSON.stringify(profil));
  } catch { /* navigation privée / quota : l'app reste utilisable en ligne */ }
};

/** Oublie le profil — déconnexion, session périmée, compte sans profil. */
export const oublierProfilCache = () => {
  try { localStorage.removeItem(CLE); } catch { /* rien à faire */ }
};
