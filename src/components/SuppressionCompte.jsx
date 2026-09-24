import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { supprimerMonCompte } from '../lib/remoteSync';
import { COMPANY } from '../config/company';
import {
  MOT_CONFIRMATION, confirmationValide, messageRefusSuppression, poserConsignePurge,
} from '../utils/suppressionCompte';
import Sheet from './Sheet';
import Field from './Field';

/**
 * « Supprimer mon compte » — exigé par Google Play et l'App Store.
 *
 * Le serveur décide de la portée (supabase/suppression-compte.sql) : compte
 * seul dans son entreprise → l'entreprise et toutes ses données partent ;
 * compte d'une équipe → le compte et ce qui n'est qu'à lui, le travail
 * restant à l'équipe. L'appareil est ensuite nettoyé au redémarrage.
 */
export default function SuppressionCompte() {
  const { user, logout } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  // Mode local : pas de compte en ligne, les données sont sur cet appareil.
  if (!isSupabaseConfigured) {
    return (
      <div className="card my-partner-section suppression-compte">
        <div className="card-title"><Trash2 size={15} /> Supprimer mes données</div>
        <p className="text-sm text-secondary">
          En mode local, aucune donnée ne quitte cet appareil. Pour tout effacer, supprimez
          les données de l'application dans les réglages du téléphone ou du navigateur.
        </p>
      </div>
    );
  }

  const fermer = () => { if (enCours) return; setOuvert(false); setSaisie(''); setErreur(''); };

  const supprimer = async (e) => {
    e.preventDefault();
    if (!confirmationValide(saisie)) return;
    setEnCours(true);
    setErreur('');
    try {
      const r = await supprimerMonCompte();
      if (!r.ok) { setErreur(messageRefusSuppression(r.raison)); setEnCours(false); return; }
      // Même clé de stockage que DataContext : l'entreprise, à défaut le compte.
      poserConsignePurge({ scope: user.org?.id || user.org_id || user.id, userId: user.id });
      await logout();
      window.location.replace('/');
    } catch {
      setErreur(messageRefusSuppression('reseau'));
      setEnCours(false);
    }
  };

  return (
    <div className="card my-partner-section suppression-compte">
      <div className="card-title"><Trash2 size={15} /> Supprimer mon compte</div>
      <p className="text-sm text-secondary">
        Supprime définitivement votre compte et vos données personnelles. Si vous travaillez
        seul, votre entreprise et toutes ses données (clients, devis, factures) sont supprimées
        avec lui.
      </p>
      <button type="button" className="btn btn-sm btn-lost" onClick={() => setOuvert(true)}>
        <Trash2 size={14} /> Supprimer mon compte
      </button>

      <Sheet open={ouvert} onClose={fermer} title="Supprimer mon compte">
        <form onSubmit={supprimer}>
          <p className="text-sm">Cette action est <strong>définitive</strong>. Sont supprimés :</p>
          <ul className="text-sm suppression-liste">
            <li>votre compte de connexion et votre profil ;</li>
            <li>votre abonnement Devis Pro et l'identité de votre entreprise Pro ;</li>
            <li>
              si vous êtes <strong>seul</strong> dans votre entreprise : tous ses clients, devis,
              factures, kits et réglages.
            </li>
          </ul>
          <p className="text-sm text-secondary" style={{ marginBottom: 14 }}>
            Dans une équipe, les clients et devis appartiennent à l'entreprise et restent à vos
            collègues. Les justificatifs de paiement sont conservés, comme la loi l'impose.
            {user.role === 'gerant' && ' Pensez à télécharger une sauvegarde (Paramètres › Sauvegarde des données) avant de continuer.'}
          </p>
          <Field label={`Pour confirmer, tapez ${MOT_CONFIRMATION}`}>
            <input className="input" value={saisie} autoComplete="off" autoCapitalize="characters"
              onChange={(e) => { setSaisie(e.target.value); setErreur(''); }} />
          </Field>
          {erreur && (
            <div className="field-error" role="alert">
              {erreur} <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
            </div>
          )}
          <button type="submit" className="btn btn-block btn-lost" disabled={!confirmationValide(saisie) || enCours}>
            <Trash2 size={16} /> {enCours ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </form>
      </Sheet>
    </div>
  );
}
