// Bande de chiffres clés, juste sous l'accueil.

export default function LandingChiffres() {
  return (
    <>
      <section style={{ background: '#001744', color: '#ffffff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(28px, 3.5vw, 44px) clamp(20px, 5vw, 48px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '28px' }}>
          <div><div style={{ fontSize: 'clamp(1.6rem, 2.4vw, 2.1rem)', fontWeight: '800', letterSpacing: '-0.012em', color: '#ffa800' }}>0 F</div><div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>Dimensionnement, devis et suivi clients</div></div>
          <div><div style={{ fontSize: 'clamp(1.6rem, 2.4vw, 2.1rem)', fontWeight: '800', letterSpacing: '-0.012em', color: '#ffa800' }}>5 min</div><div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>Pour sortir un devis PDF prêt à signer</div></div>
          <div><div style={{ fontSize: 'clamp(1.6rem, 2.4vw, 2.1rem)', fontWeight: '800', letterSpacing: '-0.012em', color: '#ffa800' }}>3 % + 1,5 %</div><div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>Commissions de parrainage sur deux niveaux</div></div>
          <div><div style={{ fontSize: 'clamp(1.6rem, 2.4vw, 2.1rem)', fontWeight: '800', letterSpacing: '-0.012em', color: '#ffa800' }}>Hors ligne</div><div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>Vos données restent sur l'appareil, puis se synchronisent</div></div>
        </div>
      </section>
    </>
  );
}
