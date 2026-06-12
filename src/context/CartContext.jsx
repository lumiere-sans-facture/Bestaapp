import { createContext, useContext, useEffect, useState } from 'react';

// Panier de la boutique : état local à l'appareil (pas synchronisé),
// il sert d'étape intermédiaire avant la création d'un devis.
const CartContext = createContext(null);
const STORAGE_KEY = 'bestasolar_cart';

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (productId, qty = 1) =>
    setItems((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + qty }));

  const setQty = (productId, qty) =>
    setItems((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });

  const removeItem = (productId) =>
    setItems((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });

  const clearCart = () => setItems({});

  const count = Object.values(items).reduce((s, q) => s + q, 0);

  return (
    <CartContext.Provider value={{ items, addItem, setQty, removeItem, clearCart, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart doit être utilisé dans <CartProvider>');
  return ctx;
}
