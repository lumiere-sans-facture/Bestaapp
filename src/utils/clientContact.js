// Identité et traçabilité des clients. Ces helpers sont purs afin que la
// création depuis le carnet, le pipeline et l'espace Devis Pro applique les
// mêmes règles, même hors ligne.
import { normalizePhoneNumber } from '../../shared/phone.js';

export const normalizeClientEmail = (email) => {
  const value = String(email || '').trim().toLowerCase();
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
};

export const clientIdentity = (client = {}) => ({
  phone: normalizePhoneNumber(client.phone),
  email: normalizeClientEmail(client.email),
});

export const canSyncClientContact = (client = {}) => {
  const { phone, email } = clientIdentity(client);
  return Boolean(phone || email);
};

// Deux fiches représentent le même client quand au moins un identifiant fort
// (téléphone ou e-mail) est identique. Un nom seul ne suffit jamais : les
// homonymes restent deux clients différents.
export const isSameClient = (a, b) => {
  const left = clientIdentity(a);
  const right = clientIdentity(b);
  return Boolean(
    (left.phone && right.phone && left.phone === right.phone)
    || (left.email && right.email && left.email === right.email)
  );
};

export const buildClientSource = ({ userId, partner, referrer, at = new Date().toISOString() } = {}) => ({
  userId: userId || null,
  partnerId: partner?.id || null,
  partnerName: partner?.name || null,
  partnerCode: partner?.code || null,
  referredByPartnerId: referrer?.id || null,
  referredByPartnerName: referrer?.name || null,
  referredByPartnerCode: referrer?.code || null,
  firstAddedAt: at,
  lastAddedAt: at,
});

const sameSource = (a, b) =>
  (a?.userId || null) === (b?.userId || null)
  && (a?.partnerId || null) === (b?.partnerId || null)
  && (a?.referredByPartnerId || null) === (b?.referredByPartnerId || null);

export const appendClientSource = (history, source) => {
  if (!source?.userId && !source?.partnerId && !source?.referredByPartnerId) return history || [];
  const entries = Array.isArray(history) ? history : [];
  const index = entries.findIndex((entry) => sameSource(entry, source));
  if (index < 0) return [...entries, source];
  return entries.map((entry, i) => i === index
    ? { ...entry, ...source, firstAddedAt: entry.firstAddedAt || source.firstAddedAt }
    : entry);
};

// Anciennes fiches n'avaient qu'un auteur principal. Elles conservent cette
// information dans le nouvel historique dès leur première réutilisation.
export const sourceHistoryFor = (client = {}) => {
  const history = Array.isArray(client.registrationHistory) ? client.registrationHistory : [];
  if (history.length) return history;
  const legacy = buildClientSource({
    userId: client.registeredByUserId || client.assignedTo || client.userId,
    partner: client.registeredByPartnerId || client.registeredByPartnerName || client.registeredByPartnerCode
      ? { id: client.registeredByPartnerId, name: client.registeredByPartnerName, code: client.registeredByPartnerCode }
      : null,
    at: client.createdAt || new Date().toISOString(),
  });
  return legacy.userId || legacy.partnerId ? [legacy] : [];
};
