export const formatCFA = (amount) =>
  Math.round(amount || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' F';

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const initials = (name) =>
  name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
