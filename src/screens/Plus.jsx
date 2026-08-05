import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, DollarSign, User, LogOut, ChevronRight, ChevronLeft, Plus as PlusIcon, CheckCircle, Share2, GraduationCap, Crown, Clock, Check, Download, Upload, DatabaseBackup, RefreshCw, Handshake } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData, COMMISSION_RATES } from '../context/DataContext';
import { useMode } from '../context/ModeContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { setOrgReferral, fetchPlatformCommissions, payPlatformCommission } from '../lib/remoteSync';
import { formatCFA, formatDate, formatTaux } from '../utils/format';
import { estProprietaireEspace } from '../utils/roles';
import { SUBSCRIPTION_PRICE, effectiveStatus } from '../utils/subscription';
import { PAY_NUMBER } from '../config/company';
import { downloadBackup, readBackupFile } from '../utils/backup';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';
import ConfirmSheet from '../components/ConfirmSheet';
import { useToast } from '../components/Toast';
import Field from '../components/Field';
import EmptyState from '../components/EmptyState';
import PartnersSection from './plus/PartnersSection';
import MyPartnerDashboard from './plus/MyPartnerDashboard';
import OrdersSection from './plus/OrdersSection';
import MyProfile from './plus/MyProfile';
import TeamSection from './plus/TeamSection';
import FormationSection from './plus/FormationSection';
import SubscriptionsAdmin from './plus/SubscriptionsAdmin';
import { SyncStatusRow } from '../components/SyncStatus';
import { buildRecuCommissionHtml, buildReleveCommissionsHtml, openHtmlDoc, PAY_MODE_LABEL } from '../utils/commissionDocs';
import { reconcileMissingCommissions } from '../utils/commissionSync';

