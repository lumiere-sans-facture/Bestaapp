// « Comment ça marche » — les trois étapes de démarrage.

export default function LandingEtapes() {
  return (
    <>
      <section style={{ background: '#ffffff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(48px, 6vw, 88px) clamp(20px, 5vw, 48px)' }}>
          <div style={{ maxWidth: '700px', marginBottom: 'clamp(28px, 4vw, 44px)' }}>
            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b87400', marginBottom: '14px' }}>Comment ça marche</span>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', lineHeight: '1.12', fontWeight: '800', letterSpacing: '-0.012em', margin: '0' }}>Trois étapes, et vous êtes en route</h2>
          </div>
          <ol style={{ listStyle: 'none', margin: '0', padding: '0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '24px' }}>
            <li data-reveal="1" style={{ borderTop: '3px solid #0c3483', paddingTop: '20px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', background: '#0c3483', color: '#ffffff', fontWeight: '800', fontSize: '1rem', marginBottom: '14px' }}>1</span>
              <h3 style={{ fontSize: '1.1875rem', fontWeight: '700', margin: '0 0 8px' }}>Décrivez votre besoin</h3>
              <p style={{ fontSize: '0.9375rem', lineHeight: '1.6', color: '#697386', margin: '0' }}>Créez votre compte en deux minutes et dites-nous ce que vous vendez, où, et à combien de clients.</p>
            </li>
            <li data-reveal="1" style={{ borderTop: '3px solid #0c3483', paddingTop: '20px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', background: '#0c3483', color: '#ffffff', fontWeight: '800', fontSize: '1rem', marginBottom: '14px' }}>2</span>
              <h3 style={{ fontSize: '1.1875rem', fontWeight: '700', margin: '0 0 8px' }}>Un conseiller vous propose la solution adaptée</h3>
              <p style={{ fontSize: '0.9375rem', lineHeight: '1.6', color: '#697386', margin: '0' }}>Il configure votre entreprise avec vous : en-tête des devis, catalogue, équipe, et le premier client à suivre.</p>
            </li>
            <li data-reveal="1" style={{ borderTop: '3px solid #ffa800', paddingTop: '20px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', background: '#ffa800', color: '#001744', fontWeight: '800', fontSize: '1rem', marginBottom: '14px' }}>3</span>
              <h3 style={{ fontSize: '1.1875rem', fontWeight: '700', margin: '0 0 8px' }}>Installation et suivi</h3>
              <p style={{ fontSize: '0.9375rem', lineHeight: '1.6', color: '#697386', margin: '0' }}>Vous vendez, vous facturez, vous encaissez. Le conseiller reste joignable, et vos chiffres se mettent à jour tout seuls.</p>
            </li>
          </ol>
        </div>
      </section>
    </>
  );
}
