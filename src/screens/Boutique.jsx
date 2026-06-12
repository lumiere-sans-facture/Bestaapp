import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Pencil, Trash2, Camera, Check, ShoppingCart, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useCart } from '../context/CartContext';
import { formatCFA } from '../utils/format';
import { fileToResizedDataUrl } from '../utils/image';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';

const EMPTY_FORM = { name: '', description: '', basePrice: '', stock: '', category: 'kits', image: '' };

export default function Boutique() {
  const { user } = useAuth();
  const { products, productCategories, addProduct, updateProduct, deleteProduct } = useData();
  const { items: cartItems, addItem, setQty, removeItem, clearCart, count } = useCart();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [search, setSearch] = useState('');
  // null = fermé, 'new' = création, sinon id du produit en édition
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [cartOpen, setCartOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(null);
  const fileInputRef = useRef(null);

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

  const filtered = products
    .filter((p) => !selectedCategory || p.category === selectedCategory)
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.stock === 0) - (b.stock === 0));

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
        <div className="products-grid">
          {filtered.map((product) => {
            const outOfStock = product.stock === 0;
            return (
              <div key={product.id} className={`product-card ${outOfStock ? 'product-unavailable' : ''}`}>
                <div className="product-top">
                  <div className="product-name">{product.name}</div>
                  <div className="product-category">{categoryLabel(product.category)}</div>
                </div>
                <div className="product-image-wrap">
                  <img src={product.image} alt={product.name} className="product-image" loading="lazy" />
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
          {filtered.length === 0 && <div className="empty-state">Aucun produit ne correspond à votre recherche.</div>}
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
          <button className="btn btn-accent btn-block" onClick={goToDevis}>
            <FileText size={17} /> Créer le devis
          </button>
        </div>
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

          <div className="input-group">
            <label className="input-label">Nom du produit *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex : Panneau Solaire 550W" />
          </div>
          <div className="input-group">
            <label className="input-label">Description</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Courte description" />
          </div>
          <div className="form-row-2">
            <div className="input-group">
              <label className="input-label">Prix technicien (F CFA) *</label>
              <input className="input" type="number" min="0" required value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} placeholder="0" />
              {Number(form.basePrice) > 0 && (
                <div className="field-hint">Prix public (+15 %) : {formatCFA(Math.round(Number(form.basePrice) * 1.15))}</div>
              )}
            </div>
            <div className="input-group">
              <label className="input-label">Stock *</label>
              <input className="input" type="number" min="0" required value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="0" />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Catégorie</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {productCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
            </select>
          </div>

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
