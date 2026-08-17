import { useState } from 'react';
import { ChevronLeft, Plus, Pencil, Trash2, Check, ShieldAlert, ServerCog, CheckCircle2, Circle } from 'lucide-react';
import { useData } from '../../context/DataContext';
import {
  PROVIDERS, MODES, MODE_LABEL, providerById, problemeConfig, masquerCle, configActive,
} from '../../utils/paiementProviders';
import Sheet from '../../components/Sheet';
import ConfirmSheet from '../../components/ConfirmSheet';
import Field from '../../components/Field';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../components/Toast';

const NOUVELLE = { provider: 'kkiapay', mode: 'test', actif: false, champs: {} };

/**
 * « Moyens de paiement » — le gérant choisit l'agrégateur qui encaisse
 * (KkiaPay, CinetPay, FedaPay), sa clé PUBLIQUE et le mode test / réel, sans
 * redéploiement.
 *
 * Ce que cet écran ne fera JAMAIS : accepter une clé privée ou secrète. Tout
 * ce qui est saisi ici part dans localStorage puis dans Supabase, où chaque
 * membre de l'organisation peut le lire — et une clé secrète autorise
 * remboursements et versements. Elle reste en variable d'environnement
 * serveur ; l'écran se contente d'en rappeler le nom exact à déclarer dans
 * Vercel, et refuse une valeur qui ressemble à un secret.
 */
