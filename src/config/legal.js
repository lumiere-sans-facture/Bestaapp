// Éditeur de l'application BestaSolar Pro — mentions légales des pages
// publiques (public/privacy.html, conditions.html, suppression-compte.html).
//
// À NE PAS confondre avec COMPANY (config/company.js) : l'entreprise qui
// ÉMET les devis et factures BestaSolar. L'éditeur du logiciel, lui, est
// l'entité togolaise ci-dessous.
export const EDITEUR = {
  raisonSociale: 'BESTA SOLAR TOGO',
  forme: 'Entreprise individuelle',
  rccm: 'TG-LFW-01-2025-A10-01086',
  adresse: 'Adidoadin, Lomé — Togo',
  email: 'contact@bestasolar.com',
};

/** Domaine public de l'app : les apps natives y renvoient pour les pages légales. */
export const SITE_PUBLIC = 'https://app.bestasolar.com';

/** Pages légales statiques, servies depuis public/. */
export const PAGES_LEGALES = {
  confidentialite: { chemin: '/privacy.html', libelle: 'Confidentialité' },
  conditions: { chemin: '/conditions.html', libelle: "Conditions d'utilisation" },
  suppression: { chemin: '/suppression-compte.html', libelle: 'Supprimer son compte' },
};
