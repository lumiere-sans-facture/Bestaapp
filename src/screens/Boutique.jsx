import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Pencil, Trash2, Camera, Check, ShoppingCart, FileText, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useCart } from '../context/CartContext';
import { formatCFA } from '../utils/format';
import { fileToResizedDataUrl } from '../utils/image';
import { extractPowerWatts, POWER_RANGES, PRICE_RANGES } from '../utils/power';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';
import Field from '../components/Field';
import EmptyState from '../components/EmptyState';

const EMPTY_FORM = { name: '', description: '', basePrice: '', stock: '', category: 'kits', image: '' };

export default function Boutique() {
  const { user } = useAuth();
  const { products, productCategories, addProduct, updateProduct, deleteProduct, addOrder } = useData();
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
  const [payForm, setPayForm] = useState({ operator: 'MTN MoMo', phone: '' });
  const [justAdded, setJustAdded] = useState(null);
  const fileInputRef = useRef(null);

  const detailProduct = products.find((p) => p.id === detailId);

  const isManager = user.role === 'gerant';
  const getPrice = (basePrice) => (isManager ? Math.round(basePrice * 1.15) : basePrice);
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
      alert("Impossible de lire cette image. Essayez avec une autre photo.");
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
      category: form.category,
      image: form.image,
    };
    if (editing === 'new') addProduct(data);
    else updateProduct(editing, data);
    setEditing(null);
  };

  const handleDelete = () => {
    const product = products.find((p) => p.id === editing);
    if (window.confirm(`Supprimer « ${product?.name} » du catalogue ?`)) {
      deleteProduct(editing);
      setEditing(null);
    }
  };

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
      .sort((a, b) => (a.stock === 0) - (b.stock === 0));
  }, [products, selectedCategory, search, priceRange, powerRange, isManager]);

  const handlePayOnline = () => {
    setPayForm({ operator: 'MTN MoMo', phone: user.phone || '' });
    setCartOpen(false);
    setPayment('form');
  };

  const confirmPayment = (e) => {
    e.preventDefault();
    // Stub Mobile Money : la commande est enregistrée « paiement initié ».
    // Point d'accroche pour l'agrégateur réel (FedaPay / Kkiapay) : ici.
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
        subtitle={isManager ? 'Prix public affiché' : 'Prix technicien affiché'}
        actions={
          <>
            <div className="search-box">
              <Search size={18} className="search-icon" />
              <input
                className="input search-input"
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
              className={`category-chip ${selectedCategory === cat.id ? 'active' : ''}`}
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
            const outOfStock = product.stock === 0;
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
        <div className="cart-actions">
          <button className="btn btn-outline" onClick={() => { clearCart(); setCartOpen(false); }}>Vider</button>
          <button className="btn btn-primary btn-block" onClick={handlePayOnline}>
            <Smartphone size={17} /> Payer en ligne
          </button>
          <button className="btn btn-accent btn-block" onClick={goToDevis}>
            <FileText size={17} /> Créer le devis
          </button>
        </div>
      </Sheet>

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
              {(detailProduct.description || '').split('·').map((spec, i) => spec.trim() && (
                <div key={i} className="sheet-row"><span className="sheet-label">{spec.trim()}</span></div>
              ))}
              {extractPowerWatts(detailProduct.name) && (
                <div className="sheet-row">
                  <span className="sheet-label">Puissance</span>
                  <span className="sheet-value">{(extractPowerWatts(detailProduct.name) / 1000).toLocaleString('fr-FR')} kW</span>
                </div>
              )}
            </div>
            <div className="sheet-section">
              <div className="sheet-section-title">Prix et disponibilité</div>
              <div className="sheet-row"><span className="sheet-label">Prix public</span><span className="sheet-value amount">{formatCFA(Math.round(detailProduct.basePrice * 1.15))}</span></div>
              <div className="sheet-row"><span className="sheet-label">Prix partenaire</span><span className="sheet-value">{formatCFA(detailProduct.basePrice)}</span></div>
              <div className="sheet-row">
                <span className="sheet-label">Stock</span>
                <span className="sheet-value">{detailProduct.stock > 0 ? `${detailProduct.stock} disponible(s)` : 'Rupture'}</span>
              </div>
            </div>
            <div className="cart-actions">
              {isManager && (
                <button className="btn btn-outline" onClick={() => { setDetailId(null); openEdit(detailProduct); }}>
                  <Pencil size={15} /> Modifier
                </button>
              )}
              <button
                className="btn btn-accent btn-block"
                disabled={detailProduct.stock === 0}
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
        title={payment === 'form' ? 'Payer en ligne' : 'Paiement initié'}
        subtitle={payment === 'form' ? `Total : ${formatCFA(cartTotal)}` : undefined}
      >
        {payment === 'form' ? (
          <form onSubmit={confirmPayment}>
            <div className="input-group">
              <label className="input-label">Opérateur Mobile Money</label>
              <div className="client-type-toggle">
                {['MTN MoMo', 'Moov Money'].map((op) => (
                  <button
                    key={op}
                    type="button"
                    className={`client-type-btn ${payForm.operator === op ? 'active' : ''}`}
                    onClick={() => setPayForm({ ...payForm, operator: op })}
                  >
                    <Smartphone size={16} /> {op}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Numéro Mobile Money *">
              <input className="input" type="tel" required value={payForm.phone} onChange={(e) => setPayForm({ ...payForm, phone: e.target.value })} placeholder="+229 ..." />
            </Field>
            <div className="devis-summary">
              <div className="devis-summary-row total"><span>Montant à payer</span><span>{formatCFA(cartTotal)}</span></div>
            </div>
            <div className="field-hint payment-stub-note">
              Mode démonstration : la commande sera enregistrée « paiement initié ». L'encaissement réel Mobile Money (agrégateur FedaPay/Kkiapay) sera branché ici.
            </div>
            <button type="submit" className="btn btn-primary btn-block">
              <Smartphone size={17} /> Payer {formatCFA(cartTotal)}
            </button>
          </form>
        ) : payment && (
          <div className="payment-confirm">
            <div className="payment-confirm-icon"><Check size={28} /></div>
            <div className="payment-confirm-title">Commande {payment.orderNumber}</div>
            <p className="text-sm text-secondary">
              Paiement de {formatCFA(payment.total)} initié via {payment.operator} ({payment.phone}).
              Vous serez notifié à la confirmation de l'opérateur.
            </p>
            <button className="btn btn-primary btn-block" onClick={() => setPayment(null)}>Fermer</button>
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
                <div className="field-hint">Prix public (+15 %) : {formatCFA(Math.round(Number(form.basePrice) * 1.15))}</div>
              )}
            </Field>
            <Field label="Stock *">
              <input className="input" type="number" min="0" required value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="0" />
            </Field>
          </div>
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
    </div>
  );
}
