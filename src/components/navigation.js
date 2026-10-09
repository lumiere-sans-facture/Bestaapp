// Onglets de l'application, partagés par la mise en page (AppLayout) et
// par l'écran de chargement (LoadingShell) : au rafraîchissement, la barre
// d'onglets affichée pendant le chargement est exactement la vraie.
import { LayoutDashboard, FolderKanban, ShoppingCart, FileText, MoreHorizontal, Users, Building2, CreditCard, Plus } from 'lucide-react';

// « Devis » est l'onglet CENTRAL : l'action principale, sous le pouce, dans
// la barre d'onglets mobile un « + » sur pastille pleine (`central`,
// `iconeOnglet`). La barre latérale garde l'icône de document.
export const publicNavItems = [
  { path: '/dashboard', label: 'Tableau de bord', shortLabel: 'Tableau', icon: LayoutDashboard },
  { path: '/pipeline', label: 'Suivi clients', shortLabel: 'Suivi', icon: FolderKanban },
  { path: '/devis', label: 'Devis', shortLabel: 'Devis', icon: FileText, iconeOnglet: Plus, central: true },
  { path: '/boutique', label: 'Boutique', shortLabel: 'Boutique', icon: ShoppingCart },
  { path: '/plus', label: 'Plus', shortLabel: 'Plus', icon: MoreHorizontal },
];

// Répertoire clients (ajout + carnet d'adresses) : dans la barre latérale
// après le suivi ; sur mobile, accessible depuis le menu « Plus ».
export const clientsItem = { path: '/clients', label: 'Clients', icon: Users };

// Même disposition en Pro : « Devis » au centre, avec son « + ».
export const proNavItems = [
  { path: '/pro', label: 'Tableau de bord', shortLabel: 'Tableau', icon: LayoutDashboard },
  { path: '/pro/clients', label: 'Clients', shortLabel: 'Clients', icon: Users },
  { path: '/pro/documents', label: 'Devis & Factures', shortLabel: 'Devis', icon: FileText, iconeOnglet: Plus, central: true },
  { path: '/pro/entreprise', label: 'Mon entreprise', shortLabel: 'Entreprise', icon: Building2 },
  { path: '/pro/abonnement', label: 'Mon abonnement', shortLabel: 'Abonnement', icon: CreditCard },
];
