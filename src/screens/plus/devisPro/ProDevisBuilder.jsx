import { useMemo, useState } from 'react';
import { Plus, Trash2, Check, User, Building2, Package } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { formatCFA } from '../../../utils/format';
import { computeFactureTotals } from '../../../utils/facture';
import Field from '../../../components/Field';

const EMPTY_CLIENT = { name: '', phone: '', ville: '', type: 'particulier' };

/**
 * Génération d'un devis en mode Pro : le technicien compose ligne par ligne
 * à partir du catalogue boutique (prix/quantité/désignation modifiables) et
 * peut ajouter des produits personnalisés hors catalogue. Pas de suggestion
 * de devis « complet » (dimensionnement) ici : sélection manuelle uniquement.
 */
export default function ProDevisBuilder({ onDone }) {
  const { user } = useAuth();
  const { products, proClientsForUser, addProClient, addDevis, getCompanyForUser } = useData();

  const myClients = proClientsForUser(user.id);
  const company = getCompanyForUser(user.id);

  const [clientMode, setClientMode] = useState(myClients.length ? 'existing' : 'new');
  const [clientId, setClientId] = useState(myClients[0]?.id || '');
  const [newClient, setNewClient] = useState(EMPTY_CLIENT);
  const [pickerId, setPickerId] = useState('');
  const [lignes, setLignes] = useState([]); // { productId?, designation, qty, pu }
  const [tvaActive, setTvaActive] = useState(company?.assujettieVAT || false);

  const setLigne = (i, patch) => setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const removeLigne = (i) => setLignes((ls) => ls.filter((_, j) => j !== i));

  const addFromCatalogue = () => {
    const p = products.find((x) => x.id === pickerId);
    if (!p) return;
    setLignes((ls) => [...ls, { productId: p.id, designation: p.name, qty: 1, pu: p.basePrice }]);
    setPickerId('');
  };
  const addCustom = () => setLignes((ls) => [...ls, { designation: '', qty: 1, pu: '' }]);

  const totals = useMemo(
    () => computeFactureTotals(lignes.map((l) => ({ pu: Number(l.pu) || 0, qty: Number(l.qty) || 0 })), tvaActive),
    [lignes, tvaActive]
  );

  const cleanLignes = () =>
    lignes
      .filter((l) => l.designation.trim() && Number(l.pu) > 0)
      .map((l) => ({ designation: l.designation.trim(), qty: Math.max(1, Number(l.qty) || 1), pu: Number(l.pu), ...(l.productId ? { productId: l.productId } : {}) }));

  const canSubmit =
    (clientMode === 'new' ? newClient.name.trim() : clientId) && cleanLignes().length > 0;

  const submit = () => {
    const finalLignes = cleanLignes();
    if (!finalLignes.length) return;

    let client;
    if (clientMode === 'new') {
      if (!newClient.name.trim()) return;
      const created = addProClient({ userId: user.id, name: newClient.name.trim(), phone: newClient.phone.trim(), ville: newClient.ville.trim(), type: newClient.type });
      client = created;
    } else {
      client = myClients.find((c) => c.id === clientId);
      if (!client) return;
    }

    const t = computeFactureTotals(finalLignes, tvaActive);
    addDevis({
      type: 'pro',
      leadId: null,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone || '',
      clientVille: client.ville || '',
      lignes: finalLignes,
      subtotal: t.totalHT,
      tvaActive,
      tva: t.tva,
      total: t.totalTTC,
      createdBy: user.id,
      pro: true,
    });
    onDone();
  };

  return (
    <div className="wizard-form card">
      {/* ---- Client ---- */}
      <div className="wizard-step-title">1. Client</div>
      <div className="client-type-toggle" role="group" aria-label="Source du client" style={{ marginBottom: 14 }}>
        <button type="button" className={`client-type-btn ${clientMode === 'existing' ? 'active' : ''}`} onClick={() => setClientMode('existing')} disabled={!myClients.length}>
          Client existant
        </button>
        <button type="button" className={`client-type-btn ${clientMode === 'new' ? 'active' : ''}`} onClick={() => setClientMode('new')}>
          <Plus size={15} /> Nouveau client
        </button>
      </div>

      {clientMode === 'existing' ? (
        <Field label="Choisir un client">
          <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {!myClients.length && <option value="">Aucun client — créez-en un</option>}
            {myClients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.ville ? ` — ${c.ville}` : ''}</option>
            ))}
          </select>
        </Field>
      ) : (
        <>
          <Field label="Nom du client *">
            <input className="input" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} placeholder="Nom / raison sociale" />
          </Field>
          <div className="client-type-toggle" role="group" aria-label="Type de client" style={{ marginBottom: 14 }}>
            <button type="button" className={`client-type-btn ${newClient.type === 'particulier' ? 'active' : ''}`} onClick={() => setNewClient({ ...newClient, type: 'particulier' })}>
              <User size={16} /> Particulier
            </button>
            <button type="button" className={`client-type-btn ${newClient.type === 'entreprise' ? 'active' : ''}`} onClick={() => setNewClient({ ...newClient, type: 'entreprise' })}>
              <Building2 size={16} /> Entreprise
            </button>
          </div>
          <div className="form-row-2">
            <Field label="Téléphone">
              <input className="input" type="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} placeholder="+229 ..." />
            </Field>
            <Field label="Ville">
              <input className="input" value={newClient.ville} onChange={(e) => setNewClient({ ...newClient, ville: e.target.value })} />
            </Field>
          </div>
          <div className="field-hint" style={{ marginBottom: 8 }}>Ce client sera ajouté à votre carnet.</div>
        </>
      )}

      {/* ---- Produits ---- */}
      <div className="wizard-step-title" style={{ marginTop: 8 }}>2. Produits</div>
      <div className="appliance-picker">
        <select className="input" value={pickerId} onChange={(e) => setPickerId(e.target.value)}>
          <option value="">Ajouter depuis la boutique…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({formatCFA(p.basePrice)})</option>
          ))}
        </select>
        <button type="button" className="btn btn-primary" onClick={addFromCatalogue} disabled={!pickerId}>
          <Plus size={16} /> Ajouter
        </button>
      </div>
      <button type="button" className="btn btn-sm btn-outline facture-add-ligne" onClick={addCustom}>
        <Package size={14} /> Ajouter un produit personnalisé
      </button>

      {lignes.length ? (
        <div className="appliance-list">
          {lignes.map((l, i) => (
            <div key={i} className="appliance-row">
              <div className="appliance-row-main">
                <input className="input" placeholder="Désignation" aria-label="Désignation" value={l.designation}
                  onChange={(e) => setLigne(i, { designation: e.target.value })} />
                <button type="button" className="appliance-delete" onClick={() => removeLigne(i)} aria-label="Supprimer"><Trash2 size={15} /></button>
              </div>
              <div className="form-row-2">
                <Field label="Quantité">
                  <input className="input" type="number" min="1" value={l.qty} onChange={(e) => setLigne(i, { qty: e.target.value })} />
                </Field>
                <Field label="Prix unitaire (F CFA)">
                  <input className="input" type="number" min="0" value={l.pu} onChange={(e) => setLigne(i, { pu: e.target.value })} placeholder="0" />
                </Field>
              </div>
              <div className="appliance-row-consumption">
                <span>Sous-total : {formatCFA((Number(l.pu) || 0) * (Number(l.qty) || 0))}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">Ajoutez des produits de la boutique ou un produit personnalisé.</div>
      )}

      <label className="pro-tva-toggle">
        <input type="checkbox" checked={tvaActive} onChange={(e) => setTvaActive(e.target.checked)} />
        Appliquer la TVA 18 % <span className="text-secondary">(exonérée par défaut sur le solaire au Bénin)</span>
      </label>

      <div className="devis-summary">
        <div className="devis-summary-row"><span>Total HT</span><span>{formatCFA(totals.totalHT)}</span></div>
        <div className="devis-summary-row"><span>TVA</span><span>{tvaActive ? formatCFA(totals.tva) : 'Exonérée'}</span></div>
        <div className="devis-summary-row total"><span>Total TTC</span><span>{formatCFA(totals.totalTTC)}</span></div>
      </div>

      <button className="btn btn-accent btn-block" onClick={submit} disabled={!canSubmit}>
        <Check size={18} /> Créer le devis
      </button>
    </div>
  );
}
