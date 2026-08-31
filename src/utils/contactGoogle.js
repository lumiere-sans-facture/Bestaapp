// Nom des contacts envoyés vers Google Contacts.
import { normaliseCode } from './referral';

/**
 * « FATOU-KN8ERZ Soumana » : le code du partenaire qui a enregistré le
 * contact, puis son nom. Le carnet Google se lit alors par apporteur — le
 * gérant sait d'un coup d'œil qui a amené qui, y compris hors de l'app.
 *
 * Sans code connu, le nom seul : mieux vaut un contact sans préfixe qu'un
 * contact qui ne part pas.
 */
export const nomContactGoogle = (nom, code) => {
  const propre = String(nom || '').trim();
  const codePropre = normaliseCode(code);
  if (!propre) return codePropre;
  return codePropre ? `${codePropre} ${propre}` : propre;
};
