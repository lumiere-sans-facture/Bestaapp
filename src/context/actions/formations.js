// Domaine formation « école » : cours → modules → leçons, avancement par leçon.

/**
 * Crée ou met à jour la fiche d'avancement d'un apprenant pour une leçon, et
 * la remonte en tête de liste. Une fiche neuve naît « ouverte » (status 'vue').
 */
const majFiche = (s, userId, formationId, leconId, maj) => {
  const liste = s.formationProgress || [];
  const existante = liste.find((p) => p.userId === userId && p.leconId === leconId);
  const maintenant = new Date().toISOString();
  const base = existante || {
    id: `fp-${userId}-${leconId}`, userId, formationId, leconId, status: 'vue', date: maintenant, vueLe: maintenant,
  };
  const fiche = maj({ ...base, formationId: base.formationId || formationId, vueLe: base.vueLe || base.date || maintenant });
  return {
    ...s,
    formationProgress: [fiche, ...liste.filter((p) => p !== existante)],
  };
};

export function createFormationActions(setState) {
  // Applique un patch fonctionnel à un cours donné.
  const patchCourse = (formationId, fn) => (s) => ({
    ...s,
    formations: (s.formations || []).map((f) => (f.id === formationId ? fn(f) : f)),
  });
  // Idem pour un module au sein d'un cours.
  const patchModule = (formationId, moduleId, fn) =>
    patchCourse(formationId, (f) => ({
      ...f,
      modules: (f.modules || []).map((m) => (m.id === moduleId ? fn(m) : m)),
    }));

  return {
    // ---- Cours ----
    addFormation: (course) =>
      setState((s) => ({
        ...s,
        formations: [...(s.formations || []), { modules: [], ...course, id: crypto.randomUUID() }],
      })),

    updateFormation: (formationId, patch) =>
      setState((s) => ({
        ...s,
        formations: (s.formations || []).map((f) => (f.id === formationId ? { ...f, ...patch } : f)),
      })),

    deleteFormation: (formationId) =>
      setState((s) => ({
        ...s,
        formations: (s.formations || []).filter((f) => f.id !== formationId),
        formationProgress: (s.formationProgress || []).filter((p) => p.formationId !== formationId),
      })),

    // ---- Modules ----
    // Retourne l'identifiant créé : l'écran en a besoin pour DÉPLIER le
    // module aussitôt, sinon « Ajouter une leçon » reste caché et la création
    // d'un module semble sans effet.
    addModule: (formationId, data) => {
      const id = crypto.randomUUID();
      setState(patchCourse(formationId, (f) => ({
        ...f,
        modules: [...(f.modules || []), { id, title: data.title, lecons: [] }],
      })));
      return id;
    },

    updateModule: (formationId, moduleId, patch) =>
      setState(patchModule(formationId, moduleId, (m) => ({ ...m, ...patch }))),

    deleteModule: (formationId, moduleId) =>
      setState((s) => {
        const course = (s.formations || []).find((f) => f.id === formationId);
        const removed = new Set((course?.modules || []).find((m) => m.id === moduleId)?.lecons?.map((l) => l.id) || []);
        return {
          ...patchCourse(formationId, (f) => ({ ...f, modules: (f.modules || []).filter((m) => m.id !== moduleId) }))(s),
          formationProgress: (s.formationProgress || []).filter((p) => !removed.has(p.leconId)),
        };
      }),

    // ---- Leçons ----
    addLecon: (formationId, moduleId, data) =>
      setState(patchModule(formationId, moduleId, (m) => ({
        ...m,
        lecons: [...(m.lecons || []), { ...data, id: crypto.randomUUID() }],
      }))),

    updateLecon: (formationId, moduleId, leconId, patch) =>
      setState(patchModule(formationId, moduleId, (m) => ({
        ...m,
        lecons: (m.lecons || []).map((l) => (l.id === leconId ? { ...l, ...patch } : l)),
      }))),

    // Déplace une leçon vers un autre module sans perdre son identifiant ni
    // l'avancement déjà enregistré par les apprenants.
    moveLecon: (formationId, fromModuleId, toModuleId, leconId, patch) =>
      setState((s) => {
        const course = (s.formations || []).find((f) => f.id === formationId);
        const source = (course?.modules || []).find((m) => m.id === fromModuleId);
        const lesson = (source?.lecons || []).find((l) => l.id === leconId);
        if (!lesson || fromModuleId === toModuleId) return s;
        const nextLesson = { ...lesson, ...patch };
        return patchCourse(formationId, (f) => ({
          ...f,
          modules: (f.modules || []).map((m) => {
            if (m.id === fromModuleId) return { ...m, lecons: (m.lecons || []).filter((l) => l.id !== leconId) };
            if (m.id === toModuleId) return { ...m, lecons: [...(m.lecons || []), nextLesson] };
            return m;
          }),
        }))(s);
      }),

    deleteLecon: (formationId, moduleId, leconId) =>
      setState((s) => ({
        ...patchModule(formationId, moduleId, (m) => ({
          ...m,
          lecons: (m.lecons || []).filter((l) => l.id !== leconId),
        }))(s),
        formationProgress: (s.formationProgress || []).filter((p) => p.leconId !== leconId),
      })),

    // ---- Avancement (par leçon) ----
    // Une seule fiche par apprenant et par leçon (`fp-<userId>-<leconId>`) :
    //   status  'vue'      leçon ouverte, pas encore terminée ;
    //           'complete' leçon terminée ;
    //   vueLe   première ouverture ;
    //   quiz    { score, total, tentatives, meilleurScore, dernierLe } pour
    //           une leçon quiz vérifiée.
    // Le gérant en tire le suivi de son équipe (utils/suiviFormation.js) :
    // qui se forme, ce qui est regardé, comment se passent les quiz.
    setLeconDone: (userId, formationId, leconId, done = true) =>
      setState((s) => majFiche(s, userId, formationId, leconId, (fiche) => ({
        ...fiche,
        // « Marquer non terminée » : la leçon redevient seulement ouverte —
        // le quiz déjà passé et la première ouverture restent au suivi.
        status: done ? 'complete' : 'vue',
        date: new Date().toISOString(),
      }))),

    // Leçon ouverte : notée UNE fois (première ouverture), pour savoir quels
    // cours sont regardés même quand personne ne clique sur « Terminer ».
    marquerLeconVue: (userId, formationId, leconId) =>
      setState((s) => ((s.formationProgress || []).some((p) => p.userId === userId && p.leconId === leconId)
        ? s
        : majFiche(s, userId, formationId, leconId, (fiche) => fiche))),

    // Quiz vérifié : score de la dernière tentative, meilleur score et nombre
    // de tentatives. La leçon, elle, ne se termine qu'au clic « Terminer ».
    enregistrerQuiz: (userId, formationId, leconId, { score = 0, total = 0 } = {}) =>
      setState((s) => majFiche(s, userId, formationId, leconId, (fiche) => {
        const avant = fiche.quiz || {};
        const maintenant = new Date().toISOString();
        return {
          ...fiche,
          quiz: {
            score, total,
            tentatives: (Number(avant.tentatives) || 0) + 1,
            meilleurScore: Math.max(Number(avant.meilleurScore) || 0, score),
            premierLe: avant.premierLe || maintenant,
            dernierLe: maintenant,
          },
        };
      })),
  };
}
