// Le service : les quatre étapes du conseiller, puis les schémas de
// principe des quatre architectures (hybride, secours, site isolé, pompage).
import { useState } from 'react';

export default function LandingConseiller() {
  // Onglet de schéma affiché — un seul panneau visible à la fois.
  const [systeme, setSysteme] = useState(0);

  const styleOnglet = (i) => ({
    font: '600 0.875rem/1.2 Inter, "Helvetica Neue", Helvetica, Arial, sans-serif',
    padding: '10px 18px',
    borderRadius: '999px',
    cursor: 'pointer',
    transition: 'background 120ms cubic-bezier(.2,.6,.2,1), color 120ms cubic-bezier(.2,.6,.2,1), border-color 120ms cubic-bezier(.2,.6,.2,1)',
    border: i === systeme ? '1px solid #0c3483' : '1px solid #e3e7ef',
    background: i === systeme ? '#0c3483' : '#ffffff',
    color: i === systeme ? '#ffffff' : '#697386',
    boxShadow: i === systeme ? '0 6px 16px rgba(12,52,131,.24)' : 'none',
  });
  const stylePanneau = (i) => ({ display: i === systeme ? 'block' : 'none' });

  return (
    <>
      <section id="conseiller" style={{ background: '#ffffff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(48px, 6vw, 88px) clamp(20px, 5vw, 48px)' }}>
          <div style={{ maxWidth: '760px', marginBottom: 'clamp(28px, 4vw, 48px)' }}>
            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b87400', marginBottom: '14px' }}>Le cœur du service</span>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', lineHeight: '1.12', fontWeight: '800', letterSpacing: '-0.012em', margin: '0 0 14px' }}>Comment travaille votre conseiller</h2>
            <p style={{ fontSize: '1.0625rem', lineHeight: '1.65', color: '#697386', margin: '0' }}>Un expert humain vous accompagne à chaque étape, du diagnostic au suivi. L'application garde la trace de tout ce qu'il fait avec vous — vous ne repartez jamais de zéro.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))', gap: '20px' }}>
            <article data-reveal="1" style={{ background: '#f2f5fa', borderRadius: '12px', padding: '24px', border: '1px solid #e3e7ef' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}><span style={{ fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b87400' }}>ÉTAPE 01</span></div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700', margin: '0 0 8px' }}>Le diagnostic</h3>
              <p style={{ fontSize: '0.9375rem', lineHeight: '1.6', color: '#697386', margin: '0' }}>Il passe voir le client, liste les appareils et calcule la consommation réelle en kWh par jour. Rien n'est estimé au hasard.</p>
            </article>
            <article data-reveal="1" style={{ background: '#f2f5fa', borderRadius: '12px', padding: '24px', border: '1px solid #e3e7ef' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}><span style={{ fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b87400' }}>ÉTAPE 02</span></div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700', margin: '0 0 8px' }}>Le dimensionnement</h3>
              <p style={{ fontSize: '0.9375rem', lineHeight: '1.6', color: '#697386', margin: '0' }}>Onduleur, panneaux, batteries : le calcul part de la consommation et des cinq heures d'ensoleillement utile du Bénin.</p>
            </article>
            <article data-reveal="1" style={{ background: '#f2f5fa', borderRadius: '12px', padding: '24px', border: '1px solid #e3e7ef' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}><span style={{ fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b87400' }}>ÉTAPE 03</span></div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700', margin: '0 0 8px' }}>Le devis clair</h3>
              <p style={{ fontSize: '0.9375rem', lineHeight: '1.6', color: '#697386', margin: '0' }}>Prix ligne par ligne, total net, validité 30 jours. Le client sait exactement ce qu'il paie avant de signer.</p>
            </article>
            <article data-reveal="1" style={{ background: '#f2f5fa', borderRadius: '12px', padding: '24px', border: '1px solid #e3e7ef' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}><span style={{ fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b87400' }}>ÉTAPE 04</span></div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700', margin: '0 0 8px' }}>Le suivi</h3>
              <p style={{ fontSize: '0.9375rem', lineHeight: '1.6', color: '#697386', margin: '0' }}>Installation, acomptes Mobile Money, relances : chaque échéance est notée, chaque encaissement enregistré.</p>
            </article>
          </div>

          <div id="schemas" style={{ marginTop: 'clamp(32px, 4vw, 56px)', background: '#f2f5fa', border: '1px solid #e3e7ef', borderRadius: '16px', padding: 'clamp(20px, 3vw, 32px)' }}>
            <div style={{ maxWidth: '720px', marginBottom: '24px' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b87400', marginBottom: '12px' }}>Schémas</span>
              <h3 style={{ fontSize: 'clamp(1.375rem, 2.2vw, 1.75rem)', lineHeight: '1.18', fontWeight: '700', letterSpacing: '-0.012em', margin: '0 0 12px', color: '#0c0f14' }}>Le système du client, dessiné avant d'être posé</h3>
              <p style={{ fontSize: '1rem', lineHeight: '1.6', color: '#697386', margin: '0' }}>Quatre architectures, quatre schémas. Votre conseiller choisit celle qui convient au site, et vous montrez au client exactement ce qu'il achète — panneau par panneau.</p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
              <button type="button" onClick={() => setSysteme(0)} style={styleOnglet(0)}>Système hybride</button>
              <button type="button" onClick={() => setSysteme(1)} style={styleOnglet(1)}>Système de secours</button>
              <button type="button" onClick={() => setSysteme(2)} style={styleOnglet(2)}>Site isolé</button>
              <button type="button" onClick={() => setSysteme(3)} style={styleOnglet(3)}>Pompage solaire</button>
            </div>

            <div style={stylePanneau(0)}>
              <div style={{ background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', padding: 'clamp(18px, 2.5vw, 28px)', overflowX: 'auto' }}>
                <div style={{ minWidth: '680px', display: 'grid', gridTemplateColumns: '1fr 0.75fr 1fr 0.75fr 1fr', alignItems: 'center', gap: '0 10px' }}>
                  <div style={{ gridColumn: '3', gridRow: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', padding: '14px 12px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)', textAlign: 'center' }}>
                    <span style={{ width: '40px', height: '40px', flexShrink: '0', borderRadius: '10px', background: '#edf1fa', color: '#0c3483', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z"></path><path d="m2 22 3-3"></path><path d="M7.5 13.5 10 11"></path><path d="M10.5 16.5 13 14"></path><path d="m18 3-4 4h6l-4 4"></path></svg></span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#0c0f14', lineHeight: '1.25' }}>Réseau SBEE</span>
                    <span style={{ fontSize: '0.75rem', color: '#697386', lineHeight: '1.3' }}>Appoint quand le soleil manque</span>
                  </div>
                  <div style={{ gridColumn: '3', gridRow: '2', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '6px 0' }}>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#98a1b4' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"></path></svg><span style={{ width: '2px', height: '20px', background: 'repeating-linear-gradient(180deg,#98a1b4 0 4px, transparent 4px 8px)' }}></span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg></span>
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#697386', whiteSpace: 'nowrap' }}>CA · deux sens</span>
                  </div>
                  <div style={{ gridColumn: '1', gridRow: '3', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', padding: '16px 12px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)', textAlign: 'center' }}>
                    <span style={{ width: '40px', height: '40px', flexShrink: '0', borderRadius: '10px', background: '#fff6e5', color: '#b87400', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="14" rx="1"></rect><rect width="7" height="7" x="3" y="14" rx="1"></rect></svg></span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#0c0f14', lineHeight: '1.25' }}>Panneaux PV</span>
                    <span style={{ fontSize: '0.75rem', color: '#697386', lineHeight: '1.3' }}>6 × 550 Wc · 3,3 kWc</span>
                  </div>
                  <div style={{ gridColumn: '2', gridRow: '3', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#0c3483', whiteSpace: 'nowrap' }}>CC → entrées MPPT</span>
                    <span style={{ display: 'flex', alignItems: 'center', width: '100%', color: '#0c3483' }}><span style={{ flex: '1', height: '2px', background: 'currentColor' }}></span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '-3px' }}><path d="m9 18 6-6-6-6"></path></svg></span>
                  </div>
                  <div style={{ gridColumn: '3', gridRow: '3', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#001744', border: '1px solid #001744', borderRadius: '12px', padding: '18px 12px', boxShadow: '0 12px 32px rgba(0,23,68,.10)', textAlign: 'center' }}>
                    <span style={{ width: '40px', height: '40px', flexShrink: '0', borderRadius: '10px', background: '#ffa800', color: '#001744', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path></svg></span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', lineHeight: '1.25' }}>Onduleur hybride (MPPT intégré)</span>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.72)', lineHeight: '1.3' }}>5 kVA · 48 V</span>
                  </div>
                  <div style={{ gridColumn: '4', gridRow: '3', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#b87400', whiteSpace: 'nowrap' }}>CA 230 V</span>
                    <span style={{ display: 'flex', alignItems: 'center', width: '100%', color: '#ffa800' }}><span style={{ flex: '1', height: '2px', background: 'currentColor' }}></span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '-3px' }}><path d="m9 18 6-6-6-6"></path></svg></span>
                  </div>
                  <div style={{ gridColumn: '5', gridRow: '3', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', padding: '16px 12px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)', textAlign: 'center' }}>
                    <span style={{ width: '40px', height: '40px', flexShrink: '0', borderRadius: '10px', background: '#edf1fa', color: '#0c3483', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg></span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#0c0f14', lineHeight: '1.25' }}>Maison ou atelier</span>
                    <span style={{ fontSize: '0.75rem', color: '#697386', lineHeight: '1.3' }}>3,8 kWh par jour</span>
                  </div>
                  <div style={{ gridColumn: '3', gridRow: '4', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '6px 0' }}>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#0c3483' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"></path></svg><span style={{ width: '2px', height: '20px', background: 'currentColor' }}></span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg></span>
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#0c3483', whiteSpace: 'nowrap' }}>CC · charge et décharge</span>
                  </div>
                  <div style={{ gridColumn: '3', gridRow: '5', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', padding: '14px 12px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)', textAlign: 'center' }}>
                    <span style={{ width: '40px', height: '40px', flexShrink: '0', borderRadius: '10px', background: '#edf1fa', color: '#0c3483', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="10" x="2" y="7" rx="2"></rect><path d="M22 11v2"></path><path d="M6 11v2"></path><path d="M10 11v2"></path></svg></span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#0c0f14', lineHeight: '1.25' }}>Batterie LiFePO4</span>
                    <span style={{ fontSize: '0.75rem', color: '#697386', lineHeight: '1.3' }}>2 × 5 kWh · 10 kWh</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px 36px', marginTop: '18px' }}>
                <div><div style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.012em', color: '#0c3483' }}>2 jours</div><div style={{ fontSize: '0.75rem', color: '#697386', marginTop: '2px' }}>d'autonomie sans soleil</div></div>
                <div><div style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.012em', color: '#0c3483' }}>85 %</div><div style={{ fontSize: '0.75rem', color: '#697386', marginTop: '2px' }}>de la facture couverte par le solaire</div></div>
                <div><div style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.012em', color: '#0c3483' }}>&lt; 20 ms</div><div style={{ fontSize: '0.75rem', color: '#697386', marginTop: '2px' }}>de bascule à la coupure</div></div>
              </div>
            </div>

            <div style={stylePanneau(1)}>
              <div style={{ background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', padding: 'clamp(18px, 2.5vw, 28px)', overflowX: 'auto' }}>
                <div style={{ minWidth: '680px', display: 'grid', gridTemplateColumns: '1fr 0.75fr 1fr 0.75fr 1fr', alignItems: 'center', gap: '0 10px' }}>
                  <div style={{ gridColumn: '3', gridRow: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', padding: '14px 12px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)', textAlign: 'center' }}>
                    <span style={{ width: '40px', height: '40px', flexShrink: '0', borderRadius: '10px', background: '#edf1fa', color: '#0c3483', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z"></path><path d="m2 22 3-3"></path><path d="M7.5 13.5 10 11"></path><path d="M10.5 16.5 13 14"></path><path d="m18 3-4 4h6l-4 4"></path></svg></span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#0c0f14', lineHeight: '1.25' }}>Réseau SBEE</span>
                    <span style={{ fontSize: '0.75rem', color: '#697386', lineHeight: '1.3' }}>Source principale du site</span>
                  </div>
                  <div style={{ gridColumn: '3', gridRow: '2', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '6px 0' }}>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#98a1b4' }}><span style={{ width: '2px', height: '26px', background: 'repeating-linear-gradient(180deg,#98a1b4 0 4px, transparent 4px 8px)' }}></span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg></span>
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#697386', whiteSpace: 'nowrap' }}>CA · recharge les batteries</span>
                  </div>
                  <div style={{ gridColumn: '1', gridRow: '3', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', padding: '16px 12px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)', textAlign: 'center' }}>
                    <span style={{ width: '40px', height: '40px', flexShrink: '0', borderRadius: '10px', background: '#fff6e5', color: '#b87400', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="14" rx="1"></rect><rect width="7" height="7" x="3" y="14" rx="1"></rect></svg></span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#0c0f14', lineHeight: '1.25' }}>Panneaux PV</span>
                    <span style={{ fontSize: '0.75rem', color: '#697386', lineHeight: '1.3' }}>4 × 550 Wc · 2,2 kWc</span>
                  </div>
                  <div style={{ gridColumn: '2', gridRow: '3', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#0c3483', whiteSpace: 'nowrap' }}>CC → entrées MPPT</span>
                    <span style={{ display: 'flex', alignItems: 'center', width: '100%', color: '#0c3483' }}><span style={{ flex: '1', height: '2px', background: 'currentColor' }}></span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '-3px' }}><path d="m9 18 6-6-6-6"></path></svg></span>
                  </div>
                  <div style={{ gridColumn: '3', gridRow: '3', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#001744', border: '1px solid #001744', borderRadius: '12px', padding: '18px 12px', boxShadow: '0 12px 32px rgba(0,23,68,.10)', textAlign: 'center' }}>
                    <span style={{ width: '40px', height: '40px', flexShrink: '0', borderRadius: '10px', background: '#ffa800', color: '#001744', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path></svg></span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', lineHeight: '1.25' }}>Onduleur hybride (MPPT intégré)</span>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.72)', lineHeight: '1.3' }}>3 kVA · bascule automatique</span>
                  </div>
                  <div style={{ gridColumn: '4', gridRow: '3', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#b87400', whiteSpace: 'nowrap' }}>CA 230 V</span>
                    <span style={{ display: 'flex', alignItems: 'center', width: '100%', color: '#ffa800' }}><span style={{ flex: '1', height: '2px', background: 'currentColor' }}></span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '-3px' }}><path d="m9 18 6-6-6-6"></path></svg></span>
                  </div>
                  <div style={{ gridColumn: '5', gridRow: '3', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #ffd37f', borderRadius: '12px', padding: '16px 12px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)', textAlign: 'center' }}>
                    <span style={{ width: '40px', height: '40px', flexShrink: '0', borderRadius: '10px', background: '#fff6e5', color: '#b87400', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg></span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#0c0f14', lineHeight: '1.25' }}>Circuits prioritaires</span>
                    <span style={{ fontSize: '0.75rem', color: '#697386', lineHeight: '1.3' }}>Froid, éclairage, box internet</span>
                  </div>
                  <div style={{ gridColumn: '3', gridRow: '4', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '6px 0' }}>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#0c3483' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"></path></svg><span style={{ width: '2px', height: '20px', background: 'currentColor' }}></span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg></span>
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#0c3483', whiteSpace: 'nowrap' }}>CC · réserve de coupure</span>
                  </div>
                  <div style={{ gridColumn: '3', gridRow: '5', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', padding: '14px 12px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)', textAlign: 'center' }}>
                    <span style={{ width: '40px', height: '40px', flexShrink: '0', borderRadius: '10px', background: '#edf1fa', color: '#0c3483', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="10" x="2" y="7" rx="2"></rect><path d="M22 11v2"></path><path d="M6 11v2"></path><path d="M10 11v2"></path></svg></span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#0c0f14', lineHeight: '1.25' }}>Batterie LiFePO4</span>
                    <span style={{ fontSize: '0.75rem', color: '#697386', lineHeight: '1.3' }}>1 × 5 kWh</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px 36px', marginTop: '18px' }}>
                <div><div style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.012em', color: '#0c3483' }}>6 heures</div><div style={{ fontSize: '0.75rem', color: '#697386', marginTop: '2px' }}>de coupure couvertes</div></div>
                <div><div style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.012em', color: '#0c3483' }}>2 sources</div><div style={{ fontSize: '0.75rem', color: '#697386', marginTop: '2px' }}>de recharge : solaire ou réseau</div></div>
                <div><div style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.012em', color: '#0c3483' }}>1 seul tableau</div><div style={{ fontSize: '0.75rem', color: '#697386', marginTop: '2px' }}>les autres circuits restent inchangés</div></div>
              </div>
            </div>

            <div style={stylePanneau(2)}>
              <div style={{ background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', padding: 'clamp(18px, 2.5vw, 28px)', overflowX: 'auto' }}>
                <div style={{ minWidth: '700px', display: 'grid', gridTemplateColumns: '1fr 0.8fr 1fr 0.8fr 1fr', alignItems: 'center', gap: '0 10px' }}>
                  <div style={{ gridColumn: '1 / -1', gridRow: '1', display: 'flex', justifyContent: 'center', paddingBottom: '14px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '999px', background: '#f2f5fa', border: '1px solid #e3e7ef', color: '#697386', fontSize: '0.75rem', fontWeight: '600' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"></path><path d="m4.93 4.93 14.14 14.14"></path><circle cx="12" cy="12" r="10"></circle></svg>Aucun raccordement au réseau</span>
                  </div>
                  <div style={{ gridColumn: '1', gridRow: '2', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', padding: '16px 10px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)', textAlign: 'center' }}>
                    <span style={{ width: '40px', height: '40px', flexShrink: '0', borderRadius: '10px', background: '#fff6e5', color: '#b87400', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="14" rx="1"></rect><rect width="7" height="7" x="3" y="14" rx="1"></rect></svg></span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#0c0f14', lineHeight: '1.25' }}>Champ PV</span>
                    <span style={{ fontSize: '0.75rem', color: '#697386', lineHeight: '1.3' }}>8 × 550 Wc · 4,4 kWc</span>
                  </div>
                  <div style={{ gridColumn: '2', gridRow: '2', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#0c3483', whiteSpace: 'nowrap' }}>CC → entrées MPPT</span>
                    <span style={{ display: 'flex', alignItems: 'center', width: '100%', color: '#0c3483' }}><span style={{ flex: '1', height: '2px', background: 'currentColor' }}></span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '-3px' }}><path d="m9 18 6-6-6-6"></path></svg></span>
                  </div>
                  <div style={{ gridColumn: '3', gridRow: '2', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#001744', border: '1px solid #001744', borderRadius: '12px', padding: '18px 10px', boxShadow: '0 12px 32px rgba(0,23,68,.10)', textAlign: 'center' }}>
                    <span style={{ width: '40px', height: '40px', flexShrink: '0', borderRadius: '10px', background: '#ffa800', color: '#001744', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path></svg></span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', lineHeight: '1.25' }}>Onduleur hybride (MPPT intégré)</span>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.72)', lineHeight: '1.3' }}>5 kVA · 230 V · 48 V</span>
                  </div>
                  <div style={{ gridColumn: '4', gridRow: '2', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#b87400', whiteSpace: 'nowrap' }}>CA 230 V</span>
                    <span style={{ display: 'flex', alignItems: 'center', width: '100%', color: '#ffa800' }}><span style={{ flex: '1', height: '2px', background: 'currentColor' }}></span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '-3px' }}><path d="m9 18 6-6-6-6"></path></svg></span>
                  </div>
                  <div style={{ gridColumn: '5', gridRow: '2', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', padding: '16px 10px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)', textAlign: 'center' }}>
                    <span style={{ width: '40px', height: '40px', flexShrink: '0', borderRadius: '10px', background: '#edf1fa', color: '#0c3483', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg></span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#0c0f14', lineHeight: '1.25' }}>Charges du site</span>
                    <span style={{ fontSize: '0.75rem', color: '#697386', lineHeight: '1.3' }}>6,5 kWh par jour</span>
                  </div>
                  <div style={{ gridColumn: '2 / 5', gridRow: '3', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '6px 0' }}>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#0c3483' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"></path></svg><span style={{ width: '2px', height: '20px', background: 'currentColor' }}></span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg></span>
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#0c3483', whiteSpace: 'nowrap' }}>Parc batteries 48 V</span>
                  </div>
                  <div style={{ gridColumn: '2 / 5', gridRow: '4', display: 'flex', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', padding: '14px 18px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)', textAlign: 'center' }}>
                      <span style={{ width: '40px', height: '40px', flexShrink: '0', borderRadius: '10px', background: '#edf1fa', color: '#0c3483', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="10" x="2" y="7" rx="2"></rect><path d="M22 11v2"></path><path d="M6 11v2"></path><path d="M10 11v2"></path></svg></span>
                      <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#0c0f14', lineHeight: '1.25' }}>Batterie LiFePO4</span>
                      <span style={{ fontSize: '0.75rem', color: '#697386', lineHeight: '1.3' }}>3 × 5 kWh · 15 kWh utiles</span>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px 36px', marginTop: '18px' }}>
                <div><div style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.012em', color: '#0c3483' }}>3 jours</div><div style={{ fontSize: '0.75rem', color: '#697386', marginTop: '2px' }}>d'autonomie en saison des pluies</div></div>
                <div><div style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.012em', color: '#0c3483' }}>1 boîtier</div><div style={{ fontSize: '0.75rem', color: '#697386', marginTop: '2px' }}>MPPT intégré : un régulateur en moins</div></div>
                <div><div style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.012em', color: '#0c3483' }}>0 litre</div><div style={{ fontSize: '0.75rem', color: '#697386', marginTop: '2px' }}>de carburant par mois</div></div>
              </div>
            </div>

            <div style={stylePanneau(3)}>
              <div style={{ background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', padding: 'clamp(18px, 2.5vw, 28px)', overflowX: 'auto' }}>
                <div style={{ minWidth: '680px', display: 'grid', gridTemplateColumns: '1fr 0.75fr 1fr 0.75fr 1fr', alignItems: 'center', gap: '0 10px' }}>
                  <div style={{ gridColumn: '5', gridRow: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #ffd37f', borderRadius: '12px', padding: '14px 12px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)', textAlign: 'center' }}>
                    <span style={{ width: '40px', height: '40px', flexShrink: '0', borderRadius: '10px', background: '#fff6e5', color: '#b87400', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5V19A9 3 0 0 0 21 19V5"></path><path d="M3 12A9 3 0 0 0 21 12"></path></svg></span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#0c0f14', lineHeight: '1.25' }}>Château d'eau</span>
                    <span style={{ fontSize: '0.75rem', color: '#697386', lineHeight: '1.3' }}>5 000 L · le stockage du système</span>
                  </div>
                  <div style={{ gridColumn: '5', gridRow: '2', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '6px 0' }}>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#ffa800' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"></path></svg><span style={{ width: '2px', height: '20px', background: 'currentColor' }}></span></span>
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#b87400', whiteSpace: 'nowrap' }}>Eau refoulée</span>
                  </div>
                  <div style={{ gridColumn: '1', gridRow: '3', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', padding: '16px 12px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)', textAlign: 'center' }}>
                    <span style={{ width: '40px', height: '40px', flexShrink: '0', borderRadius: '10px', background: '#fff6e5', color: '#b87400', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="14" rx="1"></rect><rect width="7" height="7" x="3" y="14" rx="1"></rect></svg></span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#0c0f14', lineHeight: '1.25' }}>Panneaux PV</span>
                    <span style={{ fontSize: '0.75rem', color: '#697386', lineHeight: '1.3' }}>6 × 550 Wc · 3,3 kWc</span>
                  </div>
                  <div style={{ gridColumn: '2', gridRow: '3', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#0c3483', whiteSpace: 'nowrap' }}>CC → entrées MPPT</span>
                    <span style={{ display: 'flex', alignItems: 'center', width: '100%', color: '#0c3483' }}><span style={{ flex: '1', height: '2px', background: 'currentColor' }}></span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '-3px' }}><path d="m9 18 6-6-6-6"></path></svg></span>
                  </div>
                  <div style={{ gridColumn: '3', gridRow: '3', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#001744', border: '1px solid #001744', borderRadius: '12px', padding: '18px 12px', boxShadow: '0 12px 32px rgba(0,23,68,.10)', textAlign: 'center' }}>
                    <span style={{ width: '40px', height: '40px', flexShrink: '0', borderRadius: '10px', background: '#ffa800', color: '#001744', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path></svg></span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ffffff', lineHeight: '1.25' }}>Variateur de pompe</span>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.72)', lineHeight: '1.3' }}>3 kW · démarrage progressif</span>
                  </div>
                  <div style={{ gridColumn: '4', gridRow: '3', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#b87400', whiteSpace: 'nowrap' }}>CA variable</span>
                    <span style={{ display: 'flex', alignItems: 'center', width: '100%', color: '#ffa800' }}><span style={{ flex: '1', height: '2px', background: 'currentColor' }}></span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '-3px' }}><path d="m9 18 6-6-6-6"></path></svg></span>
                  </div>
                  <div style={{ gridColumn: '5', gridRow: '3', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', padding: '16px 12px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)', textAlign: 'center' }}>
                    <span style={{ width: '40px', height: '40px', flexShrink: '0', borderRadius: '10px', background: '#edf1fa', color: '#0c3483', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"></path><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"></path></svg></span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#0c0f14', lineHeight: '1.25' }}>Pompe immergée</span>
                    <span style={{ fontSize: '0.75rem', color: '#697386', lineHeight: '1.3' }}>2,2 kW · forage 60 m</span>
                  </div>
                  <div style={{ gridColumn: '1 / -1', gridRow: '4', display: 'flex', justifyContent: 'center', paddingTop: '16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '999px', background: '#f2f5fa', border: '1px solid #e3e7ef', color: '#697386', fontSize: '0.75rem', fontWeight: '600' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="10" x="2" y="7" rx="2"></rect><path d="M22 11v2"></path><path d="m2 2 20 20"></path></svg>Sans batterie : l'eau stockée remplace le stockage électrique</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px 36px', marginTop: '18px' }}>
                <div><div style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.012em', color: '#0c3483' }}>25 m³</div><div style={{ fontSize: '0.75rem', color: '#697386', marginTop: '2px' }}>d'eau remontés par jour ensoleillé</div></div>
                <div><div style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.012em', color: '#0c3483' }}>60 m</div><div style={{ fontSize: '0.75rem', color: '#697386', marginTop: '2px' }}>de hauteur de refoulement</div></div>
                <div><div style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.012em', color: '#0c3483' }}>0 F</div><div style={{ fontSize: '0.75rem', color: '#697386', marginTop: '2px' }}>de carburant : la pompe suit le soleil</div></div>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 24px', marginTop: '22px', paddingTop: '18px', borderTop: '1px solid #e3e7ef' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#697386' }}><span style={{ width: '22px', height: '2px', background: '#0c3483' }}></span>Courant continu</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#697386' }}><span style={{ width: '22px', height: '2px', background: '#ffa800' }}></span>Courant alternatif 230 V</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#697386' }}><span style={{ width: '22px', height: '2px', background: 'repeating-linear-gradient(90deg,#98a1b4 0 4px, transparent 4px 8px)' }}></span>Réseau SBEE</span>
              <span style={{ fontSize: '0.75rem', color: '#98a1b4', marginLeft: 'auto' }}>Valeurs d'exemple : votre conseiller recalcule tout à partir du relevé du site.</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
