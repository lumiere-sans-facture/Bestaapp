import { describe, expect, it } from 'vitest';
import {
  etatParrainage, peutChoisirParrain,
  PARRAINAGE_ABSENT, PARRAINAGE_PAR_DEFAUT, PARRAINAGE_VERROUILLE,
} from '../parrainage';

describe('état du parrainage', () => {
  it('sans rattachement, la saisie est ouverte', () => {
    expect(etatParrainage({ referred_by: null })).toBe(PARRAINAGE_ABSENT);
    expect(peutChoisirParrain({})).toBe(true);
  });

  it('un code CHOISI est définitif', () => {
    const org = { referred_by: 'FATOU-BBBBBB', referral_par_defaut: false };
    expect(etatParrainage(org)).toBe(PARRAINAGE_VERROUILLE);
    expect(peutChoisirParrain(org)).toBe(false);
  });

  it('un rattachement PAR DÉFAUT reste corrigeable une fois', () => {
    // C'est tout l'enjeu : rattacher automatiquement à BestaSolar ne doit pas
    // enfermer le partenaire avec un parrain qu'il n'a jamais désigné.
    const org = { referred_by: 'MAMADOU-AAAAAA', referral_par_defaut: true };
    expect(etatParrainage(org)).toBe(PARRAINAGE_PAR_DEFAUT);
    expect(peutChoisirParrain(org)).toBe(true);
  });

  it('après correction, le drapeau tombe et le choix se verrouille', () => {
    // Ce que fait set_org_referral côté base : referral_par_defaut = false.
    const apres = { referred_by: 'FATOU-BBBBBB', referral_par_defaut: false };
    expect(peutChoisirParrain(apres)).toBe(false);
  });

  it('ne suppose rien d’une organisation absente', () => {
    expect(etatParrainage(undefined)).toBe(PARRAINAGE_ABSENT);
    expect(etatParrainage(null)).toBe(PARRAINAGE_ABSENT);
  });
});