export default function Plus() {
  const { user, logout, refreshOrg } = useAuth();
  // Parrainage de l'entreprise : saisie une seule fois, puis verrouillé (serveur).
  const [refInput, setRefInput] = useState('');
  const [refSaving, setRefSaving] = useState(false);
  const { setMode, proActive } = useMode();
  const data = useData();
  const {
    partners, commissions, leads, orders, devis, referrals, team, teamChargee,
    getPartnerById, getLeadById,
    payCommission, addCommission, syncCommissions,
    getSubscriptionForUser, requestSubscription, importData,
  } = data;

  const sub = getSubscriptionForUser(user.id);
  const subStatus = effectiveStatus(sub);

  // L'onglet actif est piloté par l'URL (/plus, /plus/partners…) pour que les
  // sous-sections soient accessibles directement depuis la barre latérale.
  const KNOWN_TABS = ['menu', 'partners', 'commissions', 'orders', 'team', 'formation', 'subsadmin', 'mypartner', 'profile', 'backup'];
  // Sections d'ADMINISTRATION : masquer leur entrée de menu ne protège rien —
  // l'adresse reste tapable, et surtout elle SURVIT à une déconnexion (l'app
  // est une page unique : se reconnecter ne change pas l'URL affichée). Un
  // simple utilisateur restait ainsi sur l'écran des commissions du gérant,
  // boutons « Payer » et « Commission manuelle » compris. L'autorisation se
  // décide donc ici, à la section, pas au bouton.
  const SECTIONS_GERANT = ['partners', 'commissions', 'orders', 'team', 'backup'];
  const sectionAutorisee = (tab) => {
    if (!KNOWN_TABS.includes(tab)) return false;
    if (tab === 'subsadmin') {
      return user.role === 'gerant' && (!isSupabaseConfigured || !!user.is_platform_admin);
    }
    return !SECTIONS_GERANT.includes(tab) || user.role === 'gerant';
  };
  const { section } = useParams();
  const navigate = useNavigate();
  // Repli immédiat sur le menu : aucun écran d'administration ne doit
  // s'afficher, même le temps d'une redirection.
  const activeTab = section && sectionAutorisee(section) ? section : 'menu';
  // …et l'adresse est corrigée, pour ne pas laisser croire à un droit d'accès.
  useEffect(() => {
    if (section && !sectionAutorisee(section)) navigate('/plus', { replace: true });
  }, [section, user.role, user.is_platform_admin]); // eslint-disable-line react-hooks/exhaustive-deps
  const setActiveTab = (x) => navigate(x === 'menu' ? '/plus' : `/plus/${x}`);
  const [comFilter, setComFilter] = useState('all');
  const [comPartner, setComPartner] = useState('all');
  const [payCom, setPayCom] = useState(null); // commission en cours de paiement
  const [payForm, setPayForm] = useState({ mode: 'momo', reference: '', note: '' });
  const [showAddCommission, setShowAddCommission] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [newCommission, setNewCommission] = useState({ partnerId: '', leadId: '', level: 1, amount: '' });
  const [subSheetOpen, setSubSheetOpen] = useState(false);
  const [subForm, setSubForm] = useState({ methode: 'momo', phone: user.phone || '', reference: '' });
  const [subSent, setSubSent] = useState(false);
  const [pendingRestore, setPendingRestore] = useState(null); // sauvegarde lue, en attente de confirmation
  const fileRef = useRef(null);
  const toast = useToast();

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const backup = await readBackupFile(file);
      setPendingRestore(backup); // confirmation avant remplacement des données
    } catch (err) {
      toast(err.message || 'Import impossible.', { type: 'error' });
    }
  };

  const copyPayNumber = async () => {
    try {
      await navigator.clipboard.writeText(PAY_NUMBER);
      toast('Numéro copié.');
    } catch {
      toast(`Copie impossible — composez le ${PAY_NUMBER}.`, { type: 'error' });
    }
  };

  const handleProClick = () => {
    if (proActive) {
      setMode('pro');
    } else {
      setSubSheetOpen(true);
    }
  };

  // /plus/gopro (bouton « Passer en mode Pro » de la barre latérale) :
  // abonné → bascule directe, sinon → ouverture du formulaire d'abonnement.
  // L'URL reste /plus/gopro tant que la fiche est ouverte (une redirection
  // immédiate remonterait l'écran et refermerait la fiche) ; le retour à
  // /plus se fait à la fermeture.
  useEffect(() => {
    if (section !== 'gopro') return;
    if (proActive) setMode('pro');
    else setSubSheetOpen(true);
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeSubSheet = () => {
    setSubSheetOpen(false);
    setSubSent(false);
    if (section === 'gopro') navigate('/plus', { replace: true });
  };

  const handleSubSubmit = (e) => {
    e.preventDefault();
    requestSubscription(user.id, subForm);
    setSubSent(true);
  };

  // Commissions de la PLATEFORME : une commission naît dans l'organisation de
  // son bénéficiaire, donc celles des commerciaux des autres comptes sont
  // invisibles ici — alors que c'est BestaSolar qui les doit. On les remonte.
  const isAdminPlateforme = isSupabaseConfigured && !!user.is_platform_admin;
  const [comExternes, setComExternes] = useState([]);
  const [comRafraichir, setComRafraichir] = useState(0);
  useEffect(() => {
    if (!isAdminPlateforme) return;
    fetchPlatformCommissions()
      .then((list) => setComExternes((list || []).map((c) => ({ ...c, externe: true }))))
      .catch(() => {});
  }, [isAdminPlateforme, comRafraichir]);

  const toutesCommissions = [...commissions, ...comExternes];
  const pendingCommissions = toutesCommissions.filter((c) => c.status === 'en_attente');
  const pendingTotal = pendingCommissions.reduce((sum, c) => sum + c.amount, 0);
  const paidTotal = toutesCommissions.filter((c) => c.status === 'payée').reduce((sum, c) => sum + c.amount, 0);
  // Nom du bénéficiaire / du client : le profil partenaire et la piste vivent
  // dans l'autre organisation, la vue plateforme les fournit déjà enrichis.
  const nomPartenaire = (c) => getPartnerById(c.partnerId)?.name || c.partnerName || c.beneficiaire?.name || '—';
  const nomClient = (c) => getLeadById(c.leadId)?.name || c.leadName || 'Commission manuelle';
  // Devis d'origine : déjà fourni par la vue plateforme, à retrouver localement
  // sinon — c'est lui qui rattache la commission à une affaire précise.
  const numeroDevis = (c) =>
    c.devisNumber || (c.devisId ? (devis || []).find((d) => d.id === c.devisId)?.devisNumber : null);

  const handlePay = (commission) => {
    setPayForm({ mode: 'momo', reference: '', note: '' });
    setPayCom(commission);
  };

  const submitPayCom = (e) => {
    e.preventDefault();
    if (payCom.externe) {
      payPlatformCommission({ orgId: payCom.orgId, id: payCom.id, ...payForm })
        .catch((err) => toast(`Paiement impossible : ${err.message}`, { type: 'error' }))
        .finally(() => setComRafraichir((n) => n + 1));
    } else {
      payCommission(payCom.id, { ...payForm, paidBy: user.id });
    }
    setPayCom(null);
  };

  // Reçu de paiement imprimable (commission payée).
  const openRecu = (commission) => {
    openHtmlDoc(buildRecuCommissionHtml({
      commission,
      partner: getPartnerById(commission.partnerId)
        || (commission.externe
          ? { name: commission.partnerName, code: commission.partnerCode, phone: commission.partnerPhone }
          : commission.beneficiaire),
      lead: getLeadById(commission.leadId)
        || (commission.externe && commission.leadName
          ? { name: commission.leadName, estimatedValue: Number(commission.leadValue) || 0 }
          : null),
      payeur: commission.paidBy ? { name: (data.team || []).find((u) => u.id === commission.paidBy)?.name || user.name } : { name: user.name },
      rates: COMMISSION_RATES,
    }));
  };

  // Relevé imprimable de toutes les commissions d'un partenaire.
  const openReleve = (partnerId) => {
    const lignes = toutesCommissions.filter((c) => c.partnerId === partnerId);
    const externe = lignes.find((c) => c.externe);
    const partner = getPartnerById(partnerId)
      || (externe ? { name: externe.partnerName, code: externe.partnerCode, phone: externe.partnerPhone } : null);
    if (!partner) return;
    openHtmlDoc(buildReleveCommissionsHtml({
      partner,
      commissions: lignes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      getLeadName: (leadId) => getLeadById(leadId)?.name
        || lignes.find((c) => c.leadId === leadId)?.leadName,
      rates: COMMISSION_RATES,
    }));
  };

  // Rattrapage des commissions : recense les affaires validées (pistes
  // gagnées, conversions devis validées) sans commission, puis les crée.
  const handleSyncCommissions = () => {
    const missing = reconcileMissingCommissions(
      { leads, devis, partners, commissions, referrals },
      COMMISSION_RATES,
      new Date().toISOString().slice(0, 10)
    );
    syncCommissions();
    setSyncMsg(
      missing.length
        ? `${missing.length} commission(s) manquante(s) retrouvée(s) et ajoutée(s) en attente de paiement.`
        : 'Tout est à jour : aucune commission manquante sur les affaires validées.'
    );
  };

  const handleAddCommission = (e) => {
    e.preventDefault();
    // Bénéficiaire : « user:<id> » pour un membre de l'équipe (son profil
    // partenaire est créé au besoin), sinon l'id d'un partenaire externe.
    const choix = newCommission.partnerId;
    const membre = choix.startsWith('user:') ? team.find((u) => u.id === choix.slice(5)) : null;
    addCommission({
      partnerId: membre ? null : choix,
      beneficiaire: membre ? { userId: membre.id, name: membre.name, phone: membre.phone, email: membre.email } : null,
      leadId: newCommission.leadId || null,
      level: Number(newCommission.level),
      amount: Number(newCommission.amount) || 0,
    });
    setNewCommission({ partnerId: '', leadId: '', level: 1, amount: '' });
    setShowAddCommission(false);
  };

  // Pré-remplit le montant selon l'affaire et le taux du niveau choisi
  const suggestAmount = (leadId, level) => {
    const lead = getLeadById(leadId);
    return lead ? Math.round(lead.estimatedValue * COMMISSION_RATES[level]) : '';
  };

  const BackButton = () => (
    <button className="btn btn-outline btn-sm back-button back-to-plus" onClick={() => setActiveTab('menu')}>
      <ChevronLeft size={16} /> Retour
    </button>
  );

  const renderPartners = () => <PartnersSection onBack={() => setActiveTab('menu')} />;

  // Le filtre par partenaire couvre aussi les apporteurs des autres comptes,
  // sinon leurs commissions seraient impossibles à isoler et à relever.
  const partenairesDuFiltre = [
    ...partners.map((p) => ({ id: p.id, name: p.name, orgName: null })),
    ...comExternes.reduce((acc, c) => {
      if (c.partnerId && !acc.some((p) => p.id === c.partnerId)) {
        acc.push({ id: c.partnerId, name: c.partnerName || c.partnerId, orgName: c.orgName });
      }
      return acc;
    }, []),
  ];

  const filteredCommissions = toutesCommissions
    .filter((c) => comFilter === 'all' || c.status === comFilter)
    .filter((c) => comPartner === 'all' || c.partnerId === comPartner)
    .sort((a, b) => (a.status === 'en_attente' ? -1 : 1) - (b.status === 'en_attente' ? -1 : 1) || new Date(b.createdAt) - new Date(a.createdAt));

  const renderCommissions = () => (
    <>
      <div className="commissions-toolbar">
        <BackButton />
        <div className="com-toolbar-actions">
          <button className="btn btn-outline btn-sm" onClick={handleSyncCommissions} title="Recrée les commissions manquantes sur les affaires déjà validées">
            <RefreshCw size={15} /> Synchroniser
          </button>
          <button className="btn btn-accent btn-sm" onClick={() => setShowAddCommission(true)}>
            <PlusIcon size={16} /> Commission manuelle
          </button>
        </div>
      </div>
      {syncMsg && <div className="sync-result-note">{syncMsg}</div>}
      <div className="commission-totals">
        <div className="commission-total-card pending">
          <div className="commission-total-value">{formatCFA(pendingTotal)}</div>
          <div className="commission-total-label">{pendingCommissions.length} en attente</div>
        </div>
        <div className="commission-total-card paid">
          <div className="commission-total-value">{formatCFA(paidTotal)}</div>
          <div className="commission-total-label">Total payé</div>
        </div>
      </div>
      <div className="com-toolbar">
        <div className="categories-scroll">
          {[['all', 'Toutes'], ['en_attente', 'En attente'], ['payée', 'Payées']].map(([id, label]) => (
            <button key={id} className={`category-chip ${comFilter === id ? 'active' : ''}`} aria-pressed={comFilter === id} onClick={() => setComFilter(id)}>{label}</button>
          ))}
        </div>
        <div className="com-partner-tools">
          <select className="input sort-select" value={comPartner} onChange={(e) => setComPartner(e.target.value)} aria-label="Filtrer par partenaire">
            <option value="all">Tous les partenaires</option>
            {partenairesDuFiltre.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.orgName ? ` · ${p.orgName}` : ''}</option>
            ))}
          </select>
          <button className="btn btn-sm btn-outline" disabled={comPartner === 'all'} onClick={() => openReleve(comPartner)}
            title={comPartner === 'all' ? 'Choisissez un partenaire pour générer son relevé' : 'Relevé de commissions imprimable'}>
            <Download size={15} /> Relevé
          </button>
        </div>
      </div>
      <div className="commissions-list">
        {filteredCommissions.map((commission) => (
          <div
            key={`${commission.orgId || 'moi'}-${commission.id}`}
            className={`card commission-card ${commission.status === 'payée' ? 'is-paid' : 'is-pending'}`}
          >
            <div className="commission-top">
              <div className="commission-ident">
                <div className="commission-lead">{nomClient(commission)}</div>
                <div className="commission-sub">
                  <span className="chip-level">
                    N{commission.level} · {formatTaux(COMMISSION_RATES[commission.level])}
                  </span>
                  <span className="commission-partner">{nomPartenaire(commission)}</span>
                  {numeroDevis(commission) && <span className="commission-ref">{numeroDevis(commission)}</span>}
                  {commission.externe && commission.orgName && (
                    <span className="commission-ref">{commission.orgName}</span>
                  )}
                </div>
              </div>
              <div className="commission-right">
                <div className="commission-amount">{formatCFA(commission.amount)}</div>
                <span className={`badge ${commission.status === 'payée' ? 'badge-success' : 'badge-warning'}`}>
                  {commission.status === 'payée' ? 'Payée' : 'À payer'}
                </span>
              </div>
            </div>
            {/* Pied de carte : la date reste discrète, l'action se tient à
                droite et garde sa largeur naturelle — étirée sur toute la
                carte, elle se lisait comme un champ de saisie vide. */}
            <div className="commission-foot">
              <span className="commission-date">
                {commission.status === 'payée'
                  ? `Payée le ${formatDate(commission.paidAt)} · ${PAY_MODE_LABEL[commission.payMode] || 'Mobile Money'}${commission.payRef ? ` · réf. ${commission.payRef}` : ''}`
                  : `Créée le ${formatDate(commission.createdAt)}`}
              </span>
              {commission.status === 'payée' ? (
                <button className="btn btn-sm btn-outline" onClick={() => openRecu(commission)}>
                  <Download size={14} /> Reçu
                </button>
              ) : (
                <button className="btn btn-sm btn-success" onClick={() => handlePay(commission)}>
                  <CheckCircle size={15} /> Payer {formatCFA(commission.amount)}
                </button>
              )}
            </div>
          </div>
        ))}
        {filteredCommissions.length === 0 && <EmptyState card>Aucune commission dans ce filtre.</EmptyState>}
      </div>
    </>
  );

  const renderProfile = () => <MyProfile onBack={() => setActiveTab('menu')} />;

  const renderBackup = () => (
    <>
      <BackButton />
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">Sauvegarde des données</div>
        <p className="text-sm text-secondary">
          Exportez régulièrement toutes vos données (clients, devis, factures, partenaires, commissions…)
          dans un fichier. Vous pourrez les restaurer en cas de perte ou de changement d'appareil.
        </p>
        <button className="btn btn-primary btn-block" onClick={() => downloadBackup(data)}>
          <Download size={17} /> Exporter (télécharger)
        </button>
        <input
          ref={fileRef} type="file" accept="application/json,.json"
          onChange={handleImportFile} style={{ display: 'none' }}
          aria-label="Fichier de sauvegarde à importer"
        />
        <button className="btn btn-outline btn-block" style={{ marginTop: 10 }} onClick={() => fileRef.current?.click()}>
          <Upload size={17} /> Importer (restaurer)
        </button>
        <p className="field-hint">L'import remplace les données actuelles — exportez d'abord par sécurité.</p>
      </div>
    </>
  );

  // Entrée de menu générique (icône, titre, sous-titre, action).
  const MenuItem = ({ icon: Icon, tone = '', title, subtitle, onClick }) => (
    <button className="menu-item" onClick={onClick}>
      <div className={`menu-item-icon ${tone}`}><Icon size={18} /></div>
      <div className="menu-item-info">
        <div className="menu-item-title">{title}</div>
        <div className="menu-item-subtitle">{subtitle}</div>
      </div>
      <ChevronRight size={18} className="menu-item-arrow" />
    </button>
  );

  const renderMenu = () => (
    <div className="plus-grid">
      {/* Accès Pro mis en avant (le profil vit dans « Mon profil ») */}
      <button className="pro-cta card" onClick={handleProClick}>
          <div className="pro-cta-icon"><Crown size={24} /></div>
          <div className="pro-cta-info">
            <div className="pro-cta-title">Passer en mode Pro</div>
            <div className="pro-cta-subtitle">
              {proActive
                ? 'Ouvrir mon espace entreprise : devis, factures, encaissements et clients.'
                : `Devis & factures à votre identité, suivi des paiements — ${formatCFA(SUBSCRIPTION_PRICE)}/mois.`}
            </div>
          </div>
          <ChevronRight size={20} className="pro-cta-arrow" />
        </button>
      <div className="sync-inline"><SyncStatusRow /></div>

      {/* Parrainage de l'entreprise : attribution unique, ensuite verrouillée
          (seul BestaSolar peut la modifier, sur demande du partenaire).
          Visible pour le gérant — ou l'utilisateur seul dans son espace. */}
      {isSupabaseConfigured && user.org && estProprietaireEspace(user, team, teamChargee) && (
        <div className="card">
          <div className="sheet-section-title"><Handshake size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Parrainage</div>
          {user.org.referred_by ? (
            <>
              <div className="sheet-row">
                <span className="sheet-label">Parrainé par</span>
                <span className="sheet-value"><span className="flat-badge">{user.org.referred_by}</span></span>
              </div>
              <div className="field-hint">Ce code est définitif — pour toute correction, le partenaire doit en faire la demande à BestaSolar.</div>
            </>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!refInput.trim()) return;
                setRefSaving(true);
                try {
                  await setOrgReferral(refInput);
                  await refreshOrg();
                  toast('Code de parrainage enregistré.');
                } catch (err) {
                  toast(err.message || 'Attribution impossible.', { type: 'error' });
                } finally {
                  setRefSaving(false);
                }
              }}
            >
              <p className="text-sm text-secondary" style={{ marginBottom: 10 }}>
                Un partenaire BestaSolar vous a recommandé ? Saisissez son code — attention,
                ce choix est <strong>définitif</strong>.
              </p>
              <div className="momo-input-row">
                <input className="input" value={refInput} onChange={(e) => setRefInput(e.target.value.toUpperCase())} placeholder="BESTA-…" aria-label="Code partenaire" />
                <button type="submit" className="btn btn-primary" disabled={refSaving || !refInput.trim()}>
                  {refSaving ? '…' : 'Attribuer'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Sections thématiques */}
      <div className="plus-sections">
        {user.role === 'gerant' && (
          <div className="plus-section">
            <div className="plus-section-label">Gestion</div>
            <div className="plus-card card">
              <MenuItem icon={Users} title="Équipe" subtitle="Profils des techniciens et performances" onClick={() => setActiveTab('team')} />
              <MenuItem icon={Users} title="Partenaires" subtitle={`${partners.length} partenaires · réseau 2 niveaux`} onClick={() => setActiveTab('partners')} />
              <MenuItem icon={DollarSign} title="Commandes en ligne" subtitle={`${(orders || []).filter((o) => o.status === 'initie').length} à confirmer`} onClick={() => setActiveTab('orders')} />
              <MenuItem icon={DollarSign} title="Commissions" subtitle={pendingCommissions.length > 0 ? `${formatCFA(pendingTotal)} en attente` : 'Tout est payé'} onClick={() => setActiveTab('commissions')} />
              {/* Administration du SaaS : en mode backend, réservée à l'admin
                  plateforme (le serveur refuse de toute façon l'activation
                  d'un abonnement à quiconque d'autre). */}
              {(!isSupabaseConfigured || user.is_platform_admin) && (
                <MenuItem icon={Crown} title="Abonnements Devis Pro" subtitle="Abonnés, paiements à valider, MRR" onClick={() => setActiveTab('subsadmin')} />
              )}
            </div>
          </div>
        )}

        <div className="plus-section">
          <div className="plus-section-label">Clients</div>
          <div className="plus-card card">
            <MenuItem icon={Users} title="Clients" subtitle="Carnet d'adresses : ajouter et retrouver vos clients" onClick={() => navigate('/clients')} />
          </div>
        </div>

        <div className="plus-section">
          <div className="plus-section-label">Apprendre & gagner</div>
          <div className="plus-card card">
            <MenuItem icon={GraduationCap} title="Formation" subtitle="Cours en ligne : modules, leçons et progression" onClick={() => setActiveTab('formation')} />
            <MenuItem icon={Share2} title="Mon espace partenaire" subtitle="Mon code, mon lien, mes commissions" onClick={() => setActiveTab('mypartner')} />
          </div>
        </div>

        <div className="plus-section">
          <div className="plus-section-label">Compte</div>
          <div className="plus-card card">
            <MenuItem icon={User} title="Mon profil" subtitle="Voir vos informations" onClick={() => setActiveTab('profile')} />
            {user.role === 'gerant' && (
              <MenuItem icon={DatabaseBackup} title="Sauvegarde des données" subtitle="Exporter / restaurer toutes les données" onClick={() => setActiveTab('backup')} />
            )}
            <MenuItem icon={LogOut} tone="danger" title="Déconnexion" subtitle="Quitter l'application" onClick={logout} />
          </div>
        </div>
      </div>
    </div>
  );

  // Le titre de page suit la sous-section : arriver sur /plus/commissions
  // depuis la barre latérale doit afficher « Commissions », pas « Plus ».
  const TAB_TITLES = {
    menu: 'Plus', partners: 'Partenaires', commissions: 'Commissions',
    orders: 'Commandes en ligne', team: 'Équipe', formation: 'Formation',
    subsadmin: 'Abonnements Pro', mypartner: 'Mon espace partenaire',
    profile: 'Mon profil', backup: 'Sauvegarde',
  };

  return (
    <div className="page">
      <PageHeader
        title={TAB_TITLES[activeTab] || 'Plus'}
        onBack={activeTab !== 'menu' ? () => navigate('/plus') : undefined}
      />
      {/* La formation s'étale en large (catalogue + école) ; le reste garde la colonne étroite. */}
      <div className={`page-content ${activeTab === 'formation' ? 'page-content-wide' : 'page-content-narrow'}`}>
        {activeTab === 'menu' && renderMenu()}
        {activeTab === 'partners' && renderPartners()}
        {activeTab === 'commissions' && renderCommissions()}
        {activeTab === 'orders' && <OrdersSection onBack={() => setActiveTab('menu')} />}
        {activeTab === 'team' && <TeamSection onBack={() => setActiveTab('menu')} />}
        {activeTab === 'formation' && <FormationSection onBack={() => setActiveTab('menu')} />}
        {activeTab === 'subsadmin' && <SubscriptionsAdmin onBack={() => setActiveTab('menu')} />}
        {activeTab === 'mypartner' && <MyPartnerDashboard onBack={() => setActiveTab('menu')} />}
        {activeTab === 'profile' && renderProfile()}
        {activeTab === 'backup' && renderBackup()}
      </div>

      {/* Commission manuelle */}
      <Sheet open={showAddCommission} onClose={() => setShowAddCommission(false)} title="Commission manuelle">
        <form onSubmit={handleAddCommission} className="form-grid">
          <Field label="Bénéficiaire *">
            <select
              className="input" required value={newCommission.partnerId}
              onChange={(e) => setNewCommission({ ...newCommission, partnerId: e.target.value })}
            >
              <option value="" disabled>Choisir un bénéficiaire…</option>
              {/* Toute l'équipe est commissionnable : les membres sans profil
                  partenaire en reçoivent un automatiquement à la création. */}
              <optgroup label="Mon équipe">
                {team.map((u) => (
                  <option key={`u-${u.id}`} value={`user:${u.id}`}>
                    {u.name}{u.role === 'gerant' ? ' (gérant)' : ''}
                  </option>
                ))}
              </optgroup>
              {partners.filter((p) => !p.userId || !team.some((u) => u.id === p.userId)).length > 0 && (
                <optgroup label="Partenaires externes">
                  {partners.filter((p) => !p.userId || !team.some((u) => u.id === p.userId))
                    .map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
              )}
            </select>
          </Field>
          <Field label="Affaire liée (optionnel)">
            <select
              className="input" value={newCommission.leadId}
              onChange={(e) => {
                const leadId = e.target.value;
                setNewCommission((c) => ({ ...c, leadId, amount: suggestAmount(leadId, c.level) || c.amount }));
              }}
            >
              <option value="">Aucune</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.name} — {formatCFA(l.estimatedValue)}</option>)}
            </select>
          </Field>
          <Field label="Niveau">
            <select
              className="input" value={newCommission.level}
              onChange={(e) => {
                const level = Number(e.target.value);
                setNewCommission((c) => ({ ...c, level, amount: suggestAmount(c.leadId, level) || c.amount }));
              }}
            >
              <option value={1}>Niveau 1 ({formatTaux(COMMISSION_RATES[1])})</option>
              <option value={2}>Niveau 2 ({formatTaux(COMMISSION_RATES[2])})</option>
            </select>
          </Field>
          <Field label="Montant (F CFA) *">
            <input
              className="input" type="number" min="1" required
              value={newCommission.amount}
              onChange={(e) => setNewCommission({ ...newCommission, amount: e.target.value })}
              placeholder="0"
            />
          </Field>
          <button type="submit" className="btn btn-primary btn-block"><PlusIcon size={18} /> Créer la commission</button>
        </form>
      </Sheet>

      {/* Abonnement Devis Pro */}
      {/* Paiement tracé d'une commission (mode + référence, pour le reçu) */}
      <Sheet open={!!payCom} onClose={() => setPayCom(null)} title="Payer la commission">
        {payCom && (
          <form onSubmit={submitPayCom}>
            <div className="sheet-row"><span className="sheet-label">Partenaire</span><span className="sheet-value">{getPartnerById(payCom.partnerId)?.name}</span></div>
            {getPartnerById(payCom.partnerId)?.momoNumber && (
              <div className="sheet-row"><span className="sheet-label">N° Mobile Money</span><span className="sheet-value">{getPartnerById(payCom.partnerId).momoNumber}</span></div>
            )}
            <div className="sheet-row"><span className="sheet-label">Montant</span><span className="sheet-value amount">{formatCFA(payCom.amount)}</span></div>
            <Field label="Mode de règlement">
              <select className="input" value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}>
                <option value="momo">Mobile Money</option>
                <option value="especes">Espèces</option>
                <option value="virement">Virement bancaire</option>
                <option value="cheque">Chèque</option>
              </select>
            </Field>
            <Field label="Référence de la transaction">
              <input className="input" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder="N° de transaction MoMo, réf. virement…" />
            </Field>
            <Field label="Note (facultatif)">
              <input className="input" value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} />
            </Field>
            <button type="submit" className="btn btn-won btn-block"><CheckCircle size={17} /> Confirmer le paiement</button>
            <p className="field-hint">Le reçu imprimable reprendra le mode et la référence saisis.</p>
          </form>
        )}
      </Sheet>

      <Sheet open={subSheetOpen} onClose={closeSubSheet} title="Passer en mode Pro">
        <div className="pro-paywall-icon" style={{ textAlign: 'center', marginBottom: 8 }}><Crown size={28} /></div>
        <p className="pro-paywall-price" style={{ textAlign: 'center', marginBottom: 16 }}>
          <strong>{formatCFA(SUBSCRIPTION_PRICE)}</strong> / mois
        </p>
        <ul className="pro-benefits" style={{ marginBottom: 20 }}>
          <li><Check size={15} /> Devis personnalisés à <strong>votre entreprise</strong></li>
          <li><Check size={15} /> Génération de <strong>factures</strong> numérotées</li>
          <li><Check size={15} /> <strong>3 modèles</strong> de mise en page professionnels</li>
          <li><Check size={15} /> Conversion devis → facture en un clic</li>
        </ul>

        {subSent || subStatus === 'en_attente_paiement' ? (
          <div className="pro-pending">
            <Clock size={18} />
            <div>
              <strong>Paiement en attente de validation</strong>
              <div className="text-sm text-secondary">
                Votre abonnement sera activé dès que le gérant aura confirmé la réception de votre paiement.
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubSubmit}>
            <div className="form-row-2">
              <Field label="Opérateur">
                <select className="input" value={subForm.methode} onChange={(e) => setSubForm({ ...subForm, methode: e.target.value })}>
                  <option value="momo">MTN MoMo</option>
                  <option value="moov">Moov Money</option>
                </select>
              </Field>
              <Field label="Votre numéro">
                <input className="input" type="tel" required value={subForm.phone} onChange={(e) => setSubForm({ ...subForm, phone: e.target.value })} placeholder="+229 ..." />
              </Field>
            </div>
            <p className="text-sm">Envoyez {formatCFA(SUBSCRIPTION_PRICE)} par Mobile Money à ce numéro, puis validez :</p>
            <div className="copy-block">
              <span className="copy-block-value">{PAY_NUMBER}</span>
              <button type="button" className="btn btn-sm btn-outline" onClick={copyPayNumber}>Copier</button>
            </div>
            <Field label="Référence de la transaction (optionnel)">
              <input className="input" value={subForm.reference} onChange={(e) => setSubForm({ ...subForm, reference: e.target.value })} placeholder="Ex : ID du transfert MoMo" />
            </Field>
            <button type="submit" className="btn btn-accent btn-block btn-lg">
              <Crown size={18} /> S'abonner — {formatCFA(SUBSCRIPTION_PRICE)}/mois
            </button>
          </form>
        )}
      </Sheet>

      {/* Confirmation avant restauration d'une sauvegarde (remplace les données) */}
      <ConfirmSheet
        open={!!pendingRestore}
        onClose={() => setPendingRestore(null)}
        onConfirm={() => {
          importData(pendingRestore);
          toast('Sauvegarde restaurée avec succès.');
        }}
        title="Restaurer la sauvegarde"
        message={pendingRestore
          ? [
              `Sauvegarde du ${formatDate(pendingRestore.exportedAt)}.`,
              'Toutes les données actuelles seront remplacées par celles du fichier.',
              // En mode SaaS la restauration se réplique : ce qui a été créé
              // depuis cette sauvegarde sera supprimé pour TOUTE l'équipe.
              isSupabaseConfigured
                ? 'Attention : cette restauration est synchronisée. Tout ce qui a été créé depuis cette date sera supprimé sur le serveur et sur les appareils de votre équipe.'
                : 'Cette action ne peut pas être annulée.',
            ].join(' ')
          : ''}
        confirmLabel="Restaurer"
        danger
      />
    </div>
  );
}
