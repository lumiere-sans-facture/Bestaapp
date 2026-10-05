import { useRef, useState } from 'react';
import { ChevronLeft, Bot, Send, Check, Wrench, RotateCcw } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { appliances } from '../../data/appliances';
import { ENSOLEILLEMENT } from '../../data/ensoleillement';
import { interrogerAgentDevis } from '../../lib/agentDevisServeur';
import { executerOutil } from '../../utils/agentDevis';
import { LIMITES_AGENT } from '../../utils/agentDevisDefinitions';
import { isSameClient } from '../../utils/clientContact';
import { formatCFA } from '../../utils/format';
import { useToast } from '../../components/Toast';

const ETAPES_OUTILS = {
  chercher_appareils: 'Recherche des puissances d’appareils…',
  calculer_proposition: 'Dimensionnement et chiffrage des kits…',
  preparer_devis: 'Préparation du devis…',
};

/** Texte lisible d'un message (les résultats d'outils ne s'affichent pas). */
const bullesDe = (message) => {
  if (typeof message.content === 'string') return [{ type: 'texte', texte: message.content }];
  return message.content.flatMap((b) => {
    if (b.type === 'text' && b.text.trim()) return [{ type: 'texte', texte: b.text }];
    if (b.type === 'tool_use') return [{ type: 'outil', texte: ETAPES_OUTILS[b.name] || 'Calcul…' }];
    return [];
  });
};

/**
 * Agent devis (PROTOTYPE) : une conversation avec Claude, qui dimensionne et
 * chiffre avec les outils de l'app — les kits, onduleurs et prix de
 * l'entreprise. Le devis préparé n'est enregistré qu'au clic du gérant, en
 * brouillon : rien ne part chez un client sans relecture.
 */
