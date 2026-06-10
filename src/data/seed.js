export const SEED_VERSION = 2;

export const users = [
  { id: 'u1', email: 'adam@bestasolar.bj', password: 'demo123', name: 'Adam Adébiyi', role: 'gerant', phone: '+229 97 12 34 56', avatar: 'AA' },
  { id: 'u2', email: 'fatou@bestasolar.bj', password: 'demo123', name: 'Fatou Boko', role: 'technicien', phone: '+229 96 78 90 12', avatar: 'FB' },
  { id: 'u3', email: 'ibrahim@bestasolar.bj', password: 'demo123', name: 'Ibrahim Dan Djido', role: 'technicien', phone: '+229 95 55 66 77', avatar: 'ID' },
];

export const stages = [
  { id: 'nouveau', label: 'Nouveau', color: '#6366f1' },
  { id: 'qualifie', label: 'Qualifié', color: '#8b5cf6' },
  { id: 'visite', label: 'Visite', color: '#ec4899' },
  { id: 'proposition', label: 'Proposition', color: '#f59e0b' },
  { id: 'negociation', label: 'Négociation', color: '#3b82f6' },
  { id: 'gagne', label: 'Gagné', color: '#10b981' },
];

export const partners = [
  { id: 'p1', name: 'Mamadou Balogun', phone: '+229 97 11 22 33', type: 'Partenaire Level 1', registeredAt: '2025-01-15', status: 'actif' },
  { id: 'p2', name: 'Aminata Kesso', phone: '+229 96 44 55 66', type: 'Partenaire Level 1', registeredAt: '2025-02-20', status: 'actif' },
  { id: 'p3', name: 'Toffa Gname', phone: '+229 95 77 88 99', type: 'Partenaire Level 1', registeredAt: '2025-03-10', status: 'actif' },
  { id: 'p4', name: 'Balogoun Alassane', phone: '+229 94 33 22 11', type: 'Partenaire Level 1', registeredAt: '2025-04-05', status: 'inactif' },
];

export const leads = [
  { id: 'l1', name: 'Clinique Notre Dame', contact: 'Dr. Honoré Ganse', phone: '+229 97 88 99 00', address: 'Quartier Commercial, Parakou', stage: 'negociation', estimatedValue: 2450000, assignedTo: 'u2', parrainL1: 'p1', parrainL2: null, createdAt: '2025-05-10', notes: 'Besoin urgent - panne fréquente', lastActivity: '2025-06-08' },
  { id: 'l2', name: 'Hôtel du Parc', contact: 'M. Kossi Agboka', phone: '+229 96 11 22 33', address: 'Avenue de la Liberté, Parakou', stage: 'proposition', estimatedValue: 1850000, assignedTo: 'u2', parrainL1: 'p2', parrainL2: 'p1', createdAt: '2025-05-15', notes: 'Économie carburant générateur', lastActivity: '2025-06-05' },
  { id: 'l3', name: 'Pharmacie Alafia', contact: 'Mme. Françoude Akpaki', phone: '+229 95 44 55 66', address: 'Marché Central, Parakou', stage: 'gagne', estimatedValue: 980000, assignedTo: 'u3', parrainL1: 'p1', parrainL2: null, createdAt: '2025-04-20', notes: 'Devis signé', lastActivity: '2025-06-09', wonAt: '2025-06-09' },
  { id: 'l4', name: 'Boulangerie Tcha-Tcha', contact: 'Honoré Tcha-Tcha', phone: '+229 94 77 88 99', address: 'Quartier Zongo, Parakou', stage: 'visite', estimatedValue: 650000, assignedTo: 'u3', parrainL1: 'p3', parrainL2: 'p2', createdAt: '2025-05-25', notes: 'Petite boulangerie', lastActivity: '2025-06-07' },
  { id: 'l5', name: 'École Privée Bethanie', contact: 'Directeur Toussaint Hinnou', phone: '+229 97 33 44 55', address: 'Quartier A, Parakou', stage: 'qualifie', estimatedValue: 3200000, assignedTo: 'u2', parrainL1: null, parrainL2: null, createdAt: '2025-06-01', notes: 'École 200 élèves', lastActivity: '2025-06-08' },
  { id: 'l6', name: 'Station Service Avion', contact: 'Amidou Nima', phone: '+229 96 66 77 88', address: 'Route de Cotonou, Parakou', stage: 'nouveau', estimatedValue: 4500000, assignedTo: 'u2', parrainL1: 'p2', parrainL2: null, createdAt: '2025-06-09', notes: 'Nouveau lead', lastActivity: '2025-06-09' },
  { id: 'l7', name: "Grain d'Or", contact: 'Bienvenu Ykpè', phone: '+229 95 99 00 11', address: 'Marché Arzeke, Parakou', stage: 'nouveau', estimatedValue: 320000, assignedTo: 'u3', parrainL1: 'p3', parrainL2: null, createdAt: '2025-06-10', notes: 'Petit commerce', lastActivity: '2025-06-10' },
  { id: 'l8', name: 'Benz-Benz Radio', contact: 'Felix Sossa', phone: '+229 94 22 33 44', address: 'Centre-Ville, Parakou', stage: 'gagne', estimatedValue: 890000, assignedTo: 'u2', parrainL1: 'p1', parrainL2: 'p3', createdAt: '2025-03-15', notes: 'Studio radio', lastActivity: '2025-05-20', wonAt: '2025-05-20' },
];

