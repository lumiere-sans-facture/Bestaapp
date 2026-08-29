// Les six bénéfices de l'outil.

export default function LandingAvantages() {
  return (
    <>
      <section id="avantages" style={{ background: '#f2f5fa', borderTop: '1px solid #e3e7ef', borderBottom: '1px solid #e3e7ef' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(48px, 6vw, 88px) clamp(20px, 5vw, 48px)' }}>
          <div style={{ maxWidth: '700px', marginBottom: 'clamp(28px, 4vw, 48px)' }}>
            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b87400', marginBottom: '14px' }}>Avantages</span>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', lineHeight: '1.12', fontWeight: '800', letterSpacing: '-0.012em', margin: '0' }}>Tout ce qu'il faut pour vendre et installer sans stress</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '20px' }}>
            <article className="lp-h5" data-reveal="1" style={{ background: '#ffffff', borderRadius: '12px', padding: '26px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)' }}>
              <span style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#f2f5fa', color: '#0c3483', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path><path d="M8 10v4"></path><path d="M12 10v2"></path><path d="M16 10v6"></path></svg></span>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: '700', margin: '0 0 8px' }}>Plus aucun client oublié</h3>
              <p style={{ fontSize: '0.9375rem', lineHeight: '1.6', color: '#697386', margin: '0' }}>Six étapes, du premier contact à la vente. Vous voyez d'un coup d'œil qui attend une relance et depuis combien de jours.</p>
            </article>
            <article className="lp-h5" data-reveal="1" style={{ background: '#ffffff', borderRadius: '12px', padding: '26px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)' }}>
              <span style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#f2f5fa', color: '#0c3483', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg></span>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: '700', margin: '0 0 8px' }}>Un devis pro en cinq minutes</h3>
              <p style={{ fontSize: '0.9375rem', lineHeight: '1.6', color: '#697386', margin: '0' }}>Devis et factures PDF à votre en-tête, totaux nets, conditions incluses. Le client repart avec un document sérieux.</p>
            </article>
            <article className="lp-h5" data-reveal="1" style={{ background: '#ffffff', borderRadius: '12px', padding: '26px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)' }}>
              <span style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#f2f5fa', color: '#0c3483', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg></span>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: '700', margin: '0 0 8px' }}>Le catalogue toujours à jour</h3>
              <p style={{ fontSize: '0.9375rem', lineHeight: '1.6', color: '#697386', margin: '0' }}>Panneaux, onduleurs, batteries, accessoires : prix et stock à portée de main, commandes en ligne comprises.</p>
            </article>
            <article className="lp-h5" data-reveal="1" style={{ background: '#ffffff', borderRadius: '12px', padding: '26px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)' }}>
              <span style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#f2f5fa', color: '#0c3483', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg></span>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: '700', margin: '0 0 8px' }}>Vos commissions, calculées seules</h3>
              <p style={{ fontSize: '0.9375rem', lineHeight: '1.6', color: '#697386', margin: '0' }}>3 % sur vos filleuls directs, 1,5 % sur les leurs. Chaque vente attribuée, chaque paiement Mobile Money tracé.</p>
            </article>
            <article className="lp-h5" data-reveal="1" style={{ background: '#ffffff', borderRadius: '12px', padding: '26px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)' }}>
              <span style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#f2f5fa', color: '#0c3483', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6"></path><path d="M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg></span>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: '700', margin: '0 0 8px' }}>La formation incluse</h3>
              <p style={{ fontSize: '0.9375rem', lineHeight: '1.6', color: '#697386', margin: '0' }}>Dimensionnement, sécurité sur chantier, technique de vente : des cours courts, en vidéo et en texte, dans l'application.</p>
            </article>
            <article className="lp-h5" data-reveal="1" style={{ background: '#ffffff', borderRadius: '12px', padding: '26px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)' }}>
              <span style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#f2f5fa', color: '#0c3483', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"></path><path d="m9 12 2 2 4-4"></path></svg></span>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: '700', margin: '0 0 8px' }}>Ça marche sans réseau</h3>
              <p style={{ fontSize: '0.9375rem', lineHeight: '1.6', color: '#697386', margin: '0' }}>Sur le chantier comme en brousse : tout reste sur l'appareil et se synchronise avec l'équipe dès le retour du réseau.</p>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
