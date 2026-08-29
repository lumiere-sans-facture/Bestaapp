import { useEffect, useState } from 'react';
import { CheckCircle2, Link2, RefreshCw, Unlink, AlertCircle } from 'lucide-react';
import { isSupabaseConfigured } from '../../lib/supabase';
import { disconnectGoogleContacts, getGoogleContactsConfig, startGoogleContactsOAuth } from '../../lib/remoteSync';
import { useToast } from '../../components/Toast';

export default function GoogleContactsSection() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const refresh = async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const result = await getGoogleContactsConfig();
      setConfig(result.config || null);
    } catch (error) {
      toast(error.message || 'Lecture de la configuration Google impossible.', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = async () => {
    setBusy(true);
    try {
      const result = await startGoogleContactsOAuth();
      if (!result.authorizationUrl) throw new Error('Adresse de connexion Google absente.');
      // Le retour OAuth revient sur cette page : aucun token n'est exposé au navigateur.
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      toast(error.message || 'Connexion Google impossible.', { type: 'error' });
      setBusy(false);
    }
  };
  const disconnect = async () => {
    setBusy(true);
    try {
      await disconnectGoogleContacts();
      setConfig(null);
      toast('Compte Google déconnecté. Les partenaires restent enregistrés dans BestaSolar.');
    } catch (error) {
      toast(error.message || 'Déconnexion Google impossible.', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (!isSupabaseConfigured) return (
    <div className="card empty-state-card">
      <AlertCircle size={24} />
      <div>
        <strong>Synchronisation indisponible en mode local</strong>
        <p className="text-secondary">Configurez Supabase et la People API Google pour connecter un compte.</p>
      </div>
    </div>
  );

  return (
    <div className="settings-tab google-contacts-settings">
      <div className="card">
        <div className="sheet-section-title"><Link2 size={16} /> Synchronisation Google Contacts</div>
        <p className="text-sm text-secondary">
          Chaque nouveau partenaire est enregistré localement, puis synchronisé sans doublon vers le compte Google choisi.
          Les numéros béninois sont comparés au format +22901XXXXXXXX.
        </p>
        {loading ? <p className="text-secondary">Vérification du compte connecté…</p> : config ? (
          <>
            <div className="sheet-row">
              <span className="sheet-label"><CheckCircle2 size={15} /> Compte connecté</span>
              <span className="sheet-value">{config.google_account_email || 'Compte Google autorisé'}</span>
            </div>
            <p className="field-hint">Les échecs temporaires restent en attente et seront réessayés automatiquement.</p>
            <div className="form-actions">
              <button className="btn btn-outline" type="button" onClick={refresh} disabled={busy}><RefreshCw size={16} /> Actualiser</button>
              <button className="btn btn-danger" type="button" onClick={disconnect} disabled={busy}><Unlink size={16} /> Déconnecter</button>
            </div>
          </>
        ) : (
          <>
            <p className="field-hint">Aucun compte n’est encore défini pour cette organisation.</p>
            <button className="btn btn-primary" type="button" onClick={connect} disabled={busy}>
              <Link2 size={16} /> {busy ? 'Ouverture de Google…' : 'Connecter un compte Google'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
