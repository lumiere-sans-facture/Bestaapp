// Dernier appel à l'action, avant le pied de page.
import { Link } from 'react-router-dom';
import { LIEN_INSCRIPTION } from './constantes';

export default function LandingAppel() {
  return (
    <>
      <section style={{ background: '#0c3483', color: '#ffffff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(48px, 6vw, 80px) clamp(20px, 5vw, 48px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '32px', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 'clamp(1.875rem, 3.4vw, 2.75rem)', lineHeight: '1.1', fontWeight: '800', letterSpacing: '-0.022em', margin: '0 0 14px' }}>Votre prochain client mérite mieux qu'un cahier.</h2>
            <p style={{ fontSize: '1.0625rem', lineHeight: '1.6', color: 'rgba(255,255,255,0.75)', margin: '0' }}>Créez votre compte gratuit aujourd'hui, sortez votre premier devis avant ce soir. 0 F, sans carte bancaire, sans engagement.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'flex-start' }}>
            <Link className="lp-h3" to={LIEN_INSCRIPTION} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '17px 32px', borderRadius: '8px', background: '#ffa800', color: '#001744', fontWeight: '700', fontSize: '1.125rem', boxShadow: '0 6px 16px rgba(255,168,0,.30)' }}>Créer mon compte</Link>
            <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.65)' }}>Ou appelez-nous : +229 016 173 2956 — un conseiller répond.</span>
          </div>
        </div>
      </section>
    </>
  );
}
