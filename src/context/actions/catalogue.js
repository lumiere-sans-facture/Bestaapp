// Domaine boutique : catalogue produits et commandes. Le stock est décrémenté
// à la confirmation d'une commande et restitué à l'annulation (couplage assumé).
import { prochainNumeroCommande } from '../../utils/affaires';
import { suivre, EVENEMENTS } from '../../lib/analytique';
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
      // Montant et nombre d'articles : de quoi mesurer le parcours d'achat,
      // sans rien qui identifie l'acheteur ni ce qu'il a commandé.
      suivre(EVENEMENTS.COMMANDE_CREEE, {
        total: Number(order.total) || 0,
        articles: (order.items || []).length,
      });
      const now = new Date();
      let full = null;
      setState((s) => {
        full = {
          ...order,
          id: crypto.randomUUID(),
          // Numéro déduit des commandes existantes (répliquées) : deux
          // appareils ne peuvent plus produire le même.
          orderNumber: prochainNumeroCommande(s.orders, now),
          status: 'initie',
          createdAt: now.toISOString(),
        };
        return { ...s, orderCounter: (s.orderCounter || 0) + 1, orders: [full, ...(s.orders || [])] };
      });
      return full;
    },

    // Paiement VÉRIFIÉ PAR LE SERVEUR (api/paiement/verifier). Le statut de la
    // commande ne bouge pas : « confirmé » décrémente le stock, c'est une
    // décision du gérant qui doit avoir la marchandise. Le paiement, lui, est
    // un fait — il est noté séparément.
    marquerCommandePayee: (orderId, { reference, montant, methode = 'kkiapay' }) =>
      setState((s) => ({
        ...s,
        orders: (s.orders || []).map((o) => (o.id === orderId ? {
          ...o,
          paiement: {
            statut: 'verifie', reference, montant, methode,
            date: new Date().toISOString(),
          },
        } : o)),
      })),

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
