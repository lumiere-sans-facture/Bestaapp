import { useState } from 'react';
import { products, productCategories, formatCFA } from '../data/mockData';

export default function Boutique({ user }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const filteredProducts = selectedCategory ? products.filter(p => p.category === selectedCategory) : products;
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (a.stock === 0 && b.stock !== 0) return 1;
    if (a.stock !== 0 && b.stock === 0) return -1;
    return 0;
  });

  const getStockStatus = (stock) => {
    if (stock === 0) return { label: 'Rupture', class: 'out', dotClass: 'stock-low' };
    if (stock <= 5) return { label: 'Stock faible', class: 'low', dotClass: 'stock-medium' };
    return { label: 'En stock', class: 'in-stock', dotClass: 'stock-high' };
  };

  const getPrice = (basePrice) => user.role === 'gerant' ? Math.round(basePrice * 1.15) : basePrice;

  return (
    <>
      <div className="boutique-header">
        <h1 className="screen-title">Boutique</h1>
        <div className="boutique-user-info">
          <div className="user-avatar">{user.avatar}</div>
          <div className="user-name">{user.name}<div className="user-role-badge">{user.role === 'gerant' ? 'Prix public' : 'Prix special'}</div></div>
        </div>
      </div>
      <div className="categories-scroll">
        <button className={`category-chip ${!selectedCategory ? 'active' : ''}`} onClick={() => setSelectedCategory(null)}>Tous</button>
        {productCategories.map(cat => (
          <button key={cat.id} className={`category-chip ${selectedCategory === cat.id ? 'active' : ''}`} onClick={() => setSelectedCategory(cat.id)}>{cat.label}</button>
        ))}
      </div>
      <div className="products-grid">
        {sortedProducts.map(product => {
          const stockStatus = getStockStatus(product.stock);
          return (
            <div key={product.id} className="product-card">
              <img src={product.image} alt={product.name} className="product-image" />
              <div className="product-content">
                <div className="product-name">{product.name}</div>
                <div className="product-description">{product.description}</div>
                <div className="product-footer">
                  <div>
                    <div className="product-price">{formatCFA(getPrice(product.basePrice))}</div>
                    {user.role === 'gerant' && <div className="product-price notechnicien">Technicien: {formatCFA(product.basePrice)}</div>}
                  </div>
                  <div className={`stock-badge ${stockStatus.class}`}>
                    <span className={`stock-dot ${stockStatus.dotClass}`} />
                    {stockStatus.label}{product.stock > 0 && ` (${product.stock})`}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
