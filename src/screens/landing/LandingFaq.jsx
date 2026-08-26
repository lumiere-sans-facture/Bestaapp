// Questions fréquentes, en accordéon.
import { useState } from 'react';

export default function LandingFaq() {
  // Accordéon : une seule réponse ouverte à la fois, la première par défaut.
  const [ouverte, setOuverte] = useState(0);
  const basculer = (i) => setOuverte((n) => (n === i ? null : i));

  const styleReponse = (i) => ({
    overflow: 'hidden',
    maxHeight: ouverte === i ? '360px' : '0px',
    opacity: ouverte === i ? 1 : 0,
    transition: 'max-height .35s ease, opacity .25s ease',
  });
  const styleChevron = (i) => ({
    display: 'flex',
    flexShrink: 0,
    color: ouverte === i ? '#ffa800' : '#0c3483',
    transform: ouverte === i ? 'rotate(180deg)' : 'none',
    transition: 'transform .25s ease, color .2s ease',
  });

  return (
    <>
      <section id="faq" style={{ background: '#f2f5fa', borderTop: '1px solid #e3e7ef' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'clamp(48px, 6vw, 88px) clamp(20px, 5vw, 48px)' }}>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b87400', marginBottom: '14px' }}>FAQ</span>
          <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', lineHeight: '1.12', fontWeight: '800', letterSpacing: '-0.012em', margin: '0 0 clamp(24px, 3vw, 36px)' }}>Les questions qu'on nous pose</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', overflow: 'hidden' }}>
              <button type="button" onClick={() => basculer(0)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 22px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <span style={{ flex: '1', fontSize: '1.0625rem', fontWeight: '600', color: '#0c0f14' }}>Faut-il des connaissances techniques pour commencer ?</span>
                <span style={styleChevron(0)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg></span>
              </button>
              <div style={styleReponse(0)}><p style={{ margin: '0', padding: '0 22px 20px', fontSize: '0.9375rem', lineHeight: '1.65', color: '#697386' }}>Non. Votre conseiller fait le premier dimensionnement avec vous, et l'école BestaSolar reprend les bases — watts, ampères, volts — en cours de dix minutes. La plupart de nos abonnés sortent leur premier devis le jour de l'inscription.</p></div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', overflow: 'hidden' }}>
              <button type="button" onClick={() => basculer(1)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 22px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <span style={{ flex: '1', fontSize: '1.0625rem', fontWeight: '600', color: '#0c0f14' }}>Comment fonctionne l'abonnement, et puis-je résilier ?</span>
                <span style={styleChevron(1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg></span>
              </button>
              <div style={styleReponse(1)}><p style={{ margin: '0', padding: '0 22px 20px', fontSize: '0.9375rem', lineHeight: '1.65', color: '#697386' }}>Le compte gratuit n'expire jamais : dimensionnement, devis et suivi clients restent ouverts sans abonnement. L'abonnement Pro, lui, sert uniquement à personnaliser vos devis ; il couvre 30 jours, ne se renouvelle que si vous le décidez, et vous recevez une alerte trois jours avant l'échéance. Aucune durée minimale, aucun frais de résiliation.</p></div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', overflow: 'hidden' }}>
              <button type="button" onClick={() => basculer(2)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 22px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <span style={{ flex: '1', fontSize: '1.0625rem', fontWeight: '600', color: '#0c0f14' }}>Que fait exactement mon conseiller ?</span>
                <span style={styleChevron(2)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg></span>
              </button>
              <div style={styleReponse(2)}><p style={{ margin: '0', padding: '0 22px 20px', fontSize: '0.9375rem', lineHeight: '1.65', color: '#697386' }}>Il vérifie vos dimensionnements avant que vous engagiez un client, relit vos devis, vous aide à choisir onduleur et batteries, et reste joignable pendant l'installation. En formule Premium, c'est toujours la même personne.</p></div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', overflow: 'hidden' }}>
              <button type="button" onClick={() => basculer(3)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 22px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <span style={{ flex: '1', fontSize: '1.0625rem', fontWeight: '600', color: '#0c0f14' }}>L'application marche-t-elle sans internet ?</span>
                <span style={styleChevron(3)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg></span>
              </button>
              <div style={styleReponse(3)}><p style={{ margin: '0', padding: '0 22px 20px', fontSize: '0.9375rem', lineHeight: '1.65', color: '#697386' }}>Oui. Tout est enregistré sur votre téléphone ou votre ordinateur et fonctionne hors connexion. Dès que le réseau revient, vos données rejoignent celles de l'équipe, sans double saisie.</p></div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', overflow: 'hidden' }}>
              <button type="button" onClick={() => basculer(4)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 22px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <span style={{ flex: '1', fontSize: '1.0625rem', fontWeight: '600', color: '#0c0f14' }}>Comment sont calculées mes commissions de parrainage ?</span>
                <span style={styleChevron(4)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg></span>
              </button>
              <div style={styleReponse(4)}><p style={{ margin: '0', padding: '0 22px 20px', fontSize: '0.9375rem', lineHeight: '1.65', color: '#697386' }}>Vous touchez 3 % sur les ventes de vos filleuls directs et 1,5 % sur celles de leurs propres filleuls. Exemple : un kit vendu à 1 850 000 F vous rapporte 55 500 F. Le paiement se fait par Mobile Money après validation.</p></div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #e3e7ef', borderRadius: '12px', overflow: 'hidden' }}>
              <button type="button" onClick={() => basculer(5)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 22px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <span style={{ flex: '1', fontSize: '1.0625rem', fontWeight: '600', color: '#0c0f14' }}>Mes devis et factures sont-ils conformes ?</span>
                <span style={styleChevron(5)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg></span>
              </button>
              <div style={styleReponse(5)}><p style={{ margin: '0', padding: '0 22px 20px', fontSize: '0.9375rem', lineHeight: '1.65', color: '#697386' }}>Les documents portent votre en-tête, vos coordonnées et vos conditions de règlement. Les prix sont affichés nets, sans ligne de taxe. Les acomptes se suivent un par un jusqu'au paiement complet.</p></div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
