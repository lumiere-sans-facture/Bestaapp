// Espace Pro étanche : ses listes ne prennent que ses devis, sa cloche que
// ses alertes (factures, entreprise, abonnement) — rien du carnet public.
import { describe, it, expect } from 'vitest';
import { estDevisPro } from '../affaires';
import { buildAlertFeedPro } from '../alerts';

const JOUR = 864e5;
const maintenant = new Date('2026-10-10T10:00:00Z');
const il = (j) => new Date(maintenant.getTime() + j * JOUR).toISOString();

describe('devis de l’espace Pro', () => {
  it('le type fait foi, pas le drapeau « pro » d’un ancien export', () => {
    expect(estDevisPro({ type: 'pro' })).toBe(true);
    expect(estDevisPro({ type: 'pro', pro: true })).toBe(true);
    // Devis public exporté jadis à l'identité Pro : il reste public.
    expect(estDevisPro({ type: 'solar', pro: true })).toBe(false);
    expect(estDevisPro({ type: 'manuel' })).toBe(false);
    expect(estDevisPro(null)).toBe(false);
  });
});

describe('alertes de l’espace Pro', () => {
  const entreprise = { nomEntreprise: 'Lumière Sans Facture' };
  const facture = (x) => ({ id: crypto.randomUUID(), numero: 'FAC-1', totalTTC: 100000, statut: 'emise', createdAt: il(-40), ...x });

  it('factures en retard d’abord, puis échéances proches, abonnement, brouillons — liens Pro', () => {
    const feed = buildAlertFeedPro({
      company: entreprise,
      factures: [
        facture({ numero: 'FAC-RETARD', echeance: il(-12) }),
        facture({ numero: 'FAC-PROCHE', echeance: il(3) }),
        facture({ numero: 'FAC-LOIN', echeance: il(30) }),
        facture({ numero: 'FAC-PAYEE', statut: 'payee', montantPaye: 100000, echeance: il(-20) }),
        facture({ numero: 'FAC-BROUILLON', statut: 'brouillon' }),
      ],
      // (L'échéance d'abonnement se compte sur l'heure réelle : utils/subscription.)
      sub: { status: 'actif', dateDebut: new Date(Date.now() - 25 * JOUR).toISOString(), dateFin: new Date(Date.now() + 5 * JOUR).toISOString() },
      maintenant,
    });
    expect(feed.map((a) => a.id.split('-')[0])).toEqual(['ret', 'ech', 'sub', 'draft']);
    expect(feed[0]).toMatchObject({ sev: 'critique', label: 'En retard de 12 j', to: '/pro/documents' });
    expect(feed[0].entity).toMatch(/^FAC-RETARD · reste 100[\s  ]000/);
    expect(feed[1]).toMatchObject({ label: 'Échéance dans 3 j', to: '/pro/documents' });
    expect(feed[2]).toMatchObject({ to: '/pro/abonnement' });
    expect(feed[2].label).toMatch(/^Abonnement Pro expire dans [56] j$/);
    expect(feed[3]).toMatchObject({ label: '1 brouillon(s) à finaliser', to: '/pro/documents' });
    expect(feed.every((a) => a.to.startsWith('/pro/'))).toBe(true);
  });

  it('entreprise non configurée : alerte critique vers « Mon entreprise »', () => {
    const feed = buildAlertFeedPro({ company: null, factures: [], sub: null, maintenant });
    expect(feed).toEqual([expect.objectContaining({ id: 'company', sev: 'critique', to: '/pro/entreprise' })]);
  });

  it('rien à signaler : fil vide', () => {
    expect(buildAlertFeedPro({ company: entreprise, factures: [facture({ echeance: il(30) })], maintenant })).toEqual([]);
  });
});
