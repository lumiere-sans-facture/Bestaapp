import { useState } from 'react';
import { Gift, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useMode } from '../context/ModeContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { utiliserCodePromo } from '../lib/remoteSync';
import {
  normaliserCode, formatCodeValide, verifierCode, messageCode, joursDuCode, JOURS_ESSAI,
} from '../utils/codePromo';
import { formatDate } from '../utils/format';
import { useToast } from './Toast';

/**
 * « Vous avez un code d'essai ? » — ouvre l'espace Pro sans paiement.
 *
 * Avec un backend, c'est le SERVEUR qui juge le code et écrit l'abonnement
 * (supabase/codes-promo.sql) : l'app ne fait que relayer sa réponse. Sans
 * backend (mode local), le code est cherché dans ceux que le gérant a créés
 * sur l'appareil, avec la même règle (utils/codePromo.js).
 */
export default function CodeEssai({ onOuvrirPro }) {
  const { user } = useAuth();
  const { codesPromo, activerEssai } = useData();
  const { proActive, setMode } = useMode();
  const toast = useToast();
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [active, setActive] = useState(null); // { dateFin, jours } une fois le code accepté

  const valider = async (e) => {
    e.preventDefault();
    const code = normaliserCode(saisie);
    setErreur('');
    if (!formatCodeValide(code)) { setErreur(messageCode('format')); return; }

    if (!isSupabaseConfigured) {
      const ligne = (codesPromo || []).find((c) => c.code === code) || null;
      const verdict = verifierCode(code, ligne, user.id);
      if (!verdict.ok) { setErreur(messageCode(verdict.raison)); return; }
      const jours = joursDuCode(ligne);
      activerEssai(user.id, { code, jours, enregistrerUtilisation: true });
      setActive({ jours, dateFin: null });
      toast(`Code accepté — espace Pro ouvert pour ${jours} jours.`);
      return;
    }

    setEnCours(true);
    try {
      const r = await utiliserCodePromo(code);
      if (!r.ok) { setErreur(messageCode(r.raison)); return; }
      activerEssai(user.id, { code, jours: r.jours, dateFin: r.dateFin });
      setActive({ jours: r.jours, dateFin: r.dateFin });
      toast(`Code accepté — espace Pro ouvert jusqu'au ${formatDate(r.dateFin)}.`);
    } catch {
      setErreur(messageCode('reseau'));
    } finally {
      setEnCours(false);
    }
  };

  const ouvrirPro = () => {
    setMode('pro');
    onOuvrirPro?.();
  };

  if (active) {
    return (
      <div className="code-essai code-essai-ok" role="status">
        <Gift size={18} />
        <div>
          <strong>Essai activé : {active.jours} jours d'espace Pro.</strong>
          {active.dateFin && <div className="text-sm text-secondary">Jusqu'au {formatDate(active.dateFin)}.</div>}
          <button type="button" className="btn btn-accent btn-sm" style={{ marginTop: 10 }}
            onClick={ouvrirPro} disabled={!proActive}>
            <Crown size={15} /> {proActive ? 'Ouvrir mon espace Pro' : 'Activation…'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="code-essai" onSubmit={valider}>
      <div className="code-essai-titre"><Gift size={16} /> Vous avez un code d'essai ?</div>
      <div className="text-sm text-secondary">{JOURS_ESSAI} jours d'espace Pro offerts, sans paiement.</div>
      <div className="code-essai-ligne">
        <input className="input" value={saisie} aria-label="Code d'essai"
          onChange={(e) => { setSaisie(e.target.value); setErreur(''); }}
          placeholder="Ex : ESSAI-7KQ4PM" autoCapitalize="characters" autoComplete="off" spellCheck={false} />
        <button type="submit" className="btn btn-primary" disabled={enCours || !saisie.trim()}>
          {enCours ? 'Vérification…' : 'Activer'}
        </button>
      </div>
      {erreur && <div className="field-error" role="alert">{erreur}</div>}
    </form>
  );
}