export const products = [
  { id: 'prod1', name: 'Sacoche Solaire 100W', description: 'Kit portable pour téléphone et tablette', basePrice: 75000, category: 'sacs', stock: 12, image: 'https://images.pexels.com/photos/983436/pexels-photo-983436.jpeg?w=400' },
  { id: 'prod2', name: 'Sacoche Solaire 200W', description: 'Kit portable avec ampoules LED', basePrice: 125000, category: 'sacs', stock: 8, image: 'https://images.pexels.com/photos/983436/pexels-photo-983436.jpeg?w=400' },
  { id: 'prod3', name: 'Panneau Solaire 300W', description: 'Panneau monocristallin haute efficacité', basePrice: 85000, category: 'panneaux', stock: 25, image: 'https://images.pexels.com/photos/356049/pexels-photo-356049.jpeg?w=400' },
  { id: 'prod4', name: 'Panneau Solaire 450W', description: 'Panneau professionnel grande surface', basePrice: 135000, category: 'panneaux', stock: 18, image: 'https://images.pexels.com/photos/356049/pexels-photo-356049.jpeg?w=400' },
  { id: 'prod5', name: 'Batterie 100Ah Gel', description: 'Batterie solaire à décharge profonde', basePrice: 185000, category: 'batteries', stock: 6, image: 'https://images.pexels.com/photos/14733999/pexels-photo-14733999.jpeg?w=400' },
  { id: 'prod6', name: 'Batterie 200Ah Gel', description: 'Batterie solaire grande capacité', basePrice: 295000, category: 'batteries', stock: 5, image: 'https://images.pexels.com/photos/14733999/pexels-photo-14733999.jpeg?w=400' },
  { id: 'prod7', name: 'Onduleur 1.5kVA Pur Sinus', description: 'Convertisseur 12V/220V avec chargeur', basePrice: 195000, category: 'onduleurs', stock: 9, image: 'https://images.pexels.com/photos/9248257/pexels-photo-9248257.jpeg?w=400' },
  { id: 'prod8', name: 'Onduleur 3kVA Pur Sinus', description: 'Convertisseur 24V/220V pro', basePrice: 345000, category: 'onduleurs', stock: 0, image: 'https://images.pexels.com/photos/9248257/pexels-photo-9248257.jpeg?w=400' },
  { id: 'prod9', name: 'Kit Complet 500W', description: 'Panneau 300W + Batt 100Ah + Onduleur + LED', basePrice: 485000, category: 'kits', stock: 3, image: 'https://images.pexels.com/photos/10908002/pexels-photo-10908002.jpeg?w=400' },
  { id: 'prod10', name: 'Kit Complet 1kW', description: '2 Panneaux 300W + 2 Batt 100Ah + Onduleur 1.5kVA', basePrice: 895000, category: 'kits', stock: 4, image: 'https://images.pexels.com/photos/10908002/pexels-photo-10908002.jpeg?w=400' },
  { id: 'prod11', name: 'Ampoule LED Solaire 12V', description: 'Ampoule basse consommation E27', basePrice: 4500, category: 'accessoires', stock: 50, image: 'https://images.pexels.com/photos/6310187/pexels-photo-6310187.jpeg?w=400' },
  { id: 'prod12', name: 'Régulateur PWM 30A', description: 'Régulateur de charge solaire', basePrice: 28000, category: 'accessoires', stock: 15, image: 'https://images.pexels.com/photos/983436/pexels-photo-983436.jpeg?w=400' },
  { id: 'prod13', name: 'Régulateur MPPT 40A', description: 'Régulateur intelligent haute efficacité', basePrice: 65000, category: 'accessoires', stock: 7, image: 'https://images.pexels.com/photos/983436/pexels-photo-983436.jpeg?w=400' },
];

export const commissions = [
  { id: 'c1', partnerId: 'p1', leadId: 'l3', amount: 29400, level: 1, status: 'payée', paidAt: '2025-06-10', createdAt: '2025-06-09' },
  { id: 'c2', partnerId: 'p1', leadId: 'l8', amount: 26700, level: 1, status: 'payée', paidAt: '2025-05-25', createdAt: '2025-05-20' },
  { id: 'c3', partnerId: 'p3', leadId: 'l8', amount: 13350, level: 2, status: 'payée', paidAt: '2025-05-25', createdAt: '2025-05-20' },
  { id: 'c4', partnerId: 'p2', leadId: 'l2', amount: 55500, level: 1, status: 'en_attente', paidAt: null, createdAt: '2025-06-05' },
];

export const productCategories = [
  { id: 'kits', label: 'Kits' },
  { id: 'panneaux', label: 'Panneaux' },
  { id: 'batteries', label: 'Batteries' },
  { id: 'onduleurs', label: 'Onduleurs' },
  { id: 'sacs', label: 'Sacs Solaires' },
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
