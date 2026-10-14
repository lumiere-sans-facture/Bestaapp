// Suivi des formations de l'équipe, pour le gérant : qui se forme, jusqu'où,
// comment se passent les quiz, quels cours sont regardés et lesquels ne le
// sont pas — de quoi encourager chacun à avancer.
//
// Source : les fiches d'avancement (formationProgress), une par apprenant et
// par leçon — status 'vue' (ouverte) ou 'complete' (terminée), `quiz` pour une
// leçon quiz vérifiée (voir context/actions/formations.js).
// Logique pure, sans React.
import { allLecons, coursVisible } from './formation';
import { ageInDays } from './date';

/** Un quiz est « réussi » à partir de 70 % de bonnes réponses, sur la
 *  meilleure tentative : refaire un quiz pour progresser doit compter. */
export const SEUIL_REUSSITE_QUIZ = 0.7;

/** Un apprenant est « actif » s'il a ouvert, terminé ou passé un quiz dans
 *  les 30 derniers jours. */
export const JOURS_ACTIVITE_RECENTE = 30;

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
const moyenne = (valeurs) => (valeurs.length ? Math.round(valeurs.reduce((s, v) => s + v, 0) / valeurs.length) : null);
const plusRecente = (dates) => dates.filter(Boolean).sort().pop() || null;

/** Les apprenants : l'équipe, gérant(s) exclus — ce sont eux qu'on encourage. */
export const apprenantsEquipe = (membres = []) => (membres || []).filter((m) => m && m.id && m.role !== 'gerant');

/** Cours comptés au suivi : visibles de l'équipe (pas masqués), avec au
 *  moins une leçon. */
export const coursSuivis = (formations = []) =>
  (formations || []).filter((c) => coursVisible(c) && allLecons(c).length > 0);

/** Pourcentage d'un résultat de quiz (meilleure tentative). */
const pctQuiz = (q) => pct(Number(q?.meilleurScore ?? q?.score) || 0, Number(q?.total) || 0);

/** Dernière date d'activité d'une fiche (ouverture, fin, quiz). */
const dateFiche = (f) => plusRecente([f.date, f.vueLe, f.quiz?.dernierLe]);

/**
 * Tout le suivi d'un coup.
 * @param {{formations:Array, progression:Array, membres:Array, maintenant?:Date}} e
 * @returns {{apprenants:Array, equipe:object, quiz:object, cours:Array, plusSuivis:Array, moinsSuivis:Array}}
 */