export default function AgentDevisSection({ onBack }) {
  const { user } = useAuth();
  const { kits, inverters, products, leads, addLead, addDevis } = useData();
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [propositions, setPropositions] = useState([]);
  const [jetons, setJetons] = useState({ entree: 0, cache: 0, sortie: 0 });
  const derniereDemande = useRef(null);
  const fin = useRef(null);

  const contexte = () => ({
    kits: kits || [], inverters: inverters || [], products: products || [],
    appareils: appliances, ensoleillement: ENSOLEILLEMENT, derniereDemande: derniereDemande.current,
  });

  const envoyer = async (e) => {
    e?.preventDefault();
    const texte = saisie.trim();
    if (!texte || enCours) return;
    setSaisie('');
    setErreur('');
    setEnCours(true);
    let conv = [...messages, { role: 'user', content: texte }];
    setMessages(conv);
    for (let tour = 0; tour <= LIMITES_AGENT.toursOutilsMax; tour += 1) {
      const r = await interrogerAgentDevis(conv);
      if (r.erreur) { setErreur(r.erreur); break; }
      // Contenu renvoyé TEL QUEL au tour suivant (réflexion comprise).
      conv = [...conv, { role: 'assistant', content: r.content }];
      setMessages(conv);
      setJetons((j) => ({
        entree: j.entree + (r.usage?.input_tokens || 0),
        cache: j.cache + (r.usage?.cache_read_input_tokens || 0),
        sortie: j.sortie + (r.usage?.output_tokens || 0),
      }));
      if (r.stop_reason === 'refusal') { setErreur('L’agent n’a pas pu répondre à cette demande.'); break; }
      if (r.stop_reason !== 'tool_use') break;
      if (tour === LIMITES_AGENT.toursOutilsMax) { setErreur('Trop d’étapes de calcul pour un seul message.'); break; }
      // Outils exécutés DANS L'APP, avec les données de l'entreprise.
      const resultats = r.content.filter((b) => b.type === 'tool_use').map((b) => {
        const x = executerOutil(b.name, b.input, contexte());
        if (x.demande) derniereDemande.current = x.demande;
        if (x.proposition) setPropositions((p) => [...p, { ...x.proposition, id: b.id, cree: false }]);
        return { type: 'tool_result', tool_use_id: b.id, content: x.contenu, ...(x.erreur ? { is_error: true } : {}) };
      });
      conv = [...conv, { role: 'user', content: resultats }];
      setMessages(conv);
    }
    setEnCours(false);
    setTimeout(() => fin.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
  };

  // Enregistre la piste (ou retrouve le client) puis le devis, en brouillon.
  const creerDevis = (prop) => {
    const telephone = prop.client.telephone;
    const existant = (leads || []).find((l) => isSameClient(l, { phone: telephone }));
    const leadId = existant?.id || crypto.randomUUID();
    if (!existant) {
      addLead({
        id: leadId, name: prop.client.nom, contact: prop.client.nom, phone: telephone, email: '',
        address: prop.client.ville, clientType: 'particulier', estimatedValue: 0,
        notes: 'Piste créée par l’agent devis (prototype).', assignedTo: user.id, parrainL1: null,
      });
    }
    const { configurationImpossible, ...devis } = prop.devis;
    if (configurationImpossible) return;
    addDevis({ ...devis, leadId, partnerId: null, statut: 'brouillon', createdBy: user.id });
    setPropositions((p) => p.map((x) => (x.id === prop.id ? { ...x, cree: true } : x)));
    toast(`Devis enregistré en brouillon pour ${prop.client.nom}.`);
  };

  const recommencer = () => {
    setMessages([]); setPropositions([]); setErreur(''); derniereDemande.current = null;
    setJetons({ entree: 0, cache: 0, sortie: 0 });
  };

  const affichage = messages.flatMap((m, i) => bullesDe(m).map((b, j) => ({ ...b, role: m.role, cle: `${i}-${j}` })));

  return (
    <>
      <div className="partners-toolbar">
        <button className="btn btn-outline btn-sm back-button back-to-plus" onClick={onBack}><ChevronLeft size={16} /> Retour</button>
        {messages.length > 0 && (
          <button className="btn btn-outline btn-sm" onClick={recommencer} disabled={enCours}><RotateCcw size={14} /> Nouvelle conversation</button>
        )}
      </div>

      <div className="field-hint" style={{ marginBottom: 12 }}>
        <Bot size={13} style={{ verticalAlign: -2 }} /> <strong>Prototype</strong> — parlez à l’agent comme un client sur
        WhatsApp. Il dimensionne et chiffre avec vos kits et vos prix ; un devis préparé n’est enregistré
        qu’à votre clic, en brouillon.
      </div>

      <div className="agent-chat" aria-live="polite">
        {affichage.length === 0 && (
          <div className="agent-vide">Exemple : « Bonjour, je veux alimenter 1 frigo, 4 ampoules et une télé à Lomé. »</div>
        )}
        {affichage.map((b) => (b.type === 'outil'
          ? <div key={b.cle} className="agent-etape"><Wrench size={12} /> {b.texte}</div>
          : <div key={b.cle} className={`agent-bulle ${b.role === 'user' ? 'agent-bulle-client' : 'agent-bulle-agent'}`}>{b.texte}</div>
        ))}
        {enCours && <div className="agent-etape">L’agent écrit…</div>}

        {propositions.map((p) => (
          <div key={p.id} className="card agent-proposition">
            <div className="agent-proposition-titre">Devis préparé — {p.devis.kit.name}</div>
            <div className="agent-proposition-ligne">{p.client.nom} · {p.client.telephone}{p.client.ville ? ` · ${p.client.ville}` : ''}</div>
            <div className="agent-proposition-ligne">
              {p.devis.sizing.numberOfPanels} panneaux · batterie {p.devis.sizing.batteryCapacity} kWh · <strong>{formatCFA(p.devis.total)}</strong>
            </div>
            {p.cree
              ? <div className="agent-proposition-fait"><Check size={14} /> Enregistré en brouillon dans Devis</div>
              : <button className="btn btn-accent btn-block" onClick={() => creerDevis(p)}><Check size={16} /> Créer la piste et le devis (brouillon)</button>}
          </div>
        ))}
        {erreur && <div className="storage-alert abo-alert is-warning" role="alert">{erreur}</div>}
        <div ref={fin} />
      </div>

      <form className="agent-saisie" onSubmit={envoyer}>
        <input className="input" value={saisie} onChange={(e) => setSaisie(e.target.value)} disabled={enCours}
          placeholder="Écrire comme un client…" aria-label="Message à l’agent" maxLength={1000} />
        <button type="submit" className="btn btn-primary" disabled={enCours || !saisie.trim()} aria-label="Envoyer"><Send size={16} /></button>
      </form>
      {jetons.entree + jetons.sortie > 0 && (
        <div className="field-hint" style={{ marginTop: 6 }}>
          Consommation de cette conversation : {jetons.entree.toLocaleString('fr-FR')} jetons lus
          ({jetons.cache.toLocaleString('fr-FR')} en cache), {jetons.sortie.toLocaleString('fr-FR')} écrits.
        </div>
      )}
    </>
  );
}
