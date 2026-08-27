// Barre de navigation de la page publique : ancres vers les sections,
// connexion pour qui a déjà un compte, inscription pour les autres.
import { Link } from 'react-router-dom';
import { LIEN_CONNEXION, LIEN_INSCRIPTION } from './constantes';

export default function LandingEntete() {
  return (
    <>
      <header style={{ position: 'sticky', top: '0', zIndex: '60', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #e3e7ef' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '12px clamp(20px, 5vw, 48px)', display: 'flex', alignItems: 'center', gap: '24px' }}>
          <a href="#accueil" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: 'auto' }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <img src="/besta-solar-pro-logo.png" alt="BESTA SOLAR PRO" style={{ height: '30px', width: 'auto', display: 'block' }} />
              <span className="lp-nav-slogan" style={{ fontSize: '0.6875rem', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#98a1b4' }}>lumière sans facture</span>
            </span>
          </a>
          <nav style={{ display: 'flex', alignItems: 'center', gap: '22px', flexWrap: 'wrap' }}>
            {/* Les ancres de section disparaissent sous 900 px : sur un téléphone,
                sept liens repliés mangeaient trois lignes d’en-tête. */}
            <span className="lp-nav-liens">
              <a className="lp-h1" href="#accueil" style={{ fontSize: '0.9375rem', fontWeight: '500', color: '#697386' }}>Accueil</a>
              <a className="lp-h1" href="#avantages" style={{ fontSize: '0.9375rem', fontWeight: '500', color: '#697386' }}>Avantages</a>
              <a className="lp-h1" href="#conseiller" style={{ fontSize: '0.9375rem', fontWeight: '500', color: '#697386' }}>Conseiller</a>
              <a className="lp-h1" href="#schemas" style={{ fontSize: '0.9375rem', fontWeight: '500', color: '#697386' }}>Schémas</a>
              <a className="lp-h1" href="#tarifs" style={{ fontSize: '0.9375rem', fontWeight: '500', color: '#697386' }}>Tarifs</a>
              <a className="lp-h1" href="#carriere" style={{ fontSize: '0.9375rem', fontWeight: '500', color: '#697386' }}>Carrière</a>
              <a className="lp-h1" href="#faq" style={{ fontSize: '0.9375rem', fontWeight: '500', color: '#697386' }}>FAQ</a>
            </span>
            {/* Deux portes, jamais confondues : « Se connecter » discret pour
                celui qui a déjà un compte, « Commencer » plein pour celui qui
                n'en a pas. Il reste visible sur téléphone — un abonné qui
                arrive par la vitrine doit pouvoir entrer. */}
            <Link className="lp-h4 lp-nav-connexion" to={LIEN_CONNEXION} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: '1px solid #e3e7ef', background: '#ffffff', color: '#0c0f14', fontWeight: '600', fontSize: '0.9375rem', whiteSpace: 'nowrap' }}>Se connecter</Link>
            <Link className="lp-h2 lp-nav-inscription" to={LIEN_INSCRIPTION} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px 18px', borderRadius: '8px', background: '#0c3483', color: '#ffffff', fontWeight: '600', fontSize: '0.9375rem' }}>Commencer</Link>
          </nav>
        </div>
      </header>
    </>
  );
}
