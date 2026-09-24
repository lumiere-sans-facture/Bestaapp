import { PAGES_LEGALES } from '../config/legal';
import { lienLegal } from '../utils/liensLegaux';

/**
 * Liens vers les pages légales — exigés DANS l'app par Google Play et
 * l'App Store, pas seulement sur le site.
 * @param {'liens'|'consentement'} variante  « consentement » : la phrase
 *   d'acceptation affichée avant la création d'un compte.
 */
export default function LiensLegaux({ variante = 'liens', className = '' }) {
  if (variante === 'consentement') {
    return (
      <p className={`liens-legaux-consentement ${className}`}>
        En créant un compte, vous acceptez les{' '}
        <a {...lienLegal('conditions')}>conditions d'utilisation</a> et la{' '}
        <a {...lienLegal('confidentialite')}>politique de confidentialité</a>.
      </p>
    );
  }
  return (
    <nav className={`liens-legaux ${className}`} aria-label="Informations légales">
      {['conditions', 'confidentialite', 'suppression'].map((page) => (
        <a key={page} {...lienLegal(page)}>{PAGES_LEGALES[page].libelle}</a>
      ))}
    </nav>
  );
}
