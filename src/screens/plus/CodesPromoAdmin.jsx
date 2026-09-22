import { useCallback, useEffect, useState } from 'react';
import { Gift, Plus, Copy, Power } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { adminCodesPromo, adminCreerCodePromo, adminBasculerCodePromo } from '../../lib/remoteSync';
import { genererCode, normaliserCode, formatCodeValide, JOURS_ESSAI, JOURS_ESSAI_MAX } from '../../utils/codePromo';
import { formatDate } from '../../utils/format';
import Field from '../../components/Field';
import { useToast } from '../../components/Toast';

const formulaireVierge = () => ({ code: genererCode(), jours: String(JOURS_ESSAI), max: '', expireLe: '', note: '' });

/**
 * Codes d'essai Devis Pro — création, suivi des utilisations, désactivation.
 * Avec un backend, tout passe par les fonctions serveur réservées à l'admin
 * plateforme (codes-promo.sql) : les codes ne sont jamais lisibles depuis
 * l'app d'un abonné. En mode local, ils vivent dans l'état de l'appareil.
 */
export default function CodesPromoAdmin() {
  const { codesPromo, creerCodePromo, basculerCodePromo } = useData();
  const toast = useToast();
  const serveur = isSupabaseConfigured;
  const [distants, setDistants] = useState(null); // null = chargement
  const [form, setForm] = useState(formulaireVierge);
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(() => {
    adminCodesPromo()
      .then(setDistants)
      .catch((e) => {
        setDistants([]);
        toast(`Codes d'essai indisponibles : ${e.message}. Le script supabase/codes-promo.sql a-t-il été exécuté ?`, { type: 'error' });
      });
  }, [toast]);
  useEffect(() => { if (serveur) charger(); }, [serveur, charger]);

  // Même forme des deux côtés : { code, jours, actif, maxUtilisations, expireLe, note, nbUtilisations }.
  const codes = serveur
    ? distants || []
    : (codesPromo || []).map((c) => ({ ...c, nbUtilisations: (c.utilisations || []).length }));

  const creer = async (e) => {
    e.preventDefault();
    const code = normaliserCode(form.code);
    if (!formatCodeValide(code)) {
      toast('Code invalide : 4 à 32 caractères, lettres, chiffres et tirets.', { type: 'error' });
      return;
    }
    const jours = Math.round(Number(form.jours));
    if (!(jours >= 1 && jours <= JOURS_ESSAI_MAX)) {
      toast(`Durée invalide : entre 1 et ${JOURS_ESSAI_MAX} jours.`, { type: 'error' });
      return;
    }
    const saisie = {
      code, jours,
      maxUtilisations: Number(form.max) > 0 ? Math.round(Number(form.max)) : null,
      // Fin de la journée choisie : un code « valable jusqu'au 30 » l'est le 30.
      expireLe: form.expireLe ? new Date(`${form.expireLe}T23:59:59`).toISOString() : null,
      note: form.note.trim(),
    };
    if (!serveur) {
      if ((codesPromo || []).some((c) => c.code === code)) {
        toast('Ce code existe déjà.', { type: 'error' });
        return;
      }
      creerCodePromo(saisie);
      toast(`Code ${code} créé.`);
      setForm(formulaireVierge());
      setOuvert(false);
      return;
    }
    setEnCours(true);
    try {
      await adminCreerCodePromo(saisie);
      toast(`Code ${code} créé.`);
      setForm(formulaireVierge());
      setOuvert(false);
      charger();
    } catch (err) {
      toast(`Création impossible : ${err.message}`, { type: 'error' });
    } finally {
      setEnCours(false);
    }
  };

  const basculer = async (c) => {
    if (!serveur) { basculerCodePromo(c.code, !c.actif); return; }
    try {
      await adminBasculerCodePromo(c.code, !c.actif);
      charger();
    } catch (err) {
      toast(`Modification impossible : ${err.message}`, { type: 'error' });
    }
  };

  const copier = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast('Code copié.');
    } catch {
      toast('Copie impossible — recopiez le code à la main.', { type: 'error' });
    }
  };

  const expire = (c) => c.expireLe && new Date(c.expireLe).getTime() < Date.now();

  return (
    <div className="card my-partner-section">
      <div className="card-title code-essai-admin-tete">
        <span><Gift size={15} /> Codes d'essai ({codes.length})</span>
        {!ouvert && (
          <button type="button" className="btn btn-sm btn-accent" onClick={() => setOuvert(true)}>
            <Plus size={14} /> Nouveau code
          </button>
        )}
      </div>
      <p className="text-sm text-secondary" style={{ marginBottom: 10 }}>
        Un code ouvre l'espace Pro sans paiement, pour la durée choisie. Chaque compte ne peut
        utiliser un même code qu'une fois.
      </p>

      {ouvert && (
        <form onSubmit={creer} style={{ marginBottom: 14 }}>
          <div className="form-row-2">
            <Field label="Code *">
              <input className="input" required value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Durée (jours) *">
              <input className="input" type="number" min="1" max={JOURS_ESSAI_MAX} required value={form.jours}
                onChange={(e) => setForm({ ...form, jours: e.target.value })} />
            </Field>
            <Field label="Utilisations max (vide = illimité)">
              <input className="input" type="number" min="1" value={form.max}
                onChange={(e) => setForm({ ...form, max: e.target.value })} />
            </Field>
            <Field label="Valable jusqu'au (optionnel)">
              <input className="input" type="date" value={form.expireLe}
                onChange={(e) => setForm({ ...form, expireLe: e.target.value })} />
            </Field>
          </div>
          <Field label="Note interne (optionnel)">
            <input className="input" value={form.note} placeholder="Ex : salon de l'énergie, Lomé"
              onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-outline" onClick={() => setForm({ ...form, code: genererCode() })}>
              Autre code
            </button>
            <button type="button" className="btn btn-outline" onClick={() => { setOuvert(false); setForm(formulaireVierge()); }}>
              Annuler
            </button>
            <button type="submit" className="btn btn-accent" disabled={enCours} style={{ marginLeft: 'auto' }}>
              {enCours ? 'Création…' : 'Créer le code'}
            </button>
          </div>
        </form>
      )}

      {serveur && distants === null && <div className="text-sm text-secondary">Chargement des codes…</div>}
      {codes.map((c) => (
        <div key={c.code} className="sheet-row">
          <span className="sheet-label">
            <strong style={{ letterSpacing: '0.04em' }}>{c.code}</strong>
            <span className="text-secondary">
              {' '}· {c.jours} j · {c.nbUtilisations}{c.maxUtilisations ? ` / ${c.maxUtilisations}` : ''} utilisation{c.nbUtilisations > 1 ? 's' : ''}
              {c.expireLe ? ` · jusqu'au ${formatDate(c.expireLe)}` : ''}
              {c.note ? ` · ${c.note}` : ''}
            </span>
          </span>
          <span className="sheet-value pro-doc-actions">
            <span className={`badge ${c.actif && !expire(c) ? 'badge-success' : 'badge-muted'}`}>
              {!c.actif ? 'Désactivé' : expire(c) ? 'Expiré' : 'Actif'}
            </span>
            <button type="button" className="btn btn-sm btn-outline" onClick={() => copier(c.code)} aria-label={`Copier ${c.code}`}>
              <Copy size={14} />
            </button>
            <button type="button" className="btn btn-sm btn-outline" onClick={() => basculer(c)}
              aria-label={c.actif ? `Désactiver ${c.code}` : `Réactiver ${c.code}`}>
              <Power size={14} /> {c.actif ? 'Désactiver' : 'Réactiver'}
            </button>
          </span>
        </div>
      ))}
      {!codes.length && (!serveur || distants !== null) && (
        <div className="text-sm text-secondary">Aucun code pour le moment.</div>
      )}
    </div>
  );
}