export default function PaiementsSection({ onBack }) {
  const { paiementConfigs, savePaiementConfig, deletePaiementConfig } = useData();
  const [edition, setEdition] = useState(null);
  const [aSupprimer, setASupprimer] = useState(null);
  const toast = useToast();

  const liste = paiementConfigs || [];
  const active = configActive(liste);

  const enregistrer = (e) => {
    e.preventDefault();
    const probleme = problemeConfig(edition);
    if (probleme) { toast(probleme, { type: 'error' }); return; }
    savePaiementConfig(edition);
    setEdition(null);
    toast('Moyen de paiement enregistré.');
  };

  const majChamp = (cle, valeur) =>
    setEdition((c) => ({ ...c, champs: { ...c.champs, [cle]: valeur } }));

  return (
    <>
      <div className="partners-toolbar">
        <button className="btn btn-outline btn-sm back-button back-to-plus" onClick={onBack}>
          <ChevronLeft size={16} /> Retour
        </button>
        <button className="btn btn-accent btn-sm" onClick={() => setEdition({ ...NOUVELLE })}>
          <Plus size={16} /> Ajouter
        </button>
      </div>
      <div className="section-title">Moyens de paiement ({liste.length})</div>
      <p className="text-sm text-secondary" style={{ marginBottom: 12 }}>
        L'agrégateur activé encaisse les abonnements Devis Pro. Un seul à la fois :
        en activer un désactive les autres.
      </p>

      {/* L'avertissement est en tête, pas en note de bas de page : c'est la
          règle qui protège l'argent, elle doit être lue avant la saisie. */}
      <div className="callout callout-danger" role="note">
        <div className="callout-title"><ShieldAlert size={13} /> Clé publique uniquement</div>
        <div className="text-sm">
          Ne collez jamais ici une clé <strong>privée</strong> ou <strong>secrète</strong> : tout ce qui
          est saisi dans l'app est enregistré sur l'appareil et synchronisé — donc lisible par
          les membres de votre équipe. Les clés secrètes se déclarent dans Vercel
          (Settings → Environment Variables), jamais dans l'application.
        </div>
      </div>

      {!liste.length && (
        <EmptyState card>
          Aucun moyen de paiement configuré — le bouton de paiement en ligne reste caché
          et seul le Mobile Money manuel est proposé aux clients.
        </EmptyState>
      )}

      {liste.map((c) => {
        const p = providerById(c.provider);
        const estActif = active?.id === c.id;
        return (
          <div key={c.id} className={`card paiement-card ${estActif ? 'actif' : ''}`}>
            <div className="paiement-card-head">
              <span className="paiement-etat">
                {estActif ? <CheckCircle2 size={16} /> : <Circle size={16} />}
              </span>
              <div className="paiement-card-titre">
                <div className="paiement-nom">{p?.nom || c.provider}</div>
                <div className="text-sm text-secondary">{p?.zone}</div>
              </div>
              <span className={`flat-badge ${c.mode === 'live' ? 'badge-danger' : ''}`}>
                {MODE_LABEL[c.mode] || c.mode}
              </span>
            </div>

            <div className="paiement-champs">
              {(p?.champs || []).map((champ) => (
                <div key={champ.cle} className="sheet-row">
                  <span className="sheet-label">{champ.label}</span>
                  <span className="sheet-value paiement-mono">{masquerCle(c.champs?.[champ.cle])}</span>
                </div>
              ))}
            </div>

            {/* Configurable ne veut pas dire opérationnel : le dire, plutôt
                que de laisser croire à un encaissement qui n'arrivera pas. */}
            {p && !p.pret && (
              <div className="text-sm text-secondary paiement-note">
                Encaissement pas encore branché pour {p.nom} ({p.integration}) — l'activer
                laisse le paiement Mobile Money manuel en place.
              </div>
            )}

            <div className="paiement-actions">
              <button className="btn btn-sm btn-outline" onClick={() => setEdition({ ...c, champs: { ...c.champs } })}>
                <Pencil size={14} /> Modifier
              </button>
              {!estActif && (
                <button className="btn btn-sm btn-primary"
                  onClick={() => { savePaiementConfig({ ...c, actif: true }); toast(`${p?.nom || c.provider} activé.`); }}>
                  <Check size={14} /> Activer
                </button>
              )}
              <button className="btn btn-sm btn-outline paiement-supprimer" onClick={() => setASupprimer(c)}>
                <Trash2 size={14} /> Supprimer
              </button>
            </div>
          </div>
        );
      })}

      {/* Ce que le gérant doit déclarer côté serveur — la moitié invisible de
          l'intégration, sans laquelle un paiement ne peut pas être vérifié. */}
      <div className="card">
        <div className="card-title"><ServerCog size={15} /> À déclarer dans Vercel</div>
        <p className="text-sm text-secondary">
          Variables d'environnement du projet (Settings → Environment Variables). Elles ne
          sont lues que par le serveur et n'apparaissent jamais dans l'application.
        </p>
        {PROVIDERS.map((p) => (
          <div key={p.id} className="sheet-row">
            <span className="sheet-label">{p.nom}</span>
            <span className="sheet-value paiement-mono">{p.secrets.join(', ')}</span>
          </div>
        ))}
      </div>

      <Sheet open={!!edition} onClose={() => setEdition(null)}
        title={edition?.id ? 'Modifier le moyen de paiement' : 'Nouveau moyen de paiement'}>
        {edition && (
          <form onSubmit={enregistrer}>
            <Field label="Agrégateur *">
              <select className="input" value={edition.provider}
                onChange={(e) => setEdition({ ...edition, provider: e.target.value, champs: {} })}>
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.nom} — {p.zone}</option>
                ))}
              </select>
            </Field>

            {(providerById(edition.provider)?.champs || []).map((champ) => (
              <Field key={champ.cle} label={`${champ.label} *`}>
                <input className="input" value={edition.champs?.[champ.cle] || ''}
                  onChange={(e) => majChamp(champ.cle, e.target.value)}
                  placeholder={champ.exemple} autoComplete="off" spellCheck="false" />
              </Field>
            ))}

            <Field label="Mode *">
              <select className="input" value={edition.mode}
                onChange={(e) => setEdition({ ...edition, mode: e.target.value })}>
                {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <div className="field-hint">
              En mode test, aucun argent n'est débité et seuls les numéros de test de
              l'agrégateur fonctionnent. Passez en réel une fois le compte marchand validé.
            </div>

            <label className="checkbox-row">
              <input type="checkbox" checked={!!edition.actif}
                onChange={(e) => setEdition({ ...edition, actif: e.target.checked })} />
              <span>Activer — c'est cet agrégateur qui encaissera</span>
            </label>

            <div className="callout callout-danger" role="note">
              <div className="callout-title"><ShieldAlert size={13} /> Rappel</div>
              <div className="text-sm">
                Clé <strong>publique</strong> seulement. Les clés{' '}
                <span className="paiement-mono">{(providerById(edition.provider)?.secrets || []).join(', ')}</span>{' '}
                se déclarent dans Vercel.
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block"><Check size={17} /> Enregistrer</button>
          </form>
        )}
      </Sheet>

      <ConfirmSheet
        open={!!aSupprimer}
        title="Supprimer ce moyen de paiement ?"
        message={`${providerById(aSupprimer?.provider)?.nom || ''} ne sera plus proposé. Les paiements déjà enregistrés ne changent pas.`}
        confirmLabel="Supprimer"
        onConfirm={() => { deletePaiementConfig(aSupprimer.id); setASupprimer(null); toast('Moyen de paiement supprimé.'); }}
        onClose={() => setASupprimer(null)}
      />
    </>
  );
}