export function suiviFormation({ formations = [], progression = [], membres = [], maintenant = new Date() } = {}) {
  const cours = coursSuivis(formations);
  const apprenants = apprenantsEquipe(membres);
  const idsApprenants = new Set(apprenants.map((a) => a.id));

  // Où se trouve chaque leçon (cours, module) — les fiches d'une leçon
  // supprimée depuis, ou d'un cours masqué, ne comptent pas.
  const ouEst = new Map();
  cours.forEach((c) => (c.modules || []).forEach((m) => (m.lecons || []).forEach((l) => {
    ouEst.set(l.id, { cours: c, module: m, lecon: l });
  })));
  const totalLecons = ouEst.size;

  const fiches = (progression || []).filter((p) => idsApprenants.has(p.userId) && ouEst.has(p.leconId));
  const fichesDe = new Map(apprenants.map((a) => [a.id, []]));
  fiches.forEach((f) => fichesDe.get(f.userId).push(f));

  // ---- Par apprenant ----
  const lignes = apprenants.map((a) => {
    const siennes = fichesDe.get(a.id);
    const terminees = new Set(siennes.filter((f) => f.status === 'complete').map((f) => f.leconId));
    const ouvertes = new Set(siennes.map((f) => f.leconId));
    let modulesTermines = 0;
    let modulesCommences = 0;
    let coursTermines = 0;
    const coursCommences = [];
    cours.forEach((c) => {
      const leconsCours = allLecons(c);
      const faites = leconsCours.filter((l) => terminees.has(l.id)).length;
      if (leconsCours.some((l) => ouvertes.has(l.id))) {
        coursCommences.push({ id: c.id, titre: c.title, faites, total: leconsCours.length, pct: pct(faites, leconsCours.length) });
      }
      if (faites === leconsCours.length) coursTermines += 1;
      (c.modules || []).forEach((m) => {
        const ls = m.lecons || [];
        if (!ls.length) return;
        if (ls.some((l) => ouvertes.has(l.id))) modulesCommences += 1;
        if (ls.every((l) => terminees.has(l.id))) modulesTermines += 1;
      });
    });
    const quiz = siennes.filter((f) => f.quiz && Number(f.quiz.total) > 0).map((f) => {
      const { cours: c, lecon } = ouEst.get(f.leconId);
      const p = pctQuiz(f.quiz);
      return {
        leconId: f.leconId, titre: lecon.title, coursId: c.id, coursTitre: c.title,
        score: Number(f.quiz.score) || 0, meilleurScore: Number(f.quiz.meilleurScore ?? f.quiz.score) || 0,
        total: Number(f.quiz.total) || 0, tentatives: Number(f.quiz.tentatives) || 1,
        pct: p, reussi: p >= SEUIL_REUSSITE_QUIZ * 100, dernierLe: f.quiz.dernierLe || null,
      };
    });
    const derniereActivite = plusRecente(siennes.map(dateFiche));
    return {
      id: a.id, nom: a.name || a.email || 'Membre', role: a.role, telephone: a.phone || '', email: a.email || '',
      leconsTerminees: terminees.size, leconsOuvertes: ouvertes.size, totalLecons,
      pct: pct(terminees.size, totalLecons),
      modulesTermines, modulesCommences, coursTermines, coursCommences,
      quiz, quizReussis: quiz.filter((q) => q.reussi).length, scoreMoyenQuiz: moyenne(quiz.map((q) => q.pct)),
      derniereActivite,
      commence: ouvertes.size > 0,
      actifRecent: !!derniereActivite && ageInDays(derniereActivite, maintenant) <= JOURS_ACTIVITE_RECENTE,
    };
  }).sort((x, y) => y.pct - x.pct || y.leconsOuvertes - x.leconsOuvertes || x.nom.localeCompare(y.nom, 'fr'));

  // ---- L'équipe ----
  const total = lignes.length;
  const ontCommence = lignes.filter((l) => l.commence).length;
  const equipe = {
    total,
    ontCommence, pctCommence: pct(ontCommence, total),
    pasCommence: total - ontCommence, pctPasCommence: total ? 100 - pct(ontCommence, total) : 0,
    actifsRecents: lignes.filter((l) => l.actifRecent).length,
    ontTermineUnCours: lignes.filter((l) => l.coursTermines > 0).length,
    modulesTermines: lignes.reduce((s, l) => s + l.modulesTermines, 0),
    leconsTerminees: lignes.reduce((s, l) => s + l.leconsTerminees, 0),
  };

  // ---- Quiz ----
  const tousQuiz = lignes.flatMap((l) => l.quiz);
  const parQuiz = new Map();
  tousQuiz.forEach((q) => {
    const e = parQuiz.get(q.leconId) || { leconId: q.leconId, titre: q.titre, coursTitre: q.coursTitre, resultats: [] };
    e.resultats.push(q);
    parQuiz.set(q.leconId, e);
  });
  const quiz = {
    realises: tousQuiz.length,
    tentatives: tousQuiz.reduce((s, q) => s + q.tentatives, 0),
    reussis: tousQuiz.filter((q) => q.reussi).length,
    pctReussite: pct(tousQuiz.filter((q) => q.reussi).length, tousQuiz.length),
    scoreMoyen: moyenne(tousQuiz.map((q) => q.pct)),
    apprenants: lignes.filter((l) => l.quiz.length > 0).length,
    // Du plus difficile au plus facile : là où l'équipe bute.
    parQuiz: [...parQuiz.values()].map((e) => ({
      leconId: e.leconId, titre: e.titre, coursTitre: e.coursTitre,
      passes: e.resultats.length,
      scoreMoyen: moyenne(e.resultats.map((r) => r.pct)),
      pctReussite: pct(e.resultats.filter((r) => r.reussi).length, e.resultats.length),
    })).sort((x, y) => x.scoreMoyen - y.scoreMoyen || x.titre.localeCompare(y.titre, 'fr')),
  };

  // ---- Par cours : regardés beaucoup, ou peu ----
  const parCours = cours.map((c) => {
    const leconsCours = allLecons(c);
    const ids = new Set(leconsCours.map((l) => l.id));
    const sur = fiches.filter((f) => ids.has(f.leconId));
    const apprenantsCours = new Set(sur.map((f) => f.userId));
    const termines = lignes.filter((l) => apprenantsCours.has(l.id)
      && leconsCours.every((le) => sur.some((f) => f.userId === l.id && f.leconId === le.id && f.status === 'complete'))).length;
    return {
      id: c.id, titre: c.title, lecons: leconsCours.length,
      apprenants: apprenantsCours.size, pctEquipe: pct(apprenantsCours.size, total),
      termines, pctTermines: pct(termines, total),
      leconsOuvertes: sur.length,
      leconsTerminees: sur.filter((f) => f.status === 'complete').length,
    };
  });
  const parPopularite = [...parCours].sort((x, y) => y.apprenants - x.apprenants || y.leconsOuvertes - x.leconsOuvertes || x.titre.localeCompare(y.titre, 'fr'));

  const plusSuivis = parPopularite.filter((c) => c.apprenants > 0).slice(0, 3);
  const dejaCites = new Set(plusSuivis.map((c) => c.id));
  return {
    apprenants: lignes,
    equipe,
    quiz,
    cours: parPopularite,
    plusSuivis,
    // Les moins suivis : en tête, ceux que personne n'a ouverts — jamais un
    // cours déjà cité parmi les plus suivis (peu de cours au catalogue).
    moinsSuivis: [...parPopularite].reverse().filter((c) => !dejaCites.has(c.id)).slice(0, 3),
  };
}

