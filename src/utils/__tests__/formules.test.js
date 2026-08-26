import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  FORMULES, FORMULE_DEFAUT, SUBSCRIPTION_PRICE, SUBSCRIPTION_DAYS,
  formule, formuleValide, prixMensuelEquivalent,
} from '../subscription';
import { abonnementApresPaiement } from '../verificationPaiement';
import { lireFormuleChoisie, ecrireFormuleChoisie, oublierFormuleChoisie, capturerFormuleUrl } from '../formuleChoisie';
import { DAY_MS } from '../date';

const T0 = new Date('2026-03-10T08:00:00.000Z').getTime();

// Les tests tournent sous Node : ni stockage, ni adresse. Doublures minimales,
// suffisantes pour ce que le module touche réellement.
const ORIGINE = 'https://app.bestasolar.com';
const allerA = (chemin) => {
  const u = new URL(chemin, ORIGINE);
  globalThis.window.location = { href: u.href, search: u.search };
};

beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    const boite = new Map();
    globalThis.localStorage = {
      getItem: (k) => (boite.has(k) ? boite.get(k) : null),
      setItem: (k, v) => boite.set(k, String(v)),
      removeItem: (k) => boite.delete(k),
      clear: () => boite.clear(),
    };
  }
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = { history: { replaceState: (_e, _t, url) => allerA(String(url)) } };
  }
  allerA('/');
});

describe('catalogue des formules', () => {
  it('les trois formules de la page publique y sont, au bon tarif', () => {
    expect(FORMULES.map((f) => [f.id, f.prix, f.jours])).toEqual([
      ['mensuel', 5000, 30],
      ['trimestriel', 12750, 90],
      ['annuel', 45000, 365],
    ]);
  });

  it('les tarifs de référence sortent du catalogue, ils ne sont pas recopiés', () => {
    expect(SUBSCRIPTION_PRICE).toBe(formule(FORMULE_DEFAUT).prix);
    expect(SUBSCRIPTION_DAYS).toBe(formule(FORMULE_DEFAUT).jours);
  });

  it('un identifiant inconnu retombe sur la mensuelle — jamais sur la plus chère', () => {
    expect(formule('annuel_gratuit').id).toBe('mensuel');
    expect(formule(undefined).id).toBe('mensuel');
    expect(formule(null).id).toBe('mensuel');
  });

  it('reconnaît ce qui est au catalogue, et rien d’autre', () => {
    expect(formuleValide('trimestriel')).toBe(true);
    expect(formuleValide('hebdomadaire')).toBe(false);
    expect(formuleValide('')).toBe(false);
    expect(formuleValide(undefined)).toBe(false);
  });

  it('la mensualisation affichée est celle annoncée sur la page publique', () => {
    expect(prixMensuelEquivalent('mensuel')).toBe(5000);
    expect(prixMensuelEquivalent('trimestriel')).toBe(4250);
    expect(prixMensuelEquivalent('annuel')).toBe(3750);
  });

  it('une formule plus longue coûte moins cher au mois — sinon elle n’a pas de sens', () => {
    const parMois = FORMULES.map((f) => prixMensuelEquivalent(f.id));
    expect(parMois).toEqual([...parMois].sort((a, b) => b - a));
  });
});

describe('abonnementApresPaiement — la durée créditée suit la formule', () => {
  it('crédite les jours de SA formule, pas trente par défaut', () => {
    for (const f of FORMULES) {
      const sub = abonnementApresPaiement({ formule: f.id }, T0);
      expect(new Date(sub.dateFin).getTime()).toBe(T0 + f.jours * DAY_MS);
    }
  });

  it('un abonnement d’avant le catalogue garde ses trente jours', () => {
    // Aucune formule enregistrée : le comportement historique doit tenir.
    const sub = abonnementApresPaiement({ id: 'sub-u1', dateFin: null }, T0);
    expect(new Date(sub.dateFin).getTime()).toBe(T0 + 30 * DAY_MS);
    expect(sub.formule).toBe('mensuel');
  });

  it('renouveler tôt n’efface pas les jours déjà payés', () => {
    const finEnCours = T0 + 10 * DAY_MS;
    const sub = abonnementApresPaiement({ formule: 'annuel', dateFin: new Date(finEnCours).toISOString() }, T0);
    expect(new Date(sub.dateFin).getTime()).toBe(finEnCours + 365 * DAY_MS);
  });

  it('une échéance dépassée repart d’aujourd’hui, pas du passé', () => {
    const finPassee = T0 - 40 * DAY_MS;
    const sub = abonnementApresPaiement({ formule: 'trimestriel', dateFin: new Date(finPassee).toISOString() }, T0);
    expect(new Date(sub.dateFin).getTime()).toBe(T0 + 90 * DAY_MS);
  });

  it('inscrit le tarif de la formule sur l’abonnement', () => {
    const sub = abonnementApresPaiement({ formule: 'trimestriel' }, T0);
    expect(sub.montant).toBe(12750);
    expect(sub.formule).toBe('trimestriel');
    expect(sub.status).toBe('actif');
  });

  it('changer de formule au renouvellement change la durée créditée', () => {
    const mensuel = abonnementApresPaiement({ formule: 'mensuel' }, T0);
    const passeAnnuel = abonnementApresPaiement({ ...mensuel, formule: 'annuel' }, T0);
    const finMensuelle = new Date(mensuel.dateFin).getTime();
    expect(new Date(passeAnnuel.dateFin).getTime()).toBe(finMensuelle + 365 * DAY_MS);
  });
});

