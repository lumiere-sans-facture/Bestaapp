import { useState } from 'react';
import { Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatCFA } from '../utils/format';
import PageHeader from '../components/PageHeader';

const getStockStatus = (stock) => {
  if (stock === 0) return { label: 'Rupture', class: 'out' };
  if (stock <= 5) return { label: 'Stock faible', class: 'low' };
  return { label: 'En stock', class: 'in-stock' };
};

export default function Boutique() {
  const { user } = useAuth();
  const { products, productCategories } = useData();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [search, setSearch] = useState('');

  const getPrice = (basePrice) => (user.role === 'gerant' ? Math.round(basePrice * 1.15) : basePrice);

  const filtered = products
    .filter((p) => !selectedCategory || p.category === selectedCategory)
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.stock === 0) - (b.stock === 0));

  return (
    <div className="page">
      <PageHeader
        title="Boutique"
        subtitle={user.role === 'gerant' ? 'Prix public affiché' : 'Prix technicien affiché'}
        actions={
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input
              className="input search-input"
              placeholder="Rechercher un produit…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
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
            const stockStatus = getStockStatus(product.stock);
            return (
              <div key={product.id} className={`product-card ${product.stock === 0 ? 'product-unavailable' : ''}`}>
                <img src={product.image} alt={product.name} className="product-image" loading="lazy" />
                <div className="product-content">
                  <div className="product-name">{product.name}</div>
                  <div className="product-description">{product.description}</div>
                  <div className="product-footer">
                    <div>
                      <div className="product-price">{formatCFA(getPrice(product.basePrice))}</div>
                      {user.role === 'gerant' && (
                        <div className="product-price-alt">Technicien : {formatCFA(product.basePrice)}</div>
                      )}
                    </div>
                    <div className={`stock-badge ${stockStatus.class}`}>
                      {stockStatus.label}{product.stock > 0 && ` (${product.stock})`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="empty-state">Aucun produit ne correspond à votre recherche.</div>}
        </div>
      </div>
    </div>
  );
}
