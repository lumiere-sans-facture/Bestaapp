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

// ---- Garde-fous d'accès aux cours ----
// Deux réglages posés par le gérant sur chaque cours :
//   masque : le cours existe mais n'est visible que de ses gestionnaires
//            (brouillon, contenu retiré sans suppression — la progression
//            des membres est conservée pour un éventuel retour).
//   acces  : 'tous' (défaut) ou 'pro' — réservé aux abonnés Devis Pro actifs.
// Les cours existants n'ont aucun de ces champs : ils restent ouverts à tous.

/** Le cours apparaît-il dans le catalogue de cet utilisateur ?
 *  `gere` : vrai si l'utilisateur administre ce cours (gérant de l'org
 *  propriétaire) — il voit alors aussi ses cours masqués. */
export const coursVisible = (course, gere = false) => !course?.masque || gere;

/** Le cours est-il verrouillé pour cet utilisateur (visible mais pas
 *  ouvrable) ? Réservé Pro sans abonnement actif — le gestionnaire du cours
 *  n'est jamais verrouillé. */
export const coursVerrouille = (course, { proActif = false, gere = false } = {}) =>
  course?.acces === 'pro' && !proActif && !gere;

/**
 * Action proposée par la carte d'un cours dans le catalogue.
 *
 * Le cas qui compte : un cours SANS aucune leçon. Il n'y a rien à suivre,
 * mais son GESTIONNAIRE doit pouvoir l'ouvrir — c'est dans la vue du cours
 * qu'on ajoute modules et leçons. Fermer la porte à tout le monde enfermait
 * chaque cours neuf dans un cul-de-sac : créé, puis impossible à remplir.
 *
 * @returns {{etat:string, label:string, ouvrable:boolean}}
 */
export const actionCours = ({ verrouille = false, gere = false, lecons = 0, pct = 0, done = 0 } = {}) => {
  if (verrouille) return { etat: 'verrouille', label: 'Réservé aux membres Pro', ouvrable: false };
  if (!lecons) {
    return gere
      ? { etat: 'a-remplir', label: 'Ajouter le contenu', ouvrable: true }
      : { etat: 'vide', label: 'Bientôt disponible', ouvrable: false };
  }
  if (pct >= 100) return { etat: 'termine', label: 'Revoir le cours', ouvrable: true };
  if (done > 0) return { etat: 'en-cours', label: 'Continuer', ouvrable: true };
  return { etat: 'a-demarrer', label: 'Commencer', ouvrable: true };
};

// ---- Sommaire minuté des vidéos (« Timer de la vidéo ») ----

/** « mm:ss » ou « h:mm:ss » → secondes (NaN si illisible). */
export const parseTimecode = (txt) => {
  const parts = String(txt || '').trim().split(':').map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n)) || parts.length < 2 || parts.length > 3) return NaN;
  return parts.reduce((s, n) => s * 60 + n, 0);
};

/** Secondes → « mm:ss » (ou « h:mm:ss » au-delà d'une heure). */
export const formatTimecode = (s) => {
  const sec = Math.max(0, Math.floor(Number(s) || 0));
  const two = (n) => String(n).padStart(2, '0');
  const h = Math.floor(sec / 3600);
  return h ? `${h}:${two(Math.floor((sec % 3600) / 60))}:${two(sec % 60)}` : `${two(Math.floor(sec / 60))}:${two(sec % 60)}`;
};

/** Texte du formulaire (« 00:43 Déménagement du site ») → chapitres triés. */
export const parseChaptersText = (text) =>
  String(text || '')
    .split('\n')
    .map((line) => {
      const m = line.trim().match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
      return m ? { t: parseTimecode(m[1]), label: m[2].trim() } : null;
    })
    .filter((c) => c && !Number.isNaN(c.t))
    .sort((a, b) => a.t - b.t);

/** Chapitres → texte éditable (une ligne par chapitre). */
export const chaptersToText = (chapters = []) =>
  chapters.map((c) => `${formatTimecode(c.t)} ${c.label}`).join('\n');

// ---- Quiz (leçon de type « quiz ») ----
// Une question : { id, question, choix: [texte, …], bonne: index du bon
// choix, explication }. Les réponses de l'apprenant : { [idQuestion]: index }.
// La correction est automatique et immédiate : l'explication dit POURQUOI
// la bonne réponse l'est, ce qui fait d'une erreur une occasion d'apprendre.

/** La question est-elle jouable : un énoncé, au moins deux choix, une bonne
 *  réponse qui existe parmi eux, et une explication à montrer après coup ? */
export const questionValide = (q) => !!q
  && typeof q.id === 'string' && q.id !== ''
  && String(q.question || '').trim() !== ''
  && Array.isArray(q.choix) && q.choix.length >= 2
  && q.choix.every((c) => String(c || '').trim() !== '')
  && Number.isInteger(q.bonne) && q.bonne >= 0 && q.bonne < q.choix.length
  && String(q.explication || '').trim() !== '';

/**
 * Correction d'un quiz. `complet` : toutes les questions ont une réponse —
 * la correction ne s'affiche qu'à ce moment, une question oubliée ne doit pas
 * passer pour une erreur.
 * @returns {{resultats: Array<{id, choisie, bonne, juste}>, score: number, total: number, complet: boolean}}
 */
export const corrigerQuiz = (questions = [], reponses = {}) => {
  const resultats = (questions || []).map((q) => {
    const choisie = reponses?.[q.id];
    const repondu = Number.isInteger(choisie);
    return { id: q.id, choisie: repondu ? choisie : null, bonne: q.bonne, juste: repondu && choisie === q.bonne };
  });
  return {
    resultats,
    score: resultats.filter((r) => r.juste).length,
    total: resultats.length,
    complet: resultats.length > 0 && resultats.every((r) => r.choisie != null),
  };
};

// ---- Texte d'une leçon : paragraphes, listes et schémas ----
// Un schéma s'insère par une ligne seule « [[schema:nom]] », séparée du reste
// par une ligne vide. Le nom désigne un dessin livré AVEC l'application
// (components/formation/SchemaFormation) : la base ne stocke jamais de SVG,
// donc rien de ce qu'elle contient n'est injecté tel quel dans la page.
const LIGNE_SCHEMA = /^\[\[schema:([a-z0-9-]+)\]\]$/;

/**
 * Blocs d'un texte de leçon, dans l'ordre :
 *   { type: 'schema', nom }  ou  { type: 'texte', paragraphe, items }.
 * Un bloc est séparé du suivant par une ligne vide ; dans un bloc texte, les
 * lignes « - … » forment une liste, les autres un paragraphe.
 */
export const blocsLecon = (content) => String(content || '')
  .split(/\n{2,}/)
  .map((bloc) => {
    const schema = LIGNE_SCHEMA.exec(bloc.trim());
    if (schema) return { type: 'schema', nom: schema[1] };
    const lignes = bloc.split('\n');
    return {
      type: 'texte',
      paragraphe: lignes.filter((l) => !l.startsWith('- ')).join(' ').trim(),
      items: lignes.filter((l) => l.startsWith('- ')).map((l) => l.slice(2)),
    };
  })
  .filter((b) => b.type === 'schema' || b.paragraphe || b.items.length);

/** Noms des schémas cités dans un texte de leçon. */
export const schemasCites = (content) =>
  blocsLecon(content).filter((b) => b.type === 'schema').map((b) => b.nom);