describe('montant exigé et jours crédités — la même formule décide des deux', () => {
  // C'est l'invariant de sécurité du parcours : le navigateur choisit une
  // FORMULE, jamais un prix. Le serveur exige `formule().prix` et crédite
  // `formule().jours`. Si les deux venaient de sources différentes, on
  // pourrait payer trente jours et en obtenir trois cent soixante-cinq.
  it('payer le tarif d’une formule crédite exactement sa durée', () => {
    for (const f of FORMULES) {
      const exige = formule(f.id).prix;
      const sub = abonnementApresPaiement({ formule: f.id }, T0);
      const jours = Math.round((new Date(sub.dateFin).getTime() - T0) / DAY_MS);
      expect([exige, jours]).toEqual([f.prix, f.jours]);
    }
  });

  it('un identifiant hors catalogue exige et crédite le mensuel — jamais l’annuel', () => {
    const inconnu = 'annuel ';
    expect(formuleValide(inconnu)).toBe(false);
    expect(formule(inconnu).prix).toBe(5000);
    const sub = abonnementApresPaiement({ formule: inconnu }, T0);
    expect(new Date(sub.dateFin).getTime()).toBe(T0 + 30 * DAY_MS);
  });
});

describe('formule choisie sur la page d’accueil', () => {
  beforeEach(() => { localStorage.clear(); });

  it('se retient et se relit', () => {
    ecrireFormuleChoisie('annuel');
    expect(lireFormuleChoisie()).toBe('annuel');
  });

  it('s’oublie une fois l’abonnement pris', () => {
    ecrireFormuleChoisie('annuel');
    oublierFormuleChoisie();
    expect(lireFormuleChoisie()).toBe(null);
  });

  it('une valeur hors catalogue n’est jamais retenue', () => {
    ecrireFormuleChoisie('gratuit_a_vie');
    expect(lireFormuleChoisie()).toBe(null);
  });

  it('une valeur hors catalogue EFFACE le choix précédent, elle ne le laisse pas traîner', () => {
    ecrireFormuleChoisie('annuel');
    ecrireFormuleChoisie('gratuit_a_vie');
    expect(lireFormuleChoisie()).toBe(null);
  });

  it('rien de retenu quand rien n’a été choisi', () => {
    expect(lireFormuleChoisie()).toBe(null);
  });

  it('un stockage indisponible ne fait pas échouer la lecture', () => {
    const espion = vi.spyOn(globalThis.localStorage, 'getItem').mockImplementation(() => { throw new Error('quota'); });
    expect(lireFormuleChoisie()).toBe(null);
    espion.mockRestore();
  });
});

describe('capture de ?formule= dans l’adresse', () => {
  beforeEach(() => { localStorage.clear(); allerA('/'); });

  it('capte la formule et nettoie l’adresse', () => {
    allerA('/inscription?formule=trimestriel');
    expect(capturerFormuleUrl()).toBe('trimestriel');
    expect(lireFormuleChoisie()).toBe('trimestriel');
    // Sans ce nettoyage, un rechargement réimposerait un choix abandonné.
    expect(window.location.search).not.toContain('formule');
  });

  it('conserve les autres paramètres de l’adresse', () => {
    allerA('/inscription?formule=annuel&equipe=ABC123');
    capturerFormuleUrl();
    expect(window.location.search).toContain('equipe=ABC123');
  });

  it('ignore une formule inventée, et ne touche pas à l’adresse', () => {
    allerA('/inscription?formule=gratuit');
    expect(capturerFormuleUrl()).toBe(null);
    expect(lireFormuleChoisie()).toBe(null);
    expect(window.location.search).toContain('formule=gratuit');
  });

  it('sans paramètre, ne retient rien', () => {
    allerA('/inscription');
    expect(capturerFormuleUrl()).toBe(null);
  });

  it('n’écrase pas un choix déjà mémorisé quand l’adresse est vide', () => {
    ecrireFormuleChoisie('annuel');
    allerA('/inscription');
    capturerFormuleUrl();
    expect(lireFormuleChoisie()).toBe('annuel');
  });
});
