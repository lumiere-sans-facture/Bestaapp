import { Link } from 'react-router-dom';
import {
  ArrowRight, BarChart3, CheckCircle2, ChevronRight, ClipboardCheck,
  FileText, Menu, PlayCircle, ShieldCheck, Sun, Users, X,
} from 'lucide-react';
import './Landing.css';

const atouts = [
  { icon: Users, title: 'Clients et opportunités', text: 'Centralisez chaque prospect, son historique et la prochaine action à mener.' },
  { icon: FileText, title: 'Devis solaires précis', text: 'Dimensionnez, chiffrez et partagez une proposition claire en quelques minutes.' },
  { icon: BarChart3, title: 'Pilotage de l’activité', text: 'Suivez votre pipeline, vos ventes et vos commissions sans tableur dispersé.' },
];

const etapes = [
  ['01', 'Ajoutez un client', 'Créez la fiche, gardez les coordonnées et retrouvez tout l’historique.'],
  ['02', 'Dimensionnez son besoin', 'Saisissez les appareils ou une facture : BestaSolar propose le système adapté.'],
  ['03', 'Transformez en vente', 'Éditez le devis, suivez l’affaire et gardez vos commissions au clair.'],
];

export default function Landing() {
  return (
    <div className="solar-landing">
      <header className="sl-nav">
        <Link className="sl-brand" to="/" aria-label="Accueil BestaSolar">
          <img src="/besta-solar-icon-navy.png" alt="" />
          <span>Besta<span>Solar</span></span>
        </Link>
        <nav className="sl-nav-links" aria-label="Navigation principale">
          <a href="#fonctionnalites">Fonctionnalités</a>
          <a href="#comment-ca-marche">Comment ça marche</a>
          <a href="#pourquoi">Pourquoi BestaSolar</a>
        </nav>
        <Link className="sl-login" to="/connexion">Se connecter</Link>
        <Link className="sl-nav-cta" to="/connexion">Essayer gratuitement <ArrowRight size={15} /></Link>
        <button className="sl-menu" type="button" aria-label="Ouvrir le menu"><Menu size={22} /></button>
      </header>

      <main>
        <section className="sl-hero">
          <div className="sl-orb sl-orb-one" />
          <div className="sl-orb sl-orb-two" />
          <div className="sl-grid" aria-hidden="true" />
          <div className="sl-hero-copy">
            <div className="sl-kicker"><Sun size={14} /> Le CRM pensé pour le solaire</div>
            <h1>Vos installations solaires,<br /><em>enfin bien pilotées.</em></h1>
            <p>
              BestaSolar réunit clients, dimensionnement, devis et suivi commercial
              dans un seul espace simple à utiliser, même sur le terrain.
            </p>
            <div className="sl-hero-actions">
              <Link className="sl-primary-button" to="/connexion">Créer mon espace <ArrowRight size={18} /></Link>
              <a className="sl-watch-button" href="#demo"><PlayCircle size={19} /> Voir comment ça marche</a>
            </div>
            <div className="sl-trust-line">
              <span><CheckCircle2 size={16} /> Fonctionne aussi hors ligne</span>
              <span><CheckCircle2 size={16} /> Prêt pour mobile</span>
              <span><CheckCircle2 size={16} /> Données sécurisées</span>
            </div>
          </div>

          <div className="sl-product-frame" id="demo">
            <div className="sl-window-bar">
              <div className="sl-window-dots"><i /><i /><i /></div>
              <div className="sl-window-address">app.bestasolar.com</div>
              <span />
            </div>
            <div className="sl-product">
              <aside className="sl-product-side">
                <div className="sl-product-logo"><Sun size={16} /> BestaSolar</div>
                <span className="active"><BarChart3 size={16} /> Tableau de bord</span>
                <span><Users size={16} /> Suivi clients</span>
                <span><FileText size={16} /> Devis</span>
                <span><ClipboardCheck size={16} /> Formation</span>
                <div className="sl-side-user"><b>SA</b><span><strong>Solange A.</strong><small>Technicienne</small></span></div>
              </aside>
              <div className="sl-product-content">
                <div className="sl-product-top"><div><small>Bonjour Solange</small><strong>Votre activité avance bien.</strong></div><span className="sl-live"><i /> Synchronisé</span></div>
                <div className="sl-metrics">
                  <div><small>Opportunités actives</small><strong>24</strong><span className="sl-positive">+18 % ce mois</span></div>
                  <div><small>Devis à relancer</small><strong>07</strong><span>Dans les 7 jours</span></div>
                  <div><small>Valeur du pipeline</small><strong>12,4 M</strong><span>F CFA</span></div>
                </div>
                <div className="sl-board">
                  <div className="sl-board-head"><strong>Vos affaires récentes</strong><span>Voir le pipeline <ChevronRight size={14} /></span></div>
                  <div className="sl-deal-row"><b className="sl-avatar a1">MK</b><span><strong>Maison Kpékpé</strong><small>Kit 5 kWh · Lomé</small></span><em className="sl-stage blue">Proposition</em><strong>1 240 000 F</strong></div>
                  <div className="sl-deal-row"><b className="sl-avatar a2">AP</b><span><strong>Atelier Pétro</strong><small>Dimensionnement en cours</small></span><em className="sl-stage amber">Visite</em><strong>3 850 000 F</strong></div>
                  <div className="sl-deal-row"><b className="sl-avatar a3">CS</b><span><strong>Clinique Saint-Jean</strong><small>Kit 20 kWh · Kandi</small></span><em className="sl-stage green">Gagnée</em><strong>4 960 000 F</strong></div>
                </div>
              </div>
            </div>
            <div className="sl-floating-card"><span><Sun size={18} /></span><div><small>Dimensionnement prêt</small><strong>Kit 5 kWh suggéré</strong></div><CheckCircle2 size={18} /></div>
          </div>
        </section>

        <section className="sl-proof">
          <p>Tout ce qu’il faut pour faire passer une opportunité à une installation réussie.</p>
          <div><span>CLIENTS</span><span>DEMANDES</span><span>DEVIS</span><span>VENTES</span><span>COMMISSIONS</span></div>
        </section>

        <section className="sl-features" id="fonctionnalites">
          <div className="sl-section-intro"><span>Votre journée, plus simple</span><h2>Un espace de travail clair,<br />du premier contact à la vente.</h2><p>Pas besoin de multiplier les outils. BestaSolar organise votre activité commerciale et technique au même endroit.</p></div>
          <div className="sl-feature-grid">
            {atouts.map(({ icon: Icon, title, text }, index) => (
              <article className={index === 0 ? 'sl-feature-card sl-feature-large' : 'sl-feature-card'} key={title}>
                <div className="sl-feature-icon"><Icon size={21} /></div>
                <h3>{title}</h3><p>{text}</p>
                {index === 0 && <div className="sl-mini-funnel"><span style={{ height: '39%' }} /><span style={{ height: '62%' }} /><span style={{ height: '86%' }} /><span style={{ height: '55%' }} /><b>Pipeline commercial</b></div>}
                {index === 1 && <div className="sl-quote-preview"><span>Étude solaire</span><strong>5,0 kWh</strong><i>✓ Batterie et panneaux adaptés</i></div>}
                {index === 2 && <div className="sl-chart-preview"><div><i /><i /><i /><i /><i /><i /></div><span>Jan</span><span>Fév</span><span>Mar</span><span>Avr</span></div>}
              </article>
            ))}
          </div>
        </section>

        <section className="sl-workflow" id="comment-ca-marche">
          <div className="sl-section-intro"><span>Comment ça marche</span><h2>Moins d’administratif.<br />Plus de projets concrétisés.</h2></div>
          <div className="sl-steps">
            {etapes.map(([number, title, text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </section>

        <section className="sl-benefit" id="pourquoi">
          <div className="sl-benefit-copy"><span>Conçu pour le terrain</span><h2>Une vue d’ensemble,<br />même loin du bureau.</h2><p>Continuez à préparer un devis sans réseau, retrouvez vos données dès que la connexion revient et gardez l’équipe alignée.</p><ul><li><ShieldCheck size={18} /> Vos données restent disponibles et protégées</li><li><ShieldCheck size={18} /> Des devis cohérents à chaque intervention</li><li><ShieldCheck size={18} /> Un suivi commercial visible par toute l’équipe</li></ul><Link to="/connexion">Découvrir BestaSolar <ArrowRight size={17} /></Link></div>
          <div className="sl-benefit-visual"><div className="sl-phone"><div className="sl-phone-top"><i /><span>9:41</span><b /></div><small>Bonjour, Solange</small><h3>24 <span>affaires actives</span></h3><div className="sl-phone-progress"><b>Suivi clients</b><span><i /> 8 à relancer</span></div><div className="sl-phone-card"><span className="sl-avatar a1">MK</span><div><strong>Maison Kpékpé</strong><small>Proposition envoyée</small></div><em>1,24 M</em></div><div className="sl-phone-card"><span className="sl-avatar a3">CS</span><div><strong>Clinique Saint-Jean</strong><small>Vente confirmée</small></div><em>4,96 M</em></div><div className="sl-phone-tabs"><Sun size={16} /><Users size={16} /><FileText size={16} /><Menu size={16} /></div></div><div className="sl-sun-stamp"><Sun size={27} /><strong>100%</strong><span>mobile</span></div></div>
        </section>

        <section className="sl-final-cta">
          <Sun size={32} /><h2>Prêt à mieux piloter<br />vos projets solaires ?</h2><p>Créez votre espace BestaSolar et gardez votre activité sous contrôle.</p><Link className="sl-primary-button" to="/connexion">Commencer maintenant <ArrowRight size={18} /></Link>
        </section>
      </main>

      <footer className="sl-footer"><Link className="sl-brand" to="/"><img src="/besta-solar-icon-navy.png" alt="" /><span>Besta<span>Solar</span></span></Link><p>Le CRM solaire pour des équipes qui avancent.</p><Link to="/connexion">Se connecter <ArrowRight size={15} /></Link></footer>
    </div>
  );
}
