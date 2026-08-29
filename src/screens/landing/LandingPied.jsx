// Pied de page : plan du site, coordonnées officielles et réseaux.
import { Link } from 'react-router-dom';
import { LIEN_INSCRIPTION, RESEAUX } from './constantes';

export default function LandingPied() {
  return (
    <>
      <footer style={{ background: '#001744', color: 'rgba(255,255,255,0.72)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(40px, 5vw, 64px) clamp(20px, 5vw, 48px) 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '32px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <img src="/besta-solar-pro-logo-blanc.png" alt="BESTA SOLAR PRO" style={{ height: '26px', width: 'auto', display: 'block' }} />
            </div>
            <p style={{ fontSize: '0.875rem', lineHeight: '1.6', margin: '0' }}>Énergie lumineuse sans facture. Kits, panneaux et solutions solaires, avec un conseiller à vos côtés.</p>
          </div>
          <div>
            <h3 style={{ fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ffffff', margin: '0 0 14px' }}>La page</h3>
            <ul style={{ listStyle: 'none', margin: '0', padding: '0', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem' }}>
              <li><a className="lp-h6" href="#avantages" style={{ color: 'rgba(255,255,255,0.72)' }}>Avantages</a></li>
              <li><a className="lp-h6" href="#conseiller" style={{ color: 'rgba(255,255,255,0.72)' }}>Nos conseillers</a></li>
              <li><a className="lp-h6" href="#tarifs" style={{ color: 'rgba(255,255,255,0.72)' }}>Tarifs</a></li>
              <li><a className="lp-h6" href="#carriere" style={{ color: 'rgba(255,255,255,0.72)' }}>Carrière et partenaires</a></li>
              <li><a className="lp-h6" href="#faq" style={{ color: 'rgba(255,255,255,0.72)' }}>FAQ</a></li>
            </ul>
          </div>
          <div>
            <h3 style={{ fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ffffff', margin: '0 0 14px' }}>Contact</h3>
            <ul style={{ listStyle: 'none', margin: '0', padding: '0', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem' }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffa800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 10c0 6-8 12-8 12s-8-6-8-10a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>Cotonou Saint Rita, République du Bénin</li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffa800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"></path></svg><a className="lp-h6" href="tel:+2290161732956" style={{ color: 'rgba(255,255,255,0.72)' }}>+229 016 173 2956</a></li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffa800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg><a className="lp-h6" href="mailto:contact@bestasolar.com" style={{ color: 'rgba(255,255,255,0.72)' }}>contact@bestasolar.com</a></li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffa800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20"></path><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"></path></svg>www.bestasolar.com</li>
            </ul>
          </div>
          <div>
            <h3 style={{ fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ffffff', margin: '0 0 14px' }}>Suivez-nous</h3>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
              {RESEAUX.whatsapp && (<a className="lp-h7" href={RESEAUX.whatsapp} aria-label="WhatsApp" style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"></path></svg></a>)}
              {RESEAUX.facebook && (<a className="lp-h7" href={RESEAUX.facebook} aria-label="Facebook" style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg></a>)}
              {RESEAUX.youtube && (<a className="lp-h7" href={RESEAUX.youtube} aria-label="YouTube" style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"></path><path d="m10 15 5-3-5-3z"></path></svg></a>)}
            </div>
            <Link className="lp-h3" to={LIEN_INSCRIPTION} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 18px', borderRadius: '8px', background: '#ffa800', color: '#001744', fontWeight: '700', fontSize: '0.9375rem' }}>Commencer</Link>
          </div>
        </div>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px clamp(20px, 5vw, 48px) 36px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexWrap: 'wrap', gap: '8px 20px', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.55)' }}>
          <span>© 2026 Besta Solar Pro</span>
          <span>Énergie lumineuse sans facture</span>
          <a className="lp-h6" href="/privacy.html" style={{ color: 'rgba(255,255,255,0.55)', marginLeft: 'auto' }}>Mentions légales et confidentialité</a>
        </div>
      </footer>
    </>
  );
}
