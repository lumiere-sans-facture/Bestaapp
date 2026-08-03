import { catalogueProducts } from './catalogue';

// v5 : réseau de partenaires à deux niveaux (sponsorId = parrain du partenaire)
export const SEED_VERSION = 5;

export const users = [
  { id: 'u1', email: 'adam@bestasolar.bj', password: 'demo123', name: 'Adam Adébiyi', role: 'gerant', phone: '+229 97 12 34 56', avatar: 'AA' },
  { id: 'u2', email: 'fatou@bestasolar.bj', password: 'demo123', name: 'Fatou Boko', role: 'technicien', phone: '+229 96 78 90 12', avatar: 'FB' },
  { id: 'u3', email: 'ibrahim@bestasolar.bj', password: 'demo123', name: 'Ibrahim Dan Djido', role: 'technicien', phone: '+229 95 55 66 77', avatar: 'ID' },
];

// Étapes ouvertes du pipeline (affichées en colonnes et dans le stepper).
// 'gagne' et 'perdu' sont des issues, pas des étapes.
export const stages = [
  { id: 'nouveau', label: 'Nouveau', color: '#6366f1' },
  { id: 'qualifie', label: 'Qualifié', color: '#8b5cf6' },
  { id: 'visite', label: 'Visite', color: '#ec4899' },
  { id: 'proposition', label: 'Proposition', color: '#f59e0b' },
  { id: 'negociation', label: 'Négociation', color: '#3b82f6' },
  { id: 'gagne', label: 'Gagné', color: '#10b981' },
];

export const LOST_STAGE = { id: 'perdu', label: 'Perdu', color: '#ef4444' };

// Réseau de parrainage : sponsorId = partenaire qui a recruté celui-ci.
// Quand un partenaire apporte une affaire (niveau 1, 3 %), son parrain
// touche automatiquement la commission de niveau 2 (1,5 %).
export const partners = [
  { id: 'p1', name: 'Mamadou Balogun', phone: '+229 97 11 22 33', sponsorId: null, registeredAt: '2025-01-15', status: 'actif', code: 'BESTA-MAMADOU', momoNumber: '+229 97 11 22 33' },
  { id: 'p2', name: 'Aminata Kesso', phone: '+229 96 44 55 66', sponsorId: 'p1', registeredAt: '2025-02-20', status: 'actif', code: 'BESTA-AMINATA', momoNumber: '+229 96 44 55 66' },
  { id: 'p3', name: 'Toffa Gname', phone: '+229 95 77 88 99', sponsorId: 'p2', registeredAt: '2025-03-10', status: 'actif', code: 'BESTA-TOFFA', momoNumber: '' },
  { id: 'p4', name: 'Balogoun Alassane', phone: '+229 94 33 22 11', sponsorId: 'p1', registeredAt: '2025-04-05', status: 'inactif', code: 'BESTA-BALOGOUN', momoNumber: '' },
];

export const leads = [
  { id: 'l1', clientType: 'entreprise', name: 'Clinique Notre Dame', contact: 'Dr. Honoré Ganse', phone: '+229 97 88 99 00', address: 'Quartier Commercial, Parakou', stage: 'negociation', estimatedValue: 2450000, assignedTo: 'u2', parrainL1: 'p1', parrainL2: null, createdAt: '2025-05-10', notes: 'Besoin urgent - panne fréquente', lastActivity: '2025-06-08', activities: [{ id: 'a1', date: '2025-06-08T10:30:00', text: 'Visite technique effectuée, dimensionnement validé pour 3kVA', by: 'u2' }, { id: 'a2', date: '2025-05-12T09:00:00', text: 'Premier appel : pannes SBEE fréquentes, besoin urgent', by: 'u2' }] },
  { id: 'l2', clientType: 'entreprise', name: 'Hôtel du Parc', contact: 'M. Kossi Agboka', phone: '+229 96 11 22 33', address: 'Avenue de la Liberté, Parakou', stage: 'proposition', estimatedValue: 1850000, assignedTo: 'u2', parrainL1: 'p2', parrainL2: 'p1', createdAt: '2025-05-15', notes: 'Économie carburant générateur', lastActivity: '2025-06-05' },
  { id: 'l3', clientType: 'entreprise', name: 'Pharmacie Alafia', contact: 'Mme. Françoude Akpaki', phone: '+229 95 44 55 66', address: 'Marché Central, Parakou', stage: 'gagne', estimatedValue: 980000, assignedTo: 'u3', parrainL1: 'p1', parrainL2: null, createdAt: '2025-04-20', notes: 'Devis signé', lastActivity: '2025-06-09', wonAt: '2025-06-09' },
  { id: 'l4', clientType: 'entreprise', name: 'Boulangerie Tcha-Tcha', contact: 'Honoré Tcha-Tcha', phone: '+229 94 77 88 99', address: 'Quartier Zongo, Parakou', stage: 'visite', estimatedValue: 650000, assignedTo: 'u3', parrainL1: 'p3', parrainL2: 'p2', createdAt: '2025-05-25', notes: 'Petite boulangerie', lastActivity: '2025-06-07' },
  { id: 'l5', clientType: 'entreprise', name: 'École Privée Bethanie', contact: 'Directeur Toussaint Hinnou', phone: '+229 97 33 44 55', address: 'Quartier A, Parakou', stage: 'qualifie', estimatedValue: 3200000, assignedTo: 'u2', parrainL1: null, parrainL2: null, createdAt: '2025-06-01', notes: 'École 200 élèves', lastActivity: '2025-06-08' },
  { id: 'l6', clientType: 'entreprise', name: 'Station Service Avion', contact: 'Amidou Nima', phone: '+229 96 66 77 88', address: 'Route de Cotonou, Parakou', stage: 'nouveau', estimatedValue: 4500000, assignedTo: 'u2', parrainL1: 'p2', parrainL2: null, createdAt: '2025-06-09', notes: 'Nouveau lead', lastActivity: '2025-06-09' },
  { id: 'l7', clientType: 'entreprise', name: "Grain d'Or", contact: 'Bienvenu Ykpè', phone: '+229 95 99 00 11', address: 'Marché Arzeke, Parakou', stage: 'nouveau', estimatedValue: 320000, assignedTo: 'u3', parrainL1: 'p3', parrainL2: null, createdAt: '2025-06-10', notes: 'Petit commerce', lastActivity: '2025-06-10' },
  { id: 'l8', clientType: 'entreprise', name: 'Benz-Benz Radio', contact: 'Felix Sossa', phone: '+229 94 22 33 44', address: 'Centre-Ville, Parakou', stage: 'gagne', estimatedValue: 890000, assignedTo: 'u2', parrainL1: 'p1', parrainL2: null, createdAt: '2025-03-15', notes: 'Studio radio', lastActivity: '2025-05-20', wonAt: '2025-05-20' },
];

