// Le formulaire client ne saisit plus le 2ᵉ téléphone ni l'origine du contact.
// Les fiches qui en portent déjà ne doivent pas les perdre à la première
// modification : `updateLead` reçoit un correctif qui ne mentionne pas ces
// champs, et un correctif silencieux n'efface rien.
import { describe, it, expect } from 'vitest';
import { createLeadActions } from '../../context/actions/leads';

// `addLead` lit l'attribution d'affiliation (?ref=…) dans le stockage local,
// que Node ne fournit pas. Un double minimal suffit : aucun parrain actif.
globalThis.localStorage ??= {
  getItem: () => null, setItem: () => {}, removeItem: () => {},
};

/** Petit `setState` de test : applique le réducteur et garde le résultat. */
const magasin = (etat) => {
  let courant = etat;
  const setState = (f) => { courant = f(courant); };
  return { actions: createLeadActions(setState), lire: () => courant };
};

const ANCIEN = {
  id: 'c-1', name: 'Ancien Client', contact: 'Ancien Client', clientType: 'particulier',
  phone: '+22891000000', phone2: '+22892000000', source: 'terrain',
  email: '', address: 'Lomé', notes: '', stage: 'nouveau', assignedTo: 'u1',
};

describe('modification d’un client par le formulaire allégé', () => {
  it('conserve le 2ᵉ téléphone et l’origine qu’il ne saisit plus', () => {
    const { actions, lire } = magasin({ leads: [ANCIEN], commissions: [], referrals: [], devis: [] });
    // Exactement ce que le formulaire envoie désormais : ni phone2, ni source.
    actions.updateLead('c-1', {
      name: 'Ancien Client', contact: 'Ancien Client', phone: '+22891000000',
      email: 'ancien@exemple.com', address: 'Lomé', notes: '', clientType: 'particulier',
    });
    const apres = lire().leads[0];
    expect(apres.phone2).toBe('+22892000000');
    expect(apres.source).toBe('terrain');
    expect(apres.email).toBe('ancien@exemple.com'); // la modification, elle, est bien prise
  });

  it('un client créé sans ces champs n’en invente aucun', () => {
    const { actions, lire } = magasin({ leads: [], commissions: [], referrals: [], devis: [], partners: [] });
    actions.addLead({
      name: 'Nouveau Client', contact: 'Nouveau Client', phone: '+22893000000',
      email: '', address: 'Lomé', notes: '', clientType: 'particulier', assignedTo: 'u1',
    });
    const cree = lire().leads[0];
    expect(cree.phone2).toBeUndefined();
    expect(cree.source).toBeUndefined();
    expect(cree.name).toBe('Nouveau Client');
  });
});