const sansAccents = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Recherche d'apprenants : chaque mot tapé doit se retrouver dans le nom,
 * l'e-mail ou le numéro (accents et majuscules ignorés ; les chiffres d'un
 * numéro se cherchent sans espaces ni indicatif imposé).
 */
export const chercherApprenants = (lignes = [], requete = '') => {
  const mots = sansAccents(requete).split(/\s+/).filter(Boolean);
  if (!mots.length) return lignes;
  return lignes.filter((l) => {
    const texte = sansAccents(`${l.nom} ${l.email || ''}`);
    const chiffres = String(l.telephone || '').replace(/\D/g, '');
    return mots.every((m) => texte.includes(m) || (/^\+?\d+$/.test(m) && chiffres.includes(m.replace(/\D/g, ''))));
  });
};

/** Message d'encouragement WhatsApp pour un apprenant (prénom seul). */
export const messageEncouragement = (ligne, coursConseille = null) => {
  const prenom = String(ligne?.nom || '').trim().split(/\s+/)[0] || '';
  const bonjour = prenom ? `Bonjour ${prenom}` : 'Bonjour';
  if (!ligne?.commence) {
    return `${bonjour}, l'Académie BestaSolar vous attend dans l'application (Plus → Formation)${coursConseille ? ` : commencez par « ${coursConseille} »` : ''}. Quelques minutes par jour suffisent pour mieux vendre et mieux installer. Bon courage !`;
  }
  const n = ligne.leconsTerminees;
  const enCours = (ligne.coursCommences || []).find((c) => c.pct < 100);
  return `${bonjour}, bravo pour votre progression dans l'Académie BestaSolar (${n} leçon${n > 1 ? 's' : ''} terminée${n > 1 ? 's' : ''}) !${enCours ? ` Continuez « ${enCours.titre} » : vous en êtes à ${enCours.pct} %.` : ''} Bon courage !`;
};
