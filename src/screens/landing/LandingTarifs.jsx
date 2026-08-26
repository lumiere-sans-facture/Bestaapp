// Formules d'abonnement. Le compte gratuit n'expire pas ; l'abonnement ne
// sert qu'à personnaliser les documents.
import { Link } from 'react-router-dom';
import { LIEN_INSCRIPTION, lienInscription } from './constantes';

export default function LandingTarifs() {
  return (
    <>
      <section id="tarifs" style={{ background: '#f2f5fa', borderTop: '1px solid #e3e7ef' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(48px, 6vw, 88px) clamp(20px, 5vw, 48px)' }}>
          <div style={{ maxWidth: '700px', marginBottom: 'clamp(28px, 4vw, 48px)' }}>
            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b87400', marginBottom: '14px' }}>Tarifs</span>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', lineHeight: '1.12', fontWeight: '800', letterSpacing: '-0.012em', margin: '0 0 14px' }}>Gratuit pour travailler. Payant seulement pour personnaliser.</h2>
            <p style={{ fontSize: '1.0625rem', lineHeight: '1.65', color: '#697386', margin: '0' }}>Le dimensionnement, les devis et le suivi clients sont gratuits, sans limite de durée. L'abonnement Pro sert uniquement à mettre vos devis à votre marque.</p>
          </div>
          <div className="lp-tarifs-grid">
            <article style={{ background: '#001744', color: '#ffffff', borderRadius: '12px', border: '1px solid #ffa800', padding: '30px', display: 'flex', flexDirection: 'column', gap: '18px', boxShadow: '0 24px 60px rgba(0,23,68,.14)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}><span style={{ fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Sans abonnement</span><span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800', background: '#ffa800', color: '#001744' }}>Recommandé pour démarrer</span></div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.012em', margin: '8px 0 0', color: '#ffffff' }}>Gratuit</h3>
                <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', margin: '6px 0 0' }}>Tout l'outil de travail, sans rien payer.</p>
              </div>
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 6px' }}>
                  <span style={{ fontSize: '2.75rem', fontWeight: '800', letterSpacing: '-0.022em', color: '#ffa800', lineHeight: '1', whiteSpace: 'nowrap', flexShrink: '0' }}>0</span>
                  <span style={{ fontSize: '0.9375rem', fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>F CFA</span>
                </div>
                <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', marginTop: '6px' }}>Sans limite de durée · sans carte bancaire</div>
              </div>
              <ul style={{ listStyle: 'none', margin: '0', padding: '0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.9375rem', color: 'rgba(255,255,255,0.92)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffa800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Dimensionnement complet</li>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.9375rem', color: 'rgba(255,255,255,0.92)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffa800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Génération de devis</li>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.9375rem', color: 'rgba(255,255,255,0.92)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffa800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Suivi clients illimité</li>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.9375rem', color: 'rgba(255,255,255,0.92)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffa800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Catalogue et boutique</li>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.9375rem', color: 'rgba(255,255,255,0.92)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffa800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Accès aux conseillers solaires</li>
              </ul>
              <Link className="lp-h3" to={LIEN_INSCRIPTION} style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '15px 20px', borderRadius: '8px', background: '#ffa800', color: '#001744', fontWeight: '700', fontSize: '1rem' }}>Créer mon compte</Link>
            </article>

            <article style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e3e7ef', padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#697386' }}>Pro · mensuel</div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.012em', margin: '6px 0 0' }}>Pro Essentiel</h3>
                <p style={{ fontSize: '0.875rem', color: '#697386', margin: '6px 0 0' }}>Vos devis à votre marque, au mois.</p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 6px' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.022em', color: '#0c3483', lineHeight: '1', whiteSpace: 'nowrap', flexShrink: '0' }}>5 000</span>
                <span style={{ fontSize: '0.9375rem', fontWeight: '600', color: '#697386' }}>F CFA / mois</span>
              </div>
              <ul style={{ listStyle: 'none', margin: '0', padding: '0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.9375rem', color: '#0c0f14' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Tout ce que contient Gratuit</li>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.9375rem', color: '#0c0f14' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Votre logo sur les devis</li>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.9375rem', color: '#0c0f14' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Vos couleurs et votre en-tête</li>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.9375rem', color: '#0c0f14' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Vos coordonnées d'entreprise</li>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.9375rem', color: '#0c0f14' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Export PDF à votre marque</li>
              </ul>
              <Link className="lp-h4" to={lienInscription('mensuel')} style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '13px 20px', borderRadius: '8px', border: '1px solid #e3e7ef', color: '#0c0f14', fontWeight: '600', fontSize: '0.9375rem' }}>Personnaliser</Link>
            </article>

            <article style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e3e7ef', padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#697386' }}>Pro · trimestriel</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', background: '#fff6e5', color: '#b87400' }}>−15 %</span>
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.012em', margin: '6px 0 0' }}>Pro Confort</h3>
                <p style={{ fontSize: '0.875rem', color: '#697386', margin: '6px 0 0' }}>Trois mois d'avance, et la formation en plus.</p>
              </div>
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 6px' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.022em', color: '#0c3483', lineHeight: '1', whiteSpace: 'nowrap', flexShrink: '0' }}>12 750</span>
                  <span style={{ fontSize: '0.9375rem', fontWeight: '600', color: '#697386' }}>F CFA / 3 mois</span>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#98a1b4', marginTop: '6px' }}>au lieu de <s>15 000 F CFA</s> — soit 4 250 F par mois</div>
              </div>
              <ul style={{ listStyle: 'none', margin: '0', padding: '0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.9375rem', color: '#0c0f14' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Tout ce que contient Pro Essentiel</li>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.9375rem', color: '#0c0f14' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>École BestaSolar : tous les cours</li>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.9375rem', color: '#0c0f14' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Modèles de devis supplémentaires</li>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.9375rem', color: '#0c0f14' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Support prioritaire sous 48 h</li>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.9375rem', color: '#0c0f14' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Sauvegarde automatique</li>
              </ul>
              <Link className="lp-h2" to={lienInscription('trimestriel')} style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '13px 20px', borderRadius: '8px', background: '#0c3483', color: '#ffffff', fontWeight: '600', fontSize: '0.9375rem' }}>Choisir Pro Confort</Link>
            </article>

            <article style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #ffd37f', padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#697386' }}>Pro · annuel</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800', background: '#ffa800', color: '#001744' }}>Meilleure valeur · −25 %</span>
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.012em', margin: '6px 0 0' }}>Pro Premium</h3>
                <p style={{ fontSize: '0.875rem', color: '#697386', margin: '6px 0 0' }}>Un conseiller dédié et toute l'équipe dedans.</p>
              </div>
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 6px' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.022em', color: '#0c3483', lineHeight: '1', whiteSpace: 'nowrap', flexShrink: '0' }}>45 000</span>
                  <span style={{ fontSize: '0.9375rem', fontWeight: '600', color: '#697386' }}>F CFA / an</span>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#98a1b4', marginTop: '6px' }}>au lieu de <s>60 000 F CFA</s> — soit 3 750 F par mois</div>
              </div>
              <ul style={{ listStyle: 'none', margin: '0', padding: '0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.9375rem', color: '#0c0f14' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Tout ce que contient Pro Confort</li>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.9375rem', color: '#0c0f14' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Un conseiller dédié, joignable directement</li>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.9375rem', color: '#0c0f14' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Support prioritaire sous 24 h</li>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.9375rem', color: '#0c0f14' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Espace partenaire et commissions</li>
                <li style={{ display: 'flex', gap: '10px', fontSize: '0.9375rem', color: '#0c0f14' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17845a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '3px' }}><path d="M20 6 9 17l-5-5"></path></svg>Plusieurs utilisateurs : toute votre équipe</li>
              </ul>
              <Link className="lp-h2" to={lienInscription('annuel')} style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '13px 20px', borderRadius: '8px', background: '#0c3483', color: '#ffffff', fontWeight: '600', fontSize: '0.9375rem' }}>Choisir Pro Premium</Link>
            </article>
          </div>
          <div style={{ margin: '22px 0 0', padding: '18px 22px', background: '#ffffff', border: '1px solid #ffd37f', borderRadius: '12px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b87400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: '0', marginTop: '2px' }}><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
            <p style={{ fontSize: '1rem', lineHeight: '1.6', color: '#0c0f14', margin: '0', fontWeight: '600' }}>Le paiement ne sert qu'à la personnalisation de vos devis. Toutes les fonctions techniques restent gratuites.</p>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#697386', margin: '14px 0 0' }}>Paiement par Mobile Money, virement ou espèces. Aucun engagement de durée : vous arrêtez quand vous voulez.</p>
        </div>
      </section>
    </>
  );
}