export const products = catalogueProducts;

export const commissions = [
  { id: 'c1', partnerId: 'p1', leadId: 'l3', amount: 29400, level: 1, status: 'payée', paidAt: '2025-06-10', createdAt: '2025-06-09' },
  { id: 'c2', partnerId: 'p1', leadId: 'l8', amount: 26700, level: 1, status: 'payée', paidAt: '2025-05-25', createdAt: '2025-05-20' },
  { id: 'c4', partnerId: 'p2', leadId: 'l2', amount: 55500, level: 1, status: 'en_attente', paidAt: null, createdAt: '2025-06-05' },
];

// Espace formation « école » : cours → modules → leçons (géré par le gérant).
// Leçons : type 'video' (YouTube/Vimeo/mp4, lues dans l'app), 'texte' (contenu
// intégré, lisible hors-ligne) ou 'pdf' (lien externe).
const YT = 'https://www.youtube.com/@bestasolar';
export const formations = [
  {
    id: 'f1',
    title: 'Bien démarrer avec BestaSolar Pro',
    author: 'Siddo Boubacar',
    description: 'Maîtrisez l’application de A à Z : suivi clients, devis, boutique et factures.',
    modules: [
      {
        id: 'f1m1', title: 'Découverte de l’application',
        lecons: [
          {
            id: 'f1m1l1', title: 'Tour du tableau de bord', type: 'video', url: YT, duration: '8 min',
            chapters: [
              { t: 0, label: 'Introduction' },
              { t: 45, label: 'Les indicateurs clés' },
              { t: 150, label: 'Alertes et relances' },
              { t: 300, label: 'Navigation entre les écrans' },
            ],
          },
          { id: 'f1m1l2', title: 'Suivre ses clients du premier contact à la vente', type: 'video', url: YT, duration: '12 min' },
          { id: 'f1m1l3', title: 'Créer un devis en 5 minutes', type: 'video', url: YT, duration: '10 min' },
        ],
      },
      {
        id: 'f1m2', title: 'Vendre et facturer',
        lecons: [
          { id: 'f1m2l1', title: 'Catalogue et commandes en ligne', type: 'video', url: YT, duration: '9 min' },
          {
            id: 'f1m2l2', title: 'Encaisser et suivre ses factures', type: 'texte', duration: '6 min',
            content: 'Une facture passe par trois états : brouillon, émise, payée. Dès qu’elle est émise, une échéance de paiement de 30 jours est fixée automatiquement.\n\nVous pouvez encaisser en plusieurs fois : chaque acompte est enregistré avec son mode de règlement (Mobile Money, espèces, virement, chèque). La facture passe « payée » dès que le total est atteint.\n\nBonnes pratiques :\n- Émettez la facture le jour de la livraison, jamais après.\n- Enregistrez chaque acompte immédiatement, même partiel.\n- Relancez par WhatsApp dès qu’une échéance approche — l’application prépare le message pour vous.',
          },
        ],
      },
    ],
  },
  {
    id: 'f2',
    title: 'Devenir installateur solaire',
    author: 'BestaSolar Academy',
    description: 'Des bases du photovoltaïque au chantier : la méthode BestaSolar complète.',
    modules: [
      {
        id: 'f2m1', title: 'Les bases du photovoltaïque',
        lecons: [
          {
            id: 'f2m1l1', title: 'Watts, ampères et volts sans douleur', type: 'texte', duration: '10 min',
            content: 'Trois grandeurs suffisent pour raisonner : la tension (volts), le courant (ampères) et la puissance (watts). Puissance = tension × courant.\n\nUn client qui branche un téléviseur de 100 W pendant 5 heures consomme 500 Wh, soit 0,5 kWh. C’est cette énergie journalière (kWh/jour) qui dimensionne toute l’installation.\n\nÀ retenir :\n- La puissance (W) dimensionne l’onduleur.\n- L’énergie (Wh/jour) dimensionne les panneaux et les batteries.\n- Au Bénin, comptez environ 5 heures d’ensoleillement utile par jour.',
          },
          { id: 'f2m1l2', title: 'Les composants d’une installation', type: 'video', url: YT, duration: '15 min' },
        ],
      },
      {
        id: 'f2m2', title: 'Dimensionner une installation',
        lecons: [
          { id: 'f2m2l1', title: 'Calculer la consommation du client', type: 'video', url: YT, duration: '12 min' },
          { id: 'f2m2l2', title: 'Choisir l’onduleur et les batteries', type: 'video', url: YT, duration: '14 min' },
          {
            id: 'f2m2l3', title: 'Utiliser l’outil de dimensionnement de l’app', type: 'video', url: YT, duration: '8 min',
            chapters: [
              { t: 0, label: 'Saisir la consommation du client' },
              { t: 90, label: 'Géolocalisation et ensoleillement' },
              { t: 210, label: 'Choisir onduleur et batteries' },
              { t: 360, label: 'Générer la fiche et le devis' },
            ],
          },
        ],
      },
      {
        id: 'f2m3', title: 'Installation et sécurité',
        lecons: [
          { id: 'f2m3l1', title: 'Poser les panneaux dans les règles', type: 'video', url: YT, duration: '18 min' },
          {
            id: 'f2m3l2', title: 'Sécurité électrique sur chantier', type: 'texte', duration: '8 min',
            content: 'Le courant continu d’un champ de panneaux ne « se coupe » pas tant que le soleil brille : travaillez toujours panneaux bâchés ou hors connexion.\n\nRègles non négociables :\n- Coupez toujours côté DC avant côté AC, et rebranchez dans l’ordre inverse.\n- Vérifiez la polarité au multimètre avant chaque raccordement de batterie.\n- Pas de bague, montre ou collier métallique près des batteries.\n- Fusibles et sectionneurs ne sont pas optionnels : chaque chaîne doit être protégée.\n\nUn chantier propre et sûr, c’est aussi votre meilleure publicité auprès du client.',
          },
        ],
      },
    ],
  },
  {
    id: 'f3',
    title: 'Gagner avec le programme partenaire',
    author: 'Siddo Boubacar',
    description: 'Parrainage, commissions niveau 1 et 2, paiement Mobile Money : tout pour développer vos revenus.',
    modules: [
      {
        id: 'f3m1', title: 'Parrainage et commissions',
        lecons: [
          {
            id: 'f3m1l1', title: 'Comment fonctionne votre code partenaire', type: 'texte', duration: '5 min',
            content: 'Chaque partenaire dispose d’un code unique (BESTA-XXXX) et d’un lien de parrainage à partager. Toute personne qui commande via votre lien vous est attribuée pendant 30 jours (dernier clic gagnant).\n\nPartagez votre lien sur WhatsApp, Facebook et en boutique : l’application suit automatiquement les clics et les ventes attribuées.',
          },
          {
            id: 'f3m1l2', title: 'Commissions niveau 1 et niveau 2', type: 'texte', duration: '5 min',
            content: 'Vous touchez 3 % sur les ventes de vos filleuls directs (niveau 1) et 1,5 % sur celles de leurs propres filleuls (niveau 2).\n\nExemple : votre filleul vend un kit à 1 850 000 F → vous gagnez 55 500 F. Si son propre filleul vend le même kit, vous touchez encore 27 750 F.\n\nUne affaire gagnée génère sa commission automatiquement ; le gérant la règle ensuite par Mobile Money.',
          },
          { id: 'f3m1l3', title: 'Être payé par Mobile Money', type: 'video', url: YT, duration: '6 min' },
        ],
      },
    ],
  },
];

export const productCategories = [
  { id: 'generateurs', label: 'Générateurs' },
  { id: 'onduleurs', label: 'Onduleurs' },
  { id: 'batteries', label: 'Batteries' },
  { id: 'panneaux', label: 'Panneaux' },
  { id: 'controleurs', label: 'Contrôleurs' },
  { id: 'accessoires', label: 'Accessoires' },
];

export const monthlyData = [
  { month: 'Jan', leads: 8, won: 2, revenue: 1560000 },
  { month: 'Fév', leads: 12, won: 3, revenue: 2340000 },
  { month: 'Mars', leads: 6, won: 2, revenue: 1890000 },
  { month: 'Avr', leads: 15, won: 4, revenue: 3120000 },
  { month: 'Mai', leads: 10, won: 3, revenue: 2450000 },
  { month: 'Juin', leads: 8, won: 2, revenue: 1870000 },
];
