import { catalogueProducts } from './catalogue';

// v5 : réseau de partenaires à deux niveaux (sponsorId = parrain du partenaire)
export const SEED_VERSION = 5;

export const users = [
  { id: 'u1', email: 'adam@bestasolar.tg', password: 'demo123', name: 'Adam Adébiyi', role: 'gerant', phone: '+228 97 12 34 56', avatar: 'AA' },
  { id: 'u2', email: 'fatou@bestasolar.tg', password: 'demo123', name: 'Fatou Boko', role: 'technicien', phone: '+228 96 78 90 12', avatar: 'FB' },
  { id: 'u3', email: 'ibrahim@bestasolar.tg', password: 'demo123', name: 'Ibrahim Dan Djido', role: 'technicien', phone: '+228 95 55 66 77', avatar: 'ID' },
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
  { id: 'p1', name: 'Mamadou Balogun', phone: '+228 97 11 22 33', sponsorId: null, registeredAt: '2025-01-15', status: 'actif', code: 'MAMADOU-XW9RA3', momoNumber: '+228 97 11 22 33' },
  { id: 'p2', name: 'Aminata Kesso', phone: '+228 96 44 55 66', sponsorId: 'p1', registeredAt: '2025-02-20', status: 'actif', code: 'AMINATA-CFWYX3', momoNumber: '+228 96 44 55 66' },
  { id: 'p3', name: 'Toffa Gname', phone: '+228 95 77 88 99', sponsorId: 'p2', registeredAt: '2025-03-10', status: 'actif', code: 'TOFFA-35A5WB', momoNumber: '' },
  { id: 'p4', name: 'Balogoun Alassane', phone: '+228 94 33 22 11', sponsorId: 'p1', registeredAt: '2025-04-05', status: 'inactif', code: 'BALOGOUN-CPZ6SB', momoNumber: '' },
];

