// Domaine boutique : catalogue produits et commandes. Le stock est décrémenté
// à la confirmation d'une commande et restitué à l'annulation (couplage assumé).
export function createCatalogueActions(setState) {
  return {
    // ---- Gestion du catalogue boutique (gérant) ----
    addProduct: (product) =>
      setState((s) => ({
        ...s,
        products: [{ ...product, id: crypto.randomUUID() }, ...s.products],
      })),

    updateProduct: (productId, patch) =>
      setState((s) => ({
        ...s,
        products: s.products.map((p) => (p.id === productId ? { ...p, ...patch } : p)),
      })),

    deleteProduct: (productId) =>
      setState((s) => ({
        ...s,
        products: s.products.filter((p) => p.id !== productId),
      })),

    // Commande payée en ligne (Mobile Money — stub en attendant l'agrégateur)
    addOrder: (order) => {
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      let full = null;
      setState((s) => {
        const counter = (s.orderCounter || 0) + 1;
        full = {
          ...order,
          id: crypto.randomUUID(),
          orderNumber: `CMD-${dateStr}-${String(counter).padStart(4, '0')}`,
          status: 'initie',
          createdAt: now.toISOString(),
        };
        return { ...s, orderCounter: counter, orders: [full, ...(s.orders || [])] };
      });
      return full;
    },

    updateOrderStatus: (orderId, status) =>
      setState((s) => {
        const order = (s.orders || []).find((o) => o.id === orderId);
        if (!order) return s;
        let products = s.products;
        if (status === 'confirme' && order.status !== 'confirme') {
          // Décrémenter le stock à la confirmation
          products = s.products.map((p) => {
            const item = (order.items || []).find((i) => i.productId === p.id);
            if (!item) return p;
            return { ...p, stock: Math.max(0, (p.stock || 0) - item.qty) };
          });
        } else if (status === 'annule' && order.status === 'confirme') {
          // Restituer le stock à l'annulation (uniquement si était confirmé)
          products = s.products.map((p) => {
            const item = (order.items || []).find((i) => i.productId === p.id);
            if (!item) return p;
            return { ...p, stock: (p.stock || 0) + item.qty };
          });
        }
        return {
          ...s,
          products,
          orders: (s.orders || []).map((o) => (o.id === orderId ? { ...o, status } : o)),
        };
      }),
  };
}
