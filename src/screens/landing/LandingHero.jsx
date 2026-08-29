// Bandeau d'accueil : promesse, appels à l'action et aperçu du tableau de
// bord tel qu'il apparaît sur grand écran.
import { Link } from 'react-router-dom';
import { LIEN_INSCRIPTION, OFFRE_LANCEMENT } from './constantes';

export default function LandingHero() {
  return (
    <>
      <section id="accueil" style={{ background: 'linear-gradient(180deg,#fff6e5 0%,#ffffff 100%)', borderBottom: '1px solid #e3e7ef', overflow: 'hidden' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(40px, 6vw, 76px) clamp(20px, 5vw, 48px) clamp(36px, 5vw, 64px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(400px, 100%), 1fr))', gap: 'clamp(32px, 4vw, 56px)', alignItems: 'center' }}>
          <div>
            {OFFRE_LANCEMENT && (<>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '999px', background: '#ffe9bf', border: '1px solid #ffd37f', color: '#b87400', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.02em', marginBottom: '18px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="M2 12h2"></path><path d="M20 12h2"></path></svg>
                Gratuit, sans limite de durée
              </span>
            </>)}
            <h1 style={{ fontSize: 'clamp(2.1rem, 4.4vw, 3.4rem)', lineHeight: '1.06', fontWeight: '800', letterSpacing: '-0.022em', margin: '0 0 18px', color: '#0c0f14' }}>Vendez plus de solaire, sans perdre un seul client en route.</h1>
            <p style={{ fontSize: 'clamp(1.0625rem, 1.4vw, 1.1875rem)', lineHeight: '1.6', color: '#697386', margin: '0 0 28px', maxWidth: '34em' }}>BestaSolar Pro suit chacun de vos clients du premier appel à la facture payée — et un conseiller solaire vous accompagne pour dimensionner, chiffrer et installer juste, du premier jour.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '26px' }}>
              <Link className="lp-h3" to={LIEN_INSCRIPTION} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '15px 28px', borderRadius: '8px', background: '#ffa800', color: '#001744', fontWeight: '700', fontSize: '1.0625rem', boxShadow: '0 6px 16px rgba(255,168,0,.30)' }}>Démarrer maintenant</Link>
              <a className="lp-h4" href="#tarifs" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '15px 28px', borderRadius: '8px', background: 'transparent', border: '1px solid #e3e7ef', color: '#0c0f14', fontWeight: '600', fontSize: '1.0625rem' }}>Voir les tarifs</a>
            </div>
            <ul style={{ listStyle: 'none', margin: '0', padding: '0', display: 'flex', flexWrap: 'wrap', gap: '10px 22px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: '500', color: '#697386' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>Gratuit pour commencer</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: '500', color: '#697386' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>Conseillers certifiés</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: '500', color: '#697386' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>Sans engagement</li>
            </ul>
          </div>

          <div data-reveal="1" style={{ position: 'relative' }}>
            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px', border: '1px solid #e3e7ef', boxShadow: '0 24px 60px rgba(0,23,68,.14)', background: '#f2f5fa', width: '661px', maxWidth: '100%', height: '432px' }}>
              <div style={{ width: '1180px', height: '800px', transform: 'scale(0.56)', transformOrigin: 'top left', display: 'flex', background: '#f2f5fa' }}>
                <aside style={{ width: '264px', flexShrink: '0', background: '#001744', color: '#ffffff', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '22px 20px' }}>
                    <div style={{ width: '42px', height: '42px', flexShrink: '0', background: '#ffa800', color: '#001744', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '1rem' }}>BestaSolar Pro</div>
                      <div style={{ fontSize: '0.75rem', opacity: '0.6' }}>Parakou, Bénin</div>
                    </div>
                  </div>
                  <nav style={{ flex: '1', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '8px', background: '#00297c', color: '#ffffff', fontSize: '0.9375rem', fontWeight: '500' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"></rect><rect width="7" height="5" x="14" y="3" rx="1"></rect><rect width="7" height="9" x="14" y="12" rx="1"></rect><rect width="7" height="5" x="3" y="16" rx="1"></rect></svg>Tableau de bord</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '8px', color: 'rgba(255,255,255,0.65)', fontSize: '0.9375rem', fontWeight: '500' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path><path d="M8 10v4"></path><path d="M12 10v2"></path><path d="M16 10v6"></path></svg>Suivi clients</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '8px', color: 'rgba(255,255,255,0.65)', fontSize: '0.9375rem', fontWeight: '500' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>Clients</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '8px', color: 'rgba(255,255,255,0.65)', fontSize: '0.9375rem', fontWeight: '500' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg>Boutique</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '8px', color: 'rgba(255,255,255,0.65)', fontSize: '0.9375rem', fontWeight: '500' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg>Devis</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '8px', color: 'rgba(255,255,255,0.65)', fontSize: '0.9375rem', fontWeight: '500' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path></svg>Équipe</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '8px', color: 'rgba(255,255,255,0.65)', fontSize: '0.9375rem', fontWeight: '500' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="m8.59 13.51 6.83 3.98"></path><path d="m15.41 6.51-6.82 3.98"></path></svg>Partenaires</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '8px', color: 'rgba(255,255,255,0.65)', fontSize: '0.9375rem', fontWeight: '500' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>Commissions</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '8px', color: 'rgba(255,255,255,0.65)', fontSize: '0.9375rem', fontWeight: '500' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6"></path><path d="M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>Formation</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '8px', color: '#e09000', fontSize: '0.9375rem', fontWeight: '600' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"></path><path d="M5 21h14"></path></svg>Passer en mode Pro</span>
                  </nav>
                  <div style={{ padding: '14px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '38px', height: '38px', flexShrink: '0', background: '#ffa800', color: '#001744', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '0.875rem' }}>AA</div>
                    <div style={{ flex: '1', minWidth: '0' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>Adam Adébiyi</div>
                      <div style={{ fontSize: '0.75rem', opacity: '0.6' }}>Gérant</div>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.6)', display: 'flex', padding: '8px' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="m16 17 5-5-5-5"></path><path d="M21 12H9"></path></svg></span>
                  </div>
                </aside>

                <div style={{ flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ background: '#0c3483', color: '#ffffff', padding: '16px 32px' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>Bonjour, Adam</div>
                    <div style={{ fontSize: '0.8125rem', opacity: '0.75', marginTop: '2px' }}>lundi 10 août</div>
                  </div>
                  <div style={{ padding: '32px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#ffffff', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)' }}><span style={{ width: '42px', height: '42px', flexShrink: '0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.0625rem', fontWeight: '700', background: '#edf1fa', color: '#0c3483' }}>6</span><span style={{ fontSize: '0.8125rem', color: '#697386', lineHeight: '1.25' }}>Pistes actives</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#ffffff', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)' }}><span style={{ width: '42px', height: '42px', flexShrink: '0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.0625rem', fontWeight: '700', background: '#ffa800', color: '#0c3483' }}>2</span><span style={{ fontSize: '0.8125rem', color: '#697386', lineHeight: '1.25' }}>Nouvelles · 7j</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#ffffff', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)' }}><span style={{ width: '42px', height: '42px', flexShrink: '0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.0625rem', fontWeight: '700', background: '#fff6e5', color: '#b87400' }}>3</span><span style={{ fontSize: '0.8125rem', color: '#697386', lineHeight: '1.25' }}>À relancer</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#ffffff', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)' }}><span style={{ width: '42px', height: '42px', flexShrink: '0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.0625rem', fontWeight: '700', background: '#e6f5ee', color: '#17845a' }}>2</span><span style={{ fontSize: '0.8125rem', color: '#697386', lineHeight: '1.25' }}>Gagnées · ce mois</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#ffffff', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)' }}><span style={{ width: '42px', height: '42px', flexShrink: '0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.0625rem', fontWeight: '700', background: '#edf1fa', color: '#0c3483' }}>4</span><span style={{ fontSize: '0.8125rem', color: '#697386', lineHeight: '1.25' }}>Devis · ce mois</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#ffffff', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)' }}><span style={{ width: '42px', height: '42px', flexShrink: '0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.0625rem', fontWeight: '700', background: '#fdecea', color: '#d92d20' }}>5</span><span style={{ fontSize: '0.8125rem', color: '#697386', lineHeight: '1.25' }}>Alertes stock</span></div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px', alignItems: 'start', marginBottom: '20px' }}>
                      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#0c3483', boxShadow: '0 0 0 4px rgba(12,52,131,.10)' }}></span>
                          <span style={{ fontSize: '0.9375rem', fontWeight: '600' }}>Activité commerciale</span>
                          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#98a1b4' }}>6 derniers mois</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '200px' }}>
                          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%' }}><div style={{ flex: '1', display: 'flex', gap: '4px', alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}><div style={{ width: '14px', borderRadius: '3px 3px 0 0', background: '#00297c', height: '53%' }}></div><div style={{ width: '14px', borderRadius: '3px 3px 0 0', background: '#17845a', height: '13%' }}></div></div><div style={{ fontSize: '0.6875rem', color: '#98a1b4' }}>Jan</div></div>
                          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%' }}><div style={{ flex: '1', display: 'flex', gap: '4px', alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}><div style={{ width: '14px', borderRadius: '3px 3px 0 0', background: '#00297c', height: '80%' }}></div><div style={{ width: '14px', borderRadius: '3px 3px 0 0', background: '#17845a', height: '20%' }}></div></div><div style={{ fontSize: '0.6875rem', color: '#98a1b4' }}>Fév</div></div>
                          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%' }}><div style={{ flex: '1', display: 'flex', gap: '4px', alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}><div style={{ width: '14px', borderRadius: '3px 3px 0 0', background: '#00297c', height: '40%' }}></div><div style={{ width: '14px', borderRadius: '3px 3px 0 0', background: '#17845a', height: '13%' }}></div></div><div style={{ fontSize: '0.6875rem', color: '#98a1b4' }}>Mars</div></div>
                          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%' }}><div style={{ flex: '1', display: 'flex', gap: '4px', alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}><div style={{ width: '14px', borderRadius: '3px 3px 0 0', background: '#00297c', height: '100%' }}></div><div style={{ width: '14px', borderRadius: '3px 3px 0 0', background: '#17845a', height: '27%' }}></div></div><div style={{ fontSize: '0.6875rem', color: '#98a1b4' }}>Avr</div></div>
                          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%' }}><div style={{ flex: '1', display: 'flex', gap: '4px', alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}><div style={{ width: '14px', borderRadius: '3px 3px 0 0', background: '#00297c', height: '67%' }}></div><div style={{ width: '14px', borderRadius: '3px 3px 0 0', background: '#17845a', height: '20%' }}></div></div><div style={{ fontSize: '0.6875rem', color: '#98a1b4' }}>Mai</div></div>
                          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%' }}><div style={{ flex: '1', display: 'flex', gap: '4px', alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}><div style={{ width: '14px', borderRadius: '3px 3px 0 0', background: '#00297c', height: '53%' }}></div><div style={{ width: '14px', borderRadius: '3px 3px 0 0', background: '#17845a', height: '13%' }}></div></div><div style={{ fontSize: '0.6875rem', color: '#98a1b4' }}>Juin</div></div>
                        </div>
                        <div style={{ display: 'flex', gap: '18px', marginTop: '14px', alignItems: 'center' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#697386' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#00297c' }}></span>Pistes créées</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#697386' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#17845a' }}></span>Gagnées</span>
                          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#697386' }}>CA gagné : <strong style={{ color: '#0c3483' }}>13 230 000 F</strong></span>
                        </div>
                      </div>

                      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#d92d20', boxShadow: '0 0 0 4px rgba(217,45,32,.16)' }}></span>
                          <span style={{ fontSize: '0.9375rem', fontWeight: '600' }}>Alertes récentes</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #e3e7ef' }}><span style={{ fontSize: '0.625rem', fontWeight: '700', letterSpacing: '0.03em', padding: '3px 7px', borderRadius: '6px', minWidth: '64px', textAlign: 'center', background: '#fff6e5', color: '#b87400' }}>ALERTE</span><div style={{ minWidth: '0' }}><div style={{ fontSize: '0.8125rem', fontWeight: '600' }}>Sans activité depuis 9 j</div><div style={{ fontSize: '0.75rem', color: '#697386' }}>Hôtel du Parc</div></div></div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #e3e7ef' }}><span style={{ fontSize: '0.625rem', fontWeight: '700', letterSpacing: '0.03em', padding: '3px 7px', borderRadius: '6px', minWidth: '64px', textAlign: 'center', background: '#fff6e5', color: '#b87400' }}>ALERTE</span><div style={{ minWidth: '0' }}><div style={{ fontSize: '0.8125rem', fontWeight: '600' }}>2 progression(s) client à valider</div><div style={{ fontSize: '0.75rem', color: '#697386' }}>Suivi clients</div></div></div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #e3e7ef' }}><span style={{ fontSize: '0.625rem', fontWeight: '700', letterSpacing: '0.03em', padding: '3px 7px', borderRadius: '6px', minWidth: '64px', textAlign: 'center', background: '#edf1fa', color: '#0c3483' }}>INFO</span><div style={{ minWidth: '0' }}><div style={{ fontSize: '0.8125rem', fontWeight: '600' }}>1 commission(s) à payer</div><div style={{ fontSize: '0.75rem', color: '#697386' }}>55 500 F</div></div></div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0' }}><span style={{ fontSize: '0.625rem', fontWeight: '700', letterSpacing: '0.03em', padding: '3px 7px', borderRadius: '6px', minWidth: '64px', textAlign: 'center', background: '#edf1fa', color: '#0c3483' }}>INFO</span><div style={{ minWidth: '0' }}><div style={{ fontSize: '0.8125rem', fontWeight: '600' }}>Abonnement Devis Pro expire dans 5 j</div><div style={{ fontSize: '0.75rem', color: '#697386' }}>À renouveler</div></div></div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
                      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ffa800', boxShadow: '0 0 0 4px rgba(255,168,0,.18)' }}></span>
                          <span style={{ fontSize: '0.9375rem', fontWeight: '600' }}>Indicateurs clés</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-around', gap: '16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                            <div style={{ position: 'relative', width: '104px', height: '104px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="104" height="104" viewBox="0 0 104 104"><circle cx="52" cy="52" r="46.5" fill="none" stroke="#e3e7ef" strokeWidth="11"></circle><circle cx="52" cy="52" r="46.5" fill="none" stroke="#0c3483" strokeWidth="11" strokeLinecap="round" strokeDasharray="292.2" strokeDashoffset="219.2" transform="rotate(-90 52 52)"></circle></svg>
                              <div style={{ position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0c3483' }}>25%</span></div>
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: '#697386', fontWeight: '600' }}>Taux de conversion</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                            <div style={{ position: 'relative', width: '104px', height: '104px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="104" height="104" viewBox="0 0 104 104"><circle cx="52" cy="52" r="46.5" fill="none" stroke="#e3e7ef" strokeWidth="11"></circle><circle cx="52" cy="52" r="46.5" fill="none" stroke="#17845a" strokeWidth="11" strokeLinecap="round" strokeDasharray="292.2" strokeDashoffset="49.7" transform="rotate(-90 52 52)"></circle></svg>
                              <div style={{ position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0c3483' }}>83%</span></div>
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: '#697386', fontWeight: '600' }}>Stock disponible</div>
                          </div>
                        </div>
                      </div>
                      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#17845a', boxShadow: '0 0 0 4px rgba(23,132,90,.16)' }}></span>
                          <span style={{ fontSize: '0.9375rem', fontWeight: '600' }}>Performance</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '18px' }}>
                          <span style={{ fontSize: '2.25rem', fontWeight: '700', color: '#0c3483', lineHeight: '1' }}>62<small style={{ fontSize: '1rem', color: '#98a1b4', fontWeight: '600' }}>/100</small></span>
                          <span style={{ fontSize: '0.8125rem', color: '#697386' }}>Score d'activité</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}><span style={{ fontSize: '0.8125rem', color: '#697386', width: '110px', flexShrink: '0' }}>Taux de closing</span><span style={{ flex: '1', height: '8px', background: '#f2f5fa', borderRadius: '4px', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', borderRadius: '4px', width: '25%', background: '#0c3483' }}></span></span><span style={{ fontSize: '0.8125rem', fontWeight: '700', color: '#0c3483', width: '38px', textAlign: 'right' }}>25%</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}><span style={{ fontSize: '0.8125rem', color: '#697386', width: '110px', flexShrink: '0' }}>Suivi des pistes</span><span style={{ flex: '1', height: '8px', background: '#f2f5fa', borderRadius: '4px', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', borderRadius: '4px', width: '83%', background: '#17845a' }}></span></span><span style={{ fontSize: '0.8125rem', fontWeight: '700', color: '#0c3483', width: '38px', textAlign: 'right' }}>83%</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><span style={{ fontSize: '0.8125rem', color: '#697386', width: '110px', flexShrink: '0' }}>Pipeline avancé</span><span style={{ flex: '1', height: '8px', background: '#f2f5fa', borderRadius: '4px', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', borderRadius: '4px', width: '67%', background: '#ffa800' }}></span></span><span style={{ fontSize: '0.8125rem', fontWeight: '700', color: '#0c3483', width: '38px', textAlign: 'right' }}>67%</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ position: 'absolute', inset: 'auto 0 0 0', height: '90px', background: 'linear-gradient(180deg, rgba(242,245,250,0) 0%, rgba(255,255,255,0.9) 100%)', pointerEvents: 'none' }}></div>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#98a1b4', margin: '10px 0 0' }}>Le tableau de bord BestaSolar Pro, tel qu'il apparaît sur grand écran.</p>
          </div>
        </div>
      </section>
    </>
  );
}
