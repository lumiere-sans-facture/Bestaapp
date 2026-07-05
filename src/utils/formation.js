// Espace formation « école » : cours → modules → leçons. Logique pure, sans React.
// L'avancement est stocké par leçon : { userId, formationId, leconId, status, date }.

/** Leçons d'un cours, aplaties dans l'ordre pédagogique (module puis position). */
export const allLecons = (course) =>
  (course?.modules || []).flatMap((m) =>
    (m.lecons || []).map((l) => ({ ...l, moduleId: m.id, moduleTitle: m.title }))
  );

/** Vrai si l'utilisateur a terminé cette leçon. */
export const isLeconDone = (progress, userId, leconId) =>
  (progress || []).some((p) => p.userId === userId && p.leconId === leconId && p.status === 'complete');

/** Avancement d'un cours pour un utilisateur : leçons faites / total / pourcentage. */
export const courseProgress = (course, progress, userId) => {
  const lecons = allLecons(course);
  const done = lecons.filter((l) => isLeconDone(progress, userId, l.id)).length;
  return { done, total: lecons.length, pct: lecons.length ? Math.round((done / lecons.length) * 100) : 0 };
};

/** Première leçon non terminée (reprise de lecture) — ou la première du cours. */
export const resumeLecon = (course, progress, userId) => {
  const lecons = allLecons(course);
  return lecons.find((l) => !isLeconDone(progress, userId, l.id)) || lecons[0] || null;
};

/** Leçon suivante dans l'ordre du cours (null en fin de cours). */
export const nextLecon = (course, leconId) => {
  const lecons = allLecons(course);
  const i = lecons.findIndex((l) => l.id === leconId);
  return i >= 0 && i < lecons.length - 1 ? lecons[i + 1] : null;
};

/** Leçon précédente dans l'ordre du cours (null en début de cours). */
export const prevLecon = (course, leconId) => {
  const lecons = allLecons(course);
  const i = lecons.findIndex((l) => l.id === leconId);
  return i > 0 ? lecons[i - 1] : null;
};

/** Minutes d'une durée libre (« 12 min », « 1 h 05 ») — 0 si illisible. */
export const parseMinutes = (duration) => {
  const s = String(duration || '').toLowerCase();
  const h = /(\d+)\s*h/.exec(s);
  const m = /(\d+)\s*(?:min|mn)/.exec(s);
  if (h) return Number(h[1]) * 60 + (Number((/h\s*(\d+)/.exec(s) || [])[1]) || 0);
  return m ? Number(m[1]) : 0;
};

/** Durée totale d'un cours, formatée (« 45 min », « 1 h 20 »). */
export const courseDuration = (course) => {
  const total = allLecons(course).reduce((s, l) => s + parseMinutes(l.duration), 0);
  if (!total) return '';
  if (total < 60) return `${total} min`;
  const m = total % 60;
  return `${Math.floor(total / 60)} h${m ? ` ${String(m).padStart(2, '0')}` : ''}`;
};

/** Nombre de leçons + modules, pour les cartes de cours. */
export const courseCounts = (course) => ({
  modules: (course?.modules || []).length,
  lecons: allLecons(course).length,
});