export const leads = [
  { id: 'l1', clientType: 'entreprise', name: 'Clinique Notre Dame', contact: 'Dr. Honoré Ganse', phone: '+228 97 88 99 00', address: 'Quartier Commercial, Lomé', stage: 'negociation', estimatedValue: 2450000, assignedTo: 'u2', parrainL1: 'p1', parrainL2: null, createdAt: '2025-05-10', notes: 'Besoin urgent - panne fréquente', lastActivity: '2025-06-08', activities: [{ id: 'a1', date: '2025-06-08T10:30:00', text: 'Visite technique effectuée, dimensionnement validé pour 3kVA', by: 'u2' }, { id: 'a2', date: '2025-05-12T09:00:00', text: 'Premier appel : pannes CEET fréquentes, besoin urgent', by: 'u2' }] },
  { id: 'l2', clientType: 'entreprise', name: 'Hôtel du Parc', contact: 'M. Kossi Agboka', phone: '+228 96 11 22 33', address: 'Avenue de la Liberté, Lomé', stage: 'proposition', estimatedValue: 1850000, assignedTo: 'u2', parrainL1: 'p2', parrainL2: 'p1', createdAt: '2025-05-15', notes: 'Économie carburant générateur', lastActivity: '2025-06-05' },
  { id: 'l3', clientType: 'entreprise', name: 'Pharmacie Alafia', contact: 'Mme. Françoude Akpaki', phone: '+228 95 44 55 66', address: 'Marché Central, Lomé', stage: 'gagne', estimatedValue: 980000, assignedTo: 'u3', parrainL1: 'p1', parrainL2: null, createdAt: '2025-04-20', notes: 'Devis signé', lastActivity: '2025-06-09', wonAt: '2025-06-09' },
  { id: 'l4', clientType: 'entreprise', name: 'Boulangerie Tcha-Tcha', contact: 'Honoré Tcha-Tcha', phone: '+228 94 77 88 99', address: 'Quartier Zongo, Lomé', stage: 'visite', estimatedValue: 650000, assignedTo: 'u3', parrainL1: 'p3', parrainL2: 'p2', createdAt: '2025-05-25', notes: 'Petite boulangerie', lastActivity: '2025-06-07' },
  { id: 'l5', clientType: 'entreprise', name: 'École Privée Bethanie', contact: 'Directeur Toussaint Hinnou', phone: '+228 97 33 44 55', address: 'Quartier A, Lomé', stage: 'qualifie', estimatedValue: 3200000, assignedTo: 'u2', parrainL1: null, parrainL2: null, createdAt: '2025-06-01', notes: 'École 200 élèves', lastActivity: '2025-06-08' },
  { id: 'l6', clientType: 'entreprise', name: 'Station Service Avion', contact: 'Amidou Nima', phone: '+228 96 66 77 88', address: 'Route de Lomé, Kara', stage: 'nouveau', estimatedValue: 4500000, assignedTo: 'u2', parrainL1: 'p2', parrainL2: null, createdAt: '2025-06-09', notes: 'Nouveau lead', lastActivity: '2025-06-09' },
  { id: 'l7', clientType: 'entreprise', name: "Grain d'Or", contact: 'Bienvenu Ykpè', phone: '+228 95 99 00 11', address: 'Grand Marché, Lomé', stage: 'nouveau', estimatedValue: 320000, assignedTo: 'u3', parrainL1: 'p3', parrainL2: null, createdAt: '2025-06-10', notes: 'Petit commerce', lastActivity: '2025-06-10' },
  { id: 'l8', clientType: 'entreprise', name: 'Benz-Benz Radio', contact: 'Felix Sossa', phone: '+228 94 22 33 44', address: 'Centre-Ville, Lomé', stage: 'gagne', estimatedValue: 890000, assignedTo: 'u2', parrainL1: 'p1', parrainL2: null, createdAt: '2025-03-15', notes: 'Studio radio', lastActivity: '2025-05-20', wonAt: '2025-05-20' },
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
      {
        id: 'f1m3', title: 'Aller plus loin',
        lecons: [
          {
            id: 'f1m3l1', title: 'Le mode Pro : documents à votre identité', type: 'texte', duration: '7 min',
            content: 'Le mode Pro transforme l’application en outil de votre propre entreprise : vos devis et factures portent votre nom, votre logo et vos coordonnées.\n\nCe qu’il apporte :\n- Devis et factures numérotés à votre identité (logo, cachet, signature).\n- Suivi des encaissements : acomptes, soldes, relances.\n- Carnet de clients Pro, séparé de l’espace public.\n\nPour l’activer : Plus → « Passer en mode Pro », puis suivez la demande d’abonnement. Le paiement se fait par Mobile Money et l’activation est confirmée par BestaSolar.',
          },
          {
            id: 'f1m3l2', title: 'Sauvegarder et restaurer les données', type: 'texte', duration: '5 min',
            content: 'Vos données vivent d’abord sur votre appareil : une sauvegarde régulière est votre meilleure assurance.\n\nDepuis Plus → « Sauvegarde des données » (gérant uniquement) :\n- Exporter : télécharge un fichier complet (clients, devis, catalogue, formations…).\n- Restaurer : recharge un fichier exporté, par exemple sur un nouvel appareil.\n\nBonnes pratiques :\n- Exportez une sauvegarde chaque semaine et gardez-la sur un autre support.\n- Faites une sauvegarde AVANT toute grosse opération (changement de téléphone, nettoyage).\n- Si la synchronisation en ligne est active, le serveur garde déjà une copie — la sauvegarde locale reste une sécurité en plus.',
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
            content: 'Trois grandeurs suffisent pour raisonner : la tension (volts), le courant (ampères) et la puissance (watts). Puissance = tension × courant.\n\nUn client qui branche un téléviseur de 100 W pendant 5 heures consomme 500 Wh, soit 0,5 kWh. C’est cette énergie journalière (kWh/jour) qui dimensionne toute l’installation.\n\nÀ retenir :\n- La puissance (W) dimensionne l’onduleur.\n- L’énergie (Wh/jour) dimensionne les panneaux et les batteries.\n- Au Togo, comptez environ 5 heures d’ensoleillement utile par jour.',
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
            content: 'Chaque partenaire dispose d’un code unique (NOM-XXXXXX) et d’un lien de parrainage à partager. Toute personne qui commande via votre lien vous est attribuée pendant 30 jours (dernier clic gagnant).\n\nPartagez votre lien sur WhatsApp, Facebook et en boutique : l’application suit automatiquement les clics et les ventes attribuées.',
          },
          {
            id: 'f3m1l2', title: 'Commissions niveau 1 et niveau 2', type: 'texte', duration: '5 min',
            content: 'Vous touchez 3 % sur les ventes de vos filleuls directs (niveau 1) et 1,5 % sur celles de leurs propres filleuls (niveau 2).\n\nExemple : votre filleul vend un kit à 1 850 000 F → vous gagnez 55 500 F. Si son propre filleul vend le même kit, vous touchez encore 27 750 F.\n\nUne affaire gagnée génère sa commission automatiquement ; le gérant la règle ensuite par Mobile Money.',
          },
          { id: 'f3m1l3', title: 'Être payé par Mobile Money', type: 'video', url: YT, duration: '6 min' },
          {
            id: 'f3m1l4', title: 'Demander le paiement de ses commissions', type: 'texte', duration: '4 min',
            content: 'Quand vos commissions s’accumulent, vous n’avez pas à courir après le gérant : l’application gère la demande de paiement.\n\nDepuis « Mon espace partenaire » :\n- Vérifiez le total de vos commissions en attente.\n- Lancez une demande de paiement en choisissant votre mode (Mobile Money conseillé).\n- Suivez son état : envoyée, validée et payée, ou refusée avec motif.\n\nLe gérant reçoit la demande, la règle puis l’enregistre : les commissions couvertes passent « payées » automatiquement et votre relevé reste propre.',
          },
        ],
      },
    ],
  },
  {
    id: 'f4',
    title: 'Vendre le solaire : convaincre et conclure',
    author: 'BestaSolar Academy',
    description: 'Argumentaire, réponses aux objections et conclusion de vente : la méthode terrain pour transformer un contact en client.',
    modules: [
      {
        id: 'f4m1', title: 'Comprendre le client',
        lecons: [
          {
            id: 'f4m1l1', title: 'À qui vendez-vous ? Les 4 profils types', type: 'texte', duration: '6 min',
            content: 'On ne vend pas le même solaire à tout le monde. Quatre profils reviennent sans cesse :\n\n- Le ménage fatigué des coupures : il veut la lumière, la télé et les téléphones chargés. Sensible au confort et à la tranquillité.\n- Le commerce (boutique, maquis, salon de coiffure) : chaque coupure lui coûte des ventes. Sensible au manque à gagner.\n- Le bureau ou l’atelier : ordinateurs, imprimantes, machines. Sensible à la continuité du travail.\n- Le rural non raccordé : pompage, éclairage, froid. Le solaire n’est pas un secours, c’est SA source d’électricité.\n\nAvant de parler produit, identifiez le profil : c’est lui qui dicte l’argument qui portera.',
          },
          {
            id: 'f4m1l2', title: 'Les questions à poser avant de chiffrer', type: 'texte', duration: '7 min',
            content: 'Un devis précis commence par un bon entretien — jamais par un prix lancé au hasard.\n\nÀ poser systématiquement :\n- Quels appareils voulez-vous alimenter, et combien d’heures par jour ?\n- Qu’est-ce qui doit ABSOLUMENT fonctionner pendant une coupure ?\n- Avez-vous déjà un groupe électrogène ? Combien dépensez-vous en carburant par mois ?\n- La toiture : tôle, dalle, orientation, ombrage ?\n- Quel budget avez-vous en tête ?\n\nNotez tout dans l’application (fiche client) : ces réponses alimentent directement l’assistant de dimensionnement, et votre devis n’en sera que plus crédible.',
          },
        ],
      },
      {
        id: 'f4m2', title: 'Convaincre',
        lecons: [
          {
            id: 'f4m2l1', title: 'Parlez économies, pas technique', type: 'texte', duration: '8 min',
            content: 'Le client n’achète pas des watts : il achète la fin des coupures et des factures qui baissent.\n\nL’argument le plus fort reste la comparaison avec le groupe électrogène :\n- Un groupe consomme chaque jour du carburant, de l’huile et des réparations — souvent 40 000 à 80 000 F par mois.\n- Le solaire demande un investissement au départ, puis le soleil est gratuit.\n- En 2 à 4 ans, l’installation s’est payée toute seule ; le groupe, lui, n’a jamais fini de coûter.\n\nGardez la technique pour rassurer en fin d’entretien. Commencez toujours par le calcul d’économies, fait AVEC le client, sur ses propres chiffres.',
          },
          {
            id: 'f4m2l2', title: 'Répondre aux objections courantes', type: 'texte', duration: '8 min',
            content: '« C’est trop cher. » — Trop cher par rapport à quoi ? Additionnez avec le client 12 mois de carburant, de recharges et de pertes pendant les coupures. Proposez ensuite un kit plus petit qui couvre l’essentiel : mieux vaut démarrer petit qu’abandonner.\n\n« Et quand il pleut ? » — Les panneaux produisent aussi par temps couvert, moins fort. Les batteries prennent le relais la nuit et les mauvais jours : c’est exactement leur rôle, et c’est dimensionné pour.\n\n« Ça tombe en panne, j’en ai vu chez le voisin. » — Les échecs viennent presque toujours d’un matériel bas de gamme ou d’un dimensionnement bâclé. Montrez vos références, votre garantie et votre service après-vente : c’est votre vraie différence.\n\n« Je vais réfléchir. » — Très bien : fixez ensemble la date du prochain contact et enregistrez-la dans l’application. Une relance au bon moment conclut plus de ventes que n’importe quel rabais.',
          },
        ],
      },
      {
        id: 'f4m3', title: 'Conclure et fidéliser',
        lecons: [
          {
            id: 'f4m3l1', title: 'Présenter le devis et conclure', type: 'texte', duration: '6 min',
            content: 'Un devis s’explique en personne (ou au téléphone), jamais envoyé sec par WhatsApp sans commentaire.\n\nLa trame qui marche :\n- Rappelez le besoin exprimé (« vous vouliez le frigo, la télé et 6 lampes »).\n- Présentez la solution en 3 lignes : panneaux, batteries, onduleur — et ce que ça couvre.\n- Donnez le prix TOTAL, puis ce qu’il remplace en dépenses actuelles.\n- Proposez la suite concrète : acompte, date de pose, durée du chantier.\n\nPuis taisez-vous et laissez le client parler. S’il hésite, revenez sur l’objection réelle plutôt que de baisser le prix — un rabais immédiat dévalorise votre travail.',
          },
          {
            id: 'f4m3l2', title: 'Le service après-vente qui fait vendre', type: 'texte', duration: '5 min',
            content: 'Votre meilleur commercial, c’est une installation qui fonctionne — et un client qui le raconte.\n\nAprès chaque pose :\n- Rappelez le client au bout d’une semaine : tout fonctionne ? Des questions ?\n- Montrez-lui les gestes simples : lecture de l’onduleur, quoi faire en cas d’alarme.\n- Revenez pour l’entretien : c’est l’occasion de proposer une extension (plus de panneaux, plus de batteries).\n\nEt surtout : demandez le parrainage. Un client satisfait vous ouvre son quartier — donnez-lui votre code partenaire, il gagne une commission sur chaque vente qu’il vous apporte.',
          },
        ],
      },
    ],
  },
  {
    id: 'f5',
    title: 'Entretenir et dépanner une installation',
    author: 'BestaSolar Academy',
    description: 'Entretien préventif, méthode de diagnostic et pannes courantes : gardez les installations de vos clients au meilleur niveau.',
    modules: [
      {
        id: 'f5m1', title: 'Entretien préventif',
        lecons: [
          {
            id: 'f5m1l1', title: 'Nettoyer et inspecter les panneaux', type: 'texte', duration: '6 min',
            content: 'Un panneau sale peut perdre 10 à 25 % de production — et pendant l’harmattan, la poussière s’accumule en quelques jours.\n\nLa routine d’entretien :\n- Nettoyez tôt le matin ou en soirée, jamais en plein soleil (choc thermique et traces).\n- Eau claire et raclette ou chiffon doux — jamais de détergent agressif ni d’éponge abrasive.\n- Profitez-en pour inspecter : verre fêlé, connecteurs jaunis, câbles rongés, fixations desserrées.\n- Vérifiez l’ombrage : un arbre qui a poussé peut ruiner une chaîne entière.\n\nFréquence conseillée : mensuelle en saison sèche, trimestrielle en saison des pluies. Proposez un contrat d’entretien à vos clients : revenu régulier pour vous, performance garantie pour eux.',
          },
          {
            id: 'f5m1l2', title: 'Prendre soin des batteries', type: 'texte', duration: '8 min',
            content: 'La batterie est l’élément le plus cher et le plus fragile de l’installation : c’est elle qu’un bon entretien sauve.\n\nPour toutes les technologies :\n- Local ventilé, à l’ombre : au-delà de 30 °C, la durée de vie chute rapidement.\n- Bornes propres et serrées ; un point de graisse spéciale contre l’oxydation.\n- Ne descendez pas sous le seuil de décharge recommandé — réglez l’onduleur en conséquence.\n\nPlomb ouvert, en plus :\n- Contrôlez le niveau d’électrolyte chaque mois ; complétez UNIQUEMENT à l’eau distillée.\n- Jamais d’acide, jamais d’eau du robinet.\n\nLithium : pas d’entretien d’électrolyte, mais surveillez l’équilibrage des cellules si l’écran du BMS le permet. Dans tous les cas, notez vos relevés à chaque visite : l’historique révèle une batterie qui faiblit AVANT la panne.',
          },
        ],
      },
      {
        id: 'f5m2', title: 'Diagnostiquer une panne',
        lecons: [
          {
            id: 'f5m2l1', title: 'La méthode de diagnostic en 5 étapes', type: 'texte', duration: '9 min',
            content: 'Ne remplacez jamais une pièce au hasard : suivez la chaîne de l’énergie, du panneau à la prise.\n\n- 1. Écoutez le client : depuis quand, dans quelles conditions, qu’est-ce qui a changé ?\n- 2. Observez l’onduleur : voyants, code d’erreur, alarme — la moitié du diagnostic est déjà là.\n- 3. Mesurez côté panneaux : tension de chaque chaîne, à comparer entre elles et aux valeurs attendues.\n- 4. Mesurez côté batteries : tension au repos, puis sous charge — une batterie qui s’effondre sous charge est en fin de vie.\n- 5. Isolez le défaut : débranchez, testez élément par élément, puis remplacez UNE seule chose à la fois.\n\nSécurité d’abord : coupez côté DC avant d’intervenir, et vérifiez l’absence de tension avant de toucher un conducteur.',
          },
          {
            id: 'f5m2l2', title: 'Pannes courantes et leurs solutions', type: 'texte', duration: '9 min',
            content: '« La production a baissé. » — Panneaux sales, nouvel ombrage, connecteur oxydé ou une chaîne débranchée. Comparez la tension des chaînes : celle qui décroche désigne le coupable.\n\n« L’onduleur sonne ou s’éteint le soir. » — Batteries déchargées trop vite : consommation qui a augmenté (nouveau congélateur ?), batteries vieillissantes, ou seuil de coupure mal réglé. Refaites le bilan de consommation avec le client.\n\n« La batterie ne tient plus. » — Mesurez la tension au repos puis sous charge. Si elle chute brutalement, la batterie est en fin de vie : inutile d’accuser l’onduleur. Proposez le remplacement et expliquez ce qui l’a usée (décharges profondes, chaleur).\n\n« Rien ne fonctionne. » — Vérifiez dans l’ordre : disjoncteurs et fusibles, connexions de batterie, tension du champ. Une simple protection déclenchée est la cause la plus fréquente — cherchez ensuite POURQUOI elle a déclenché avant de réarmer.\n\nAprès chaque intervention, enregistrez la visite dans la fiche du client : le prochain dépannage commencera avec l’historique sous les yeux.',
          },
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

