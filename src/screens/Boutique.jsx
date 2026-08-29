import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Pencil, Trash2, Camera, Check, ShoppingCart, FileText, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useCart } from '../context/CartContext';
import KkiapayButton from '../components/KkiapayButton';
import { formatCFA } from '../utils/format';
import { fileToResizedDataUrl } from '../utils/image';
import { extractPowerWatts, POWER_RANGES, PRICE_RANGES } from '../utils/power';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';
import ConfirmSheet from '../components/ConfirmSheet';
import Field from '../components/Field';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { prixPublic, PUBLIC_MARKUP } from '../utils/price';

const EMPTY_FORM = { name: '', description: '', basePrice: '', stock: '', suiviStock: false, category: 'kits', image: '' };

export default function Boutique() {
  const { user } = useAuth();
  const { products, productCategories, addProduct, updateProduct, deleteProduct, addOrder, marquerCommandePayee } = useData();
  const { items: cartItems, addItem, setQty, removeItem, clearCart, count } = useCart();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [priceRange, setPriceRange] = useState('all');
  const [powerRange, setPowerRange] = useState('all');
  // null = fermé, 'new' = création, sinon id du produit en édition
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [cartOpen, setCartOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  // Paiement en ligne : null fermé, 'form' saisie, sinon la commande confirmée
  const [payment, setPayment] = useState(null);
  const [payForm, setPayForm] = useState({ operator: 'T-Money (Yas)', phone: '' });
  const [justAdded, setJustAdded] = useState(null);
  // Confirmations (remplacent window.confirm) : vidage du panier, suppression produit.
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef(null);
  const toast = useToast();

  const detailProduct = products.find((p) => p.id === detailId);

  const isManager = user.role === 'gerant';
  // La boutique est accessible aux techniciens : ils peuvent donc également
  // payer leur panier en ligne. La commande garde l'identité de l'acheteur,
  // ce qui permet son suivi, quelle que soit son organisation.
  const canPayOnline = true;
  // Prix PUBLIC toujours — même prix que sur un devis, peu importe le rôle.
  const getPrice = (basePrice) => prixPublic(basePrice);
  const categoryLabel = (id) => productCategories.find((c) => c.id === id)?.label || '';

  const handleAddToCart = (product) => {
    addItem(product.id);
    setJustAdded(product.id);
    setTimeout(() => setJustAdded((cur) => (cur === product.id ? null : cur)), 1200);
  };

  const cartProducts = Object.entries(cartItems)
    .map(([id, qty]) => ({ product: products.find((p) => p.id === id), qty }))
    .filter((e) => e.product);
  const cartTotal = cartProducts.reduce((s, e) => s + getPrice(e.product.basePrice) * e.qty, 0);

  const goToDevis = () => {
    setCartOpen(false);
    navigate('/devis', { state: { fromCart: true } });
  };

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditing('new');
  };

  const openEdit = (product) => {
    setForm({
      name: product.name,
      description: product.description,
      basePrice: String(product.basePrice),
      stock: String(product.stock),
      suiviStock: Boolean(product.suiviStock),
      category: product.category,
      image: product.image,
    });
    setEditing(product.id);
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setForm((f) => ({ ...f, image: dataUrl }));
    } catch {
      toast('Impossible de lire cette image. Essayez avec une autre photo.', { type: 'error' });
    }
    e.target.value = '';
  };

  const handleSave = (e) => {
    e.preventDefault();
    const data = {
      name: form.name.trim(),
      description: form.description.trim(),
      basePrice: Math.max(0, Number(form.basePrice) || 0),
      stock: Math.max(0, Math.round(Number(form.stock) || 0)),
      suiviStock: form.suiviStock,
      category: form.category,
      image: form.image,
    };
    if (editing === 'new') addProduct(data);
    else updateProduct(editing, data);
    setEditing(null);
  };

  const handleDelete = () => setConfirmDelete(true);

  // Filtre + tri mémoïsés : ne recalcule (et ne relance les regex de puissance)
  // que si une entrée réelle change — pas sur l'ajout au panier ou l'ouverture
  // d'une fiche.
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const priceFilter = PRICE_RANGES.find((r) => r.id === priceRange);
    const powerFilter = POWER_RANGES.find((r) => r.id === powerRange);
    return products
      .filter((p) => !selectedCategory || p.category === selectedCategory)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
      .filter((p) => {
        if (priceRange === 'all') return true;
        const price = getPrice(p.basePrice);
        return price >= priceFilter.min && price < priceFilter.max;
      })
      .filter((p) => {
        if (powerRange === 'all') return true;
        const w = extractPowerWatts(p.name);
        return w !== null && w >= powerFilter.min && w < powerFilter.max;
      })
      .sort((a, b) => (a.suiviStock && a.stock === 0) - (b.suiviStock && b.stock === 0));
  // getPrice n'est pas listé : il est stable (ne dépend d'aucun état) et
  // serait recréé à chaque rendu, invalidant le mémo en vain.
  }, [products, selectedCategory, search, priceRange, powerRange]);

  const handlePayOnline = () => {
    setPayForm({ operator: 'T-Money (Yas)', phone: user.phone || '' });
    setCartOpen(false);
    setPayment('form');
  };

  // Retour d'un paiement KKiaPay sur une commande. Le verdict vient du
  // serveur, qui a comparé le montant reçu au TOTAL DE LA COMMANDE en base —
  // pas à celui annoncé par cet écran.
  const paiementCommande = (reference, verdict = {}) => {
    if (verdict.refuse) {
      toast(verdict.motif || 'Paiement non abouti.', { type: 'error' });
      return;
    }
    if (!verdict.active) {
      toast('Paiement enregistré — vérification par BestaSolar en attente.');
      return;
    }
    marquerCommandePayee(payment.id, { reference, montant: verdict.montant || payment.total });
    setPayment((o) => (o && o !== 'form' ? { ...o, paiement: { statut: 'verifie', reference } } : o));
    toast(verdict.deja ? 'Ce paiement était déjà pris en compte.' : 'Paiement vérifié — commande réglée.');
  };

  const confirmPayment = (e) => {
    e.preventDefault();
    // La commande est créée AVANT le paiement : le serveur a besoin d'une
    // commande en base pour connaître le montant à exiger.
    const order = addOrder({
      items: Object.entries(cartItems).map(([productId, qty]) => ({ productId, qty })),
      total: cartTotal,
      operator: payForm.operator,
      phone: payForm.phone.trim(),
      createdBy: user.id,
    });
    clearCart();
    setPayment(order);
  };

  return (
    <div className="page">
      <PageHeader
        title="Boutique"
        subtitle="Prix public affiché"
        actions={
          <>
            <div className="search-box">
              <Search size={18} className="search-icon" />
              <input
                className="input search-input"
                aria-label="Rechercher un produit"
                placeholder="Rechercher un produit…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {isManager && (
              <button className="btn btn-accent" onClick={openNew}>
                <Plus size={18} /> Produit
              </button>
            )}
          </>
        }
      />
      <div className="page-content">
        <div className="categories-scroll">
          <button className={`category-chip ${!selectedCategory ? 'active' : ''}`} onClick={() => setSelectedCategory(null)}>Tous</button>
          {productCategories.map((cat) => (
            <button
              key={cat.id}
              className={`category-chip ${selectedCategory === cat.id ? 'active' : ''}`} aria-pressed={selectedCategory === cat.id}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="list-toolbar boutique-filters">
          <select className="input sort-select" value={priceRange} onChange={(e) => setPriceRange(e.target.value)} aria-label="Filtrer par prix">
            {PRICE_RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <select className="input sort-select" value={powerRange} onChange={(e) => setPowerRange(e.target.value)} aria-label="Filtrer par puissance">
            {POWER_RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div className="products-grid">
          {filtered.map((product) => {
            const outOfStock = product.suiviStock && product.stock === 0;
            return (
              <div key={product.id} className={`product-card ${outOfStock ? 'product-unavailable' : ''}`}>
                <button className="product-top product-open" onClick={() => setDetailId(product.id)}>
                  <div className="product-name">{product.name}</div>
                  <div className="product-category">{categoryLabel(product.category)}</div>
                </button>
                <div className="product-image-wrap">
                  <button className="product-open product-image-btn" onClick={() => setDetailId(product.id)} aria-label={`Voir la fiche ${product.name}`}>
                    <img src={product.image} alt={product.name} className="product-image" loading="lazy" />
                  </button>
                  {isManager && (
                    <button className="product-edit-btn" onClick={() => openEdit(product)} aria-label={`Modifier ${product.name}`}>
                      <Pencil size={15} />
                    </button>
                  )}
                  {outOfStock && <span className="oos-badge">Rupture</span>}
                </div>
                <div className="product-description">{product.description}</div>
                <div className="product-footer">
                  <div>
                    <div className="product-price">{formatCFA(getPrice(product.basePrice))}</div>
                    {isManager && (
                      <div className="product-price-alt">Tech. : {formatCFA(product.basePrice)}</div>
                    )}
                  </div>
                  <button
                    className={`cart-add-btn ${justAdded === product.id ? 'added' : ''}`}
                    disabled={outOfStock}
                    onClick={() => handleAddToCart(product)}
                    aria-label={`Ajouter ${product.name} au panier`}
                  >
                    {justAdded === product.id ? <Check size={19} /> : <ShoppingCart size={19} />}
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <EmptyState>Aucun produit ne correspond à votre recherche.</EmptyState>}
        </div>
      </div>

      {/* Barre panier flottante */}
      {count > 0 && (
        <button className="cart-bar" onClick={() => setCartOpen(true)}>
          <span className="cart-bar-count"><ShoppingCart size={17} /> {count}</span>
          <span className="cart-bar-label">Voir le panier</span>
          <span className="cart-bar-total">{formatCFA(cartTotal)}</span>
        </button>
      )}

      {/* Panier */}
      <Sheet open={cartOpen} onClose={() => setCartOpen(false)} title="Panier" subtitle={`${count} article(s)`}>
        {cartProducts.map(({ product, qty }) => (
          <div key={product.id} className="cart-row">
            <img src={product.image} alt="" className="cart-row-img" />
            <div className="cart-row-info">
              <div className="cart-row-name">{product.name}</div>
              <div className="cart-row-price">{formatCFA(getPrice(product.basePrice))}</div>
            </div>
            <div className="qty-stepper">
              <button className="btn btn-sm btn-outline" onClick={() => setQty(product.id, qty - 1)}>−</button>
              <span className="qty-value">{qty}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setQty(product.id, qty + 1)}>+</button>
            </div>
            <button className="cart-row-remove" onClick={() => removeItem(product.id)} aria-label="Retirer">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div className="devis-summary">
          <div className="devis-summary-row total"><span>Total</span><span>{formatCFA(cartTotal)}</span></div>
        </div>
        {/* Une seule action primaire : le devis. Le vidage est un lien discret, confirmé. */}
        <div className="cart-actions">
          <button className="btn btn-accent btn-block" onClick={goToDevis}>
            <FileText size={17} /> Créer le devis
          </button>
          {canPayOnline ? (
            <button className="btn btn-outline btn-block" onClick={handlePayOnline}>
              <Smartphone size={17} /> Commander et payer en ligne
            </button>
          ) : (
            // Masquer le bouton sans rien dire faisait passer une règle
            // métier pour une panne. Le motif compte plus que le bouton.
            <div className="field-hint" style={{ textAlign: 'center' }}>
              La commande en ligne encaisse pour BestaSolar : elle est réservée à son
              équipe. {user.org?.name ? `Votre entreprise : ${user.org.name}.` : ''} Créez
              un devis pour ce panier — le règlement se convient ensuite avec votre client.
            </div>
          )}
        </div>
        <button
          type="button"
          className="btn btn-block text-danger"
          style={{ background: 'none', border: 'none', boxShadow: 'none' }}
          onClick={() => setConfirmClear(true)}
        >
          Vider le panier
        </button>
      </Sheet>

      <ConfirmSheet
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => { clearCart(); setCartOpen(false); }}
        title="Vider le panier"
        message="Tous les articles seront retirés du panier."
        confirmLabel="Vider le panier"
        danger
      />

      {/* Fiche produit détaillée */}
      <Sheet
        open={!!detailProduct}
        onClose={() => setDetailId(null)}
        title={detailProduct?.name}
        subtitle={detailProduct && categoryLabel(detailProduct.category)}
      >
        {detailProduct && (
          <>
            <img src={detailProduct.image} alt={detailProduct.name} className="detail-image" />
            <div className="sheet-section">
              <div className="sheet-section-title">Caractéristiques</div>
              <ul className="spec-list">
                {(detailProduct.description || '').split('·').map((spec, i) => spec.trim() && (
                  <li key={i}>{spec.trim()}</li>
                ))}
              </ul>
              {extractPowerWatts(detailProduct.name) && (
                <div className="sheet-row">
                  <span className="sheet-label">Puissance</span>
                  <span className="sheet-value">{(extractPowerWatts(detailProduct.name) / 1000).toLocaleString('fr-FR')} kW</span>
                </div>
              )}
            </div>
            <div className="sheet-section">
              <div className="sheet-section-title">Prix et disponibilité</div>
              <div className="sheet-row"><span className="sheet-label">Prix public</span><span className="sheet-value amount">{formatCFA(prixPublic(detailProduct.basePrice))}</span></div>
              <div className="sheet-row"><span className="sheet-label">Prix partenaire</span><span className="sheet-value">{formatCFA(detailProduct.basePrice)}</span></div>
              {detailProduct.suiviStock && (
                <div className="sheet-row">
                  <span className="sheet-label">Stock</span>
                  <span className="sheet-value">{detailProduct.stock > 0 ? `${detailProduct.stock} disponible(s)` : 'Rupture'}</span>
                </div>
              )}
            </div>
            <div className="cart-actions">
              {isManager && (
                <button className="btn btn-outline" onClick={() => { setDetailId(null); openEdit(detailProduct); }}>
                  <Pencil size={15} /> Modifier
                </button>
              )}
              <button
                className="btn btn-accent btn-block"
                disabled={detailProduct.suiviStock && detailProduct.stock === 0}
                onClick={() => { handleAddToCart(detailProduct); setDetailId(null); }}
              >
                <ShoppingCart size={17} /> Ajouter au panier
              </button>
            </div>
          </>
        )}
      </Sheet>

      {/* Paiement en ligne (Mobile Money — démo) */}
      <Sheet
        open={!!payment}
        onClose={() => setPayment(null)}
        title={payment === 'form' ? 'Commander et payer' : 'Commande enregistrée'}
        subtitle={payment === 'form' ? `Total : ${formatCFA(cartTotal)}` : undefined}
      >
        {payment === 'form' ? (
          <form onSubmit={confirmPayment}>
            <div className="input-group">
              <span className="input-label" id="bq-operator-label">Opérateur Mobile Money</span>
              <div className="client-type-toggle" role="group" aria-labelledby="bq-operator-label">
                {['T-Money (Yas)', 'Flooz (Moov)'].map((op) => (
                  <button
                    key={op}
                    type="button"
                    className={`client-type-btn ${payForm.operator === op ? 'active' : ''}`}
                    aria-pressed={payForm.operator === op}
                    onClick={() => setPayForm({ ...payForm, operator: op })}
                  >
                    <Smartphone size={16} /> {op}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Numéro Mobile Money *">
              <input className="input" type="tel" required value={payForm.phone} onChange={(e) => setPayForm({ ...payForm, phone: e.target.value })} placeholder="+228 ..." />
            </Field>
            <div className="devis-summary">
              <div className="devis-summary-row total"><span>Montant à payer</span><span>{formatCFA(cartTotal)}</span></div>
            </div>
            <div className="field-hint payment-stub-note">
              Rien n'est prélevé à cette étape : la commande est d'abord enregistrée.
              Vous pourrez ensuite la régler en ligne, ou attendre l'appel de BestaSolar
              sur ce numéro.
            </div>
            <button type="submit" className="btn btn-primary btn-block">
              <Smartphone size={17} /> Continuer vers le paiement · {formatCFA(cartTotal)}
            </button>
          </form>
        ) : payment && (
          <div className="payment-confirm">
            <div className="payment-confirm-icon"><Check size={28} /></div>
            <div className="payment-confirm-title">Commande {payment.orderNumber}</div>
            {payment.paiement?.statut === 'verifie' ? (
              <p className="text-sm text-secondary">
                Commande de {formatCFA(payment.total)} <strong>réglée</strong> — paiement vérifié.
                BestaSolar vous rappelle au {payment.phone} pour la livraison.
              </p>
            ) : (
              <>
                <p className="text-sm text-secondary">
                  Commande de {formatCFA(payment.total)} enregistrée. Réglez-la maintenant en ligne,
                  ou attendez l'appel de BestaSolar au {payment.phone} ({payment.operator}).
                </p>
                {/* Le montant vient de la commande, pas du panier : celui-ci
                    est déjà vidé, et c'est la commande qui fait foi. */}
                <KkiapayButton
                  phone={payment.phone}
                  amount={payment.total}
                  objet={{ type: 'commande', commandeId: payment.id }}
                  label={`Payer maintenant · ${formatCFA(payment.total)}`}
                  onPaid={paiementCommande}
                  onNumero={(numero) => setPayment((o) => (o && o !== 'form' ? { ...o, phone: numero } : o))}
                />
              </>
            )}
            <button className="btn btn-outline btn-block" style={{ marginTop: 10 }}
              onClick={() => setPayment(null)}>Fermer</button>
          </div>
        )}
      </Sheet>

      {/* Fiche produit (gérant) */}
      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nouveau produit' : 'Modifier le produit'}
      >
        <form onSubmit={handleSave}>
          <div className="photo-field">
            <button type="button" className="photo-preview" onClick={() => fileInputRef.current?.click()}>
              {form.image ? (
                <img src={form.image} alt="Aperçu du produit" />
              ) : (
                <span className="photo-placeholder"><Camera size={26} /><span>Ajouter une photo</span></span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhoto}
              className="photo-input"
              aria-label="Photo du produit"
            />
            <button type="button" className="btn btn-sm btn-outline" onClick={() => fileInputRef.current?.click()}>
              <Camera size={15} /> {form.image ? 'Changer la photo' : 'Prendre / choisir une photo'}
            </button>
          </div>

          <Field label="Nom du produit *">
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex : Panneau Solaire 550W" />
          </Field>
          <Field label="Description">
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Courte description" />
          </Field>
          <div className="form-row-2">
            <Field label="Prix technicien (F CFA) *">
              <input className="input" type="number" min="0" required value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} placeholder="0" />
              {Number(form.basePrice) > 0 && (
                <div className="field-hint">Prix public (+{Math.round((PUBLIC_MARKUP - 1) * 100)} %) : {formatCFA(prixPublic(form.basePrice))}</div>
              )}
            </Field>
            {form.suiviStock && (
              <Field label="Stock *">
                <input className="input" type="number" min="0" required value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="0" />
              </Field>
            )}
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.suiviStock}
              onChange={(e) => setForm({ ...form, suiviStock: e.target.checked })} />
            <span>Suivre le stock de ce produit</span>
          </label>
          <Field label="Catégorie">
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {productCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
            </select>
          </Field>

          <button type="submit" className="btn btn-primary btn-block">
            <Check size={18} /> {editing === 'new' ? 'Ajouter au catalogue' : 'Enregistrer les modifications'}
          </button>
          {editing !== 'new' && (
            <button type="button" className="btn btn-lost btn-block delete-product-btn" onClick={handleDelete}>
              <Trash2 size={16} /> Supprimer ce produit
            </button>
          )}
        </form>
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { deleteProduct(editing); setEditing(null); }}
        title="Supprimer ce produit"
        message={`« ${products.find((p) => p.id === editing)?.name || 'Ce produit'} » sera retiré du catalogue.`}
        confirmLabel="Supprimer"
        danger
      />
    </div>
  );
}
