// Carrière et partenaires : les trois façons de travailler avec BestaSolar.
import { Link } from 'react-router-dom';
import { LIEN_INSCRIPTION } from './constantes';

export default function LandingCarriere() {
  return (
    <>
      <section id="carriere" style={{ background: '#ffffff', borderTop: '1px solid #e3e7ef' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(48px, 6vw, 88px) clamp(20px, 5vw, 48px)' }}>
          <div style={{ maxWidth: '760px', marginBottom: 'clamp(28px, 4vw, 48px)' }}>
            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b87400', marginBottom: '14px' }}>Carrière et partenaires</span>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', lineHeight: '1.12', fontWeight: '800', letterSpacing: '-0.012em', margin: '0 0 14px' }}>Faites carrière avec BestaSolar, sans rien payer</h2>
            <p style={{ fontSize: '1.0625rem', lineHeight: '1.65', color: '#697386', margin: '0' }}>Techniciens partenaires et commerciaux travaillent avec nous gratuitement : aucun frais d'inscription, aucun abonnement. Vous êtes payé sur ce que vous réalisez, pas sur ce que vous versez.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '20px' }}>
            <article className="lp-h5" data-reveal="1" style={{ background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', padding: '26px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <span style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#f2f5fa', color: '#0c3483', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1z"></path><path d="M10 10V5a2 2 0 0 1 4 0v5"></path><path d="M4 15v-3a8 8 0 0 1 16 0v3"></path></svg></span>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '700', margin: '0 0 8px' }}>Technicien partenaire</h3>
                <p style={{ fontSize: '0.9375rem', lineHeight: '1.6', color: '#697386', margin: '0' }}>Vous posez et raccordez. Les chantiers vous sont transmis dans l'application, avec le dimensionnement déjà validé par un conseiller.</p>
              </div>
              <ul style={{ listStyle: 'none', margin: '0', padding: '0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.875rem', color: '#0c0f14' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Formation technique incluse</li>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.875rem', color: '#0c0f14' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Rémunéré au chantier</li>
              </ul>
            </article>
            <article className="lp-h5" data-reveal="1" style={{ background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', padding: '26px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <span style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#f2f5fa', color: '#0c3483', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"></path></svg></span>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '700', margin: '0 0 8px' }}>Commercial</h3>
                <p style={{ fontSize: '0.9375rem', lineHeight: '1.6', color: '#697386', margin: '0' }}>Vous trouvez les clients, l'application fait le reste : dimensionnement, devis, suivi. Chaque vente est attribuée à votre nom.</p>
              </div>
              <ul style={{ listStyle: 'none', margin: '0', padding: '0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.875rem', color: '#0c0f14' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Outil de vente gratuit</li>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.875rem', color: '#0c0f14' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Commission sur chaque vente</li>
              </ul>
            </article>
            <article className="lp-h5" data-reveal="1" style={{ background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', padding: '26px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <span style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#f2f5fa', color: '#0c3483', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg></span>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '700', margin: '0 0 8px' }}>Revendeur</h3>
                <p style={{ fontSize: '0.9375rem', lineHeight: '1.6', color: '#697386', margin: '0' }}>Vous vendez sous votre propre nom, avec notre catalogue et nos prix. Les kits sont livrés depuis notre stock.</p>
              </div>
              <ul style={{ listStyle: 'none', margin: '0', padding: '0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.875rem', color: '#0c0f14' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Aucun stock à avancer</li>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.875rem', color: '#0c0f14' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Parrainage sur deux niveaux</li>
              </ul>
            </article>
          </div>
          <div style={{ marginTop: 'clamp(24px, 3vw, 36px)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px 24px' }}>
            <Link className="lp-h3" to={LIEN_INSCRIPTION} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '15px 28px', borderRadius: '8px', background: '#ffa800', color: '#001744', fontWeight: '700', fontSize: '1.0625rem', boxShadow: '0 6px 16px rgba(255,168,0,.30)' }}>Rejoindre gratuitement</Link>
            <span style={{ fontSize: '0.9375rem', color: '#697386' }}>Aucun frais d'inscription · aucun abonnement · aucun stock à acheter</span>
          </div>
        </div>
      </section>
    </>
  );
}
