import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';

// Panier de la boutique : état local à l'appareil (pas synchronisé),
// il sert d'étape intermédiaire avant la création d'un devis.
const CartContext = createContext(null);
const STORAGE_KEY = 'bestasolar_cart';

export function CartProvider({ children }) {
  const { user } = useAuth();
  // Comme le cache de données : un panier par organisation en mode SaaS
  // (deux comptes sur le même appareil ne partagent pas leur panier).
  const key = isSupabaseConfigured ? `${STORAGE_KEY}_${user.org_id || user.id}` : STORAGE_KEY;
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) || {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(items));
  }, [items, key]);

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
