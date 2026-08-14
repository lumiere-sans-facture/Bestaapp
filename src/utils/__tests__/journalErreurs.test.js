// Rapport d'erreur. Le risque n'est pas de mal formater un message : c'est
// de faire sortir de l'appareil les coordonnées des clients de l'installateur.
import { describe, it, expect } from 'vitest';
import {
  nettoyer, signature, codeErreur, appareilResume, construireRapport, messageSignalement,
  nettoyerEvenementSentry,
} from '../journalErreurs';

describe('nettoyer', () => {
  it('efface les numéros de téléphone, quelle que soit leur écriture', () => {
    expect(nettoyer('Client injoignable au +228 90 12 34 56')).toBe('Client injoignable au [tel]');
    expect(nettoyer('appel 00229 97000000 échoué')).toBe('appel [tel] échoué');
    expect(nettoyer('numéro 90123456 invalide')).toBe('numéro [numero] invalide');
  });

  it('efface les adresses e-mail', () => {
    expect(nettoyer('échec pour kossi.adje@exemple.tg')).toBe('échec pour [email]');
  });

  it('efface les clés et les jetons', () => {
    expect(nettoyer('clé sk_live_ABCDEF12345 refusée')).toBe('clé [cle] refusée');
    expect(nettoyer('jeton eyJhbGciOiJIUzI1NiJ9.abcdef.ghijkl expiré')).toBe('jeton [jeton] expiré');
  });

  it('laisse intact un message sans donnée personnelle', () => {
    expect(nettoyer('Cannot read properties of undefined')).toBe('Cannot read properties of undefined');
    expect(nettoyer('')).toBe('');
    expect(nettoyer(null)).toBe('');
  });
});

describe('signature', () => {
  it('regroupe deux occurrences du MÊME bug sur des données différentes', () => {
    const a = signature('Impossible d’enregistrer le devis 4821', 'at Devis (index-a3f9c2d1.js:12:345)');
    const b = signature('Impossible d’enregistrer le devis 9137', 'at Devis (index-b7e4f0a8.js:12:987)');
    expect(a).toBe(b);
  });

  it('sépare deux bugs différents', () => {
    expect(signature('Erreur A', 'at X')).not.toBe(signature('Erreur B', 'at Y'));
  });

  it('ne laisse aucune donnée personnelle dans la signature', () => {
    expect(signature('client +228 90 12 34 56 introuvable')).toContain('[tel]');
  });
});

describe('codeErreur', () => {
  it('donne le même code au même bug, un autre à un bug différent', () => {
    const s = signature('Erreur A', 'at X');
    expect(codeErreur(s)).toBe(codeErreur(s));
    expect(codeErreur(s)).not.toBe(codeErreur(signature('Erreur B', 'at Y')));
  });

  it('reste court et dictable au téléphone', () => {
    expect(codeErreur(signature('Erreur A'))).toMatch(/^ERR-[0-9A-F]{4}$/);
  });
});

describe('appareilResume', () => {
  it('reconnaît les combinaisons courantes sans détailler', () => {
    expect(appareilResume('Mozilla/5.0 (Linux; Android 13) Chrome/120.0.0.0 Mobile Safari/537.36'))
      .toBe('Chrome · Android');
    expect(appareilResume('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17.0 Safari/605.1'))
      .toBe('Safari · iOS');
    expect(appareilResume('')).toBe('inconnu · inconnu');
  });
});

describe('construireRapport', () => {
  const erreur = Object.assign(new Error('Client +228 90 12 34 56 introuvable'), {
    stack: 'Error: Client +228 90 12 34 56 introuvable\n    at Clients (index-a3f.js:1:20)',
  });

  it('nettoie le message ET la pile', () => {
    const r = construireRapport(erreur, { ecran: '/clients' });
    expect(r.message).not.toMatch(/90 12 34 56/);
    expect(r.pile).not.toMatch(/90 12 34 56/);
    expect(r.message).toContain('[tel]');
  });

  it('ne retient que des identifiants internes', () => {
    const r = construireRapport(erreur, { userId: 'u1', orgId: 'org-1', role: 'gerant' });
    expect(r.userId).toBe('u1');
    expect(r.orgId).toBe('org-1');
    // Aucun champ ne doit porter un nom ou un libellé humain.
    expect(Object.keys(r)).not.toContain('nom');
    expect(Object.keys(r)).not.toContain('email');
  });

  it('accepte une chaîne au lieu d’une Error (window.onerror)', () => {
    const r = construireRapport('Script error.', { origine: 'globale' });
    expect(r.message).toBe('Script error.');
    expect(r.origine).toBe('globale');
  });

  it('porte un code stable et une date', () => {
    const r = construireRapport(erreur, { date: '2026-08-14T10:00:00.000Z' });
    expect(r.code).toMatch(/^ERR-/);
    expect(r.date).toBe('2026-08-14T10:00:00.000Z');
  });
});

describe('messageSignalement', () => {
  it('porte le contexte technique et laisse la place au récit', () => {
    const r = construireRapport(new Error('Boum'), { ecran: '/devis', version: '1.1.0' });
    const msg = messageSignalement(r, 'Adam Adébiyi');
    expect(msg).toContain(r.code);
    expect(msg).toContain('/devis');
    expect(msg).toContain('1.1.0');
    expect(msg).toContain('Adam Adébiyi');
    expect(msg.trimEnd()).toMatch(/Ce que je faisais :$/);
  });

  it('se passe du nom quand il est absent', () => {
    const msg = messageSignalement(construireRapport(new Error('Boum')));
    expect(msg).not.toContain('Compte :');
  });
});

describe('nettoyerEvenementSentry', () => {
  it('nettoie le message et les exceptions avant tout envoi', () => {
    const e = nettoyerEvenementSentry({
      message: 'Client +228 90 12 34 56 introuvable',
      exception: { values: [{ type: 'Error', value: 'écrire à kossi@exemple.tg' }] },
    });
    expect(e.message).toBe('Client [tel] introuvable');
    expect(e.exception.values[0].value).toBe('écrire à [email]');
  });

  it('VIDE le fil d’Ariane — c’est là que fuiraient les données', () => {
    // Texte des boutons cliqués, URL appelées, sorties console : rien de tout
    // cela ne doit partir, et un filtre laisserait toujours passer quelque chose.
    const e = nettoyerEvenementSentry({
      breadcrumbs: [{ message: 'clic sur « Kossi Adjé — +228 90 12 34 56 »' }],
    });
    expect(e.breadcrumbs).toEqual([]);
  });

  it('nettoie l’URL de la requête', () => {
    const e = nettoyerEvenementSentry({ request: { url: 'https://app.tg/clients/90123456' } });
    expect(e.request.url).toBe('https://app.tg/clients/[numero]');
  });

  it('ne modifie pas l’objet reçu', () => {
    const origine = { message: 'tel +228 90 12 34 56', breadcrumbs: [{ message: 'x' }] };
    nettoyerEvenementSentry(origine);
    expect(origine.message).toBe('tel +228 90 12 34 56');
    expect(origine.breadcrumbs).toHaveLength(1);
  });

  it('supporte une entrée vide', () => {
    expect(nettoyerEvenementSentry(null)).toBeNull();
  });
});
