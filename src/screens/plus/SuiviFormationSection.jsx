import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle, ListChecks, BookOpen, Users, CheckCircle2, AlertTriangle, Search } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { suiviFormation, messageEncouragement, chercherApprenants, SEUIL_REUSSITE_QUIZ, JOURS_ACTIVITE_RECENTE } from '../../utils/suiviFormation';
import { ageInDays } from '../../utils/date';
import { initials } from '../../utils/format';
import { whatsappLink } from '../../utils/paiement';
import Sheet from '../../components/Sheet';

const FILTRES = [
  { id: 'tous', label: 'Tous' },
  { id: 'pas-commence', label: 'Pas commencé' },
  { id: 'en-cours', label: 'En cours' },
  { id: 'inactifs', label: `Inactifs ${JOURS_ACTIVITE_RECENTE} j` },
];
const VUES = [
  { id: 'apprenants', label: 'Apprenants', icone: Users },
  { id: 'cours', label: 'Cours', icone: BookOpen },
  { id: 'quiz', label: 'Quiz', icone: ListChecks },
];

/** « il y a 3 j », « aujourd'hui », « jamais ». */
const depuis = (iso) => {
  if (!iso) return 'jamais';
  const j = Math.floor(ageInDays(iso));
  if (j <= 0) return 'aujourd’hui';
  if (j === 1) return 'hier';
  return `il y a ${j} j`;
};
const dateCourte = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—');

/** Barre horizontale d'une seule teinte : la valeur se lit à droite. */
function Barre({ label, pct, valeur, titre }) {
  return (
    <div className="rating-bar-row formation-barre" title={titre}>
      {label != null && <span className="rating-bar-label formation-barre-label">{label}</span>}
      <span className="rating-bar-track">
        <span className="rating-bar-fill" style={{ width: `${pct > 0 ? Math.max(3, pct) : 0}%`, background: 'var(--primary)' }} />
      </span>
      <span className="rating-bar-val formation-barre-val">{valeur}</span>
    </div>
  );
}

/**
 * Plus → « Suivi des formations » (gérant) : la progression de chaque membre
 * de l'équipe dans l'Académie, les cours regardés ou délaissés, les quiz
 * réussis ou ratés — et un message WhatsApp prêt pour encourager.
 */
export default function SuiviFormationSection({ onBack }) {
  const { formations, formationProgress, team, teamChargee } = useData();
  const s = useMemo(
    () => suiviFormation({ formations, progression: formationProgress, membres: team }),
    [formations, formationProgress, team]
  );
  const [vue, setVue] = useState('apprenants');
  const [filtre, setFiltre] = useState('tous');
  // Recherche par nom, e-mail ou numéro (accents et majuscules ignorés).
  const [recherche, setRecherche] = useState('');
  const [detailId, setDetailId] = useState(null);
  const detail = s.apprenants.find((a) => a.id === detailId) || null;
  // Cours conseillé à qui n'a pas commencé : le plus suivi par l'équipe, ou
  // à défaut le premier du catalogue.
  const coursConseille = s.plusSuivis[0]?.titre || s.cours[0]?.titre || null;

  const apprenants = chercherApprenants(s.apprenants, recherche).filter((a) => {
    if (filtre === 'pas-commence') return !a.commence;
    if (filtre === 'en-cours') return a.commence && a.pct < 100;
    if (filtre === 'inactifs') return !a.actifRecent;
    return true;
  });
  const { equipe, quiz } = s;

  const pastilles = [
    { cle: 'membres', valeur: equipe.total, label: 'Membres', ton: 'info' },
    { cle: 'commence', valeur: `${equipe.pctCommence}\u202f%`, label: `Ont commencé (${equipe.ontCommence})`, ton: 'success' },
    { cle: 'pas', valeur: `${equipe.pctPasCommence}\u202f%`, label: `Pas commencé (${equipe.pasCommence})`, ton: equipe.pasCommence ? 'warning' : 'neutral' },
    { cle: 'actifs', valeur: equipe.actifsRecents, label: `Actifs · ${JOURS_ACTIVITE_RECENTE} j`, ton: 'primary' },
    { cle: 'modules', valeur: equipe.modulesTermines, label: 'Modules terminés', ton: 'accent' },
    { cle: 'quiz', valeur: quiz.realises, label: quiz.scoreMoyen != null ? `Quiz · moyenne ${quiz.scoreMoyen}\u202f%` : 'Quiz réalisés', ton: 'primary' },
  ];

  return (
    <>
      <button className="btn btn-outline btn-sm back-button back-to-plus" onClick={onBack}>
        <ChevronLeft size={16} /> Retour
      </button>
      <div className="section-title">Suivi des formations</div>
      <p className="text-sm text-secondary formation-suivi-intro">
        La progression de votre équipe dans l’Académie : qui s’est lancé, jusqu’où, et comment se passent
        les quiz. Encouragez ceux qui n’ont pas commencé : un message suffit souvent.
      </p>

      <div className="stat-strip formation-pastilles">
        {pastilles.map((p) => (
          <div key={p.cle} className={`stat-pill is-${p.ton}`}>
            <span className="stat-pill-num">{p.valeur}</span>
            <span className="stat-pill-label">{p.label}</span>
          </div>
        ))}
      </div>

      <div className="categories-scroll" role="tablist" aria-label="Vue du suivi">
        {VUES.map((v) => (
          <button key={v.id} type="button" role="tab" aria-selected={vue === v.id}
            className={`category-chip ${vue === v.id ? 'active' : ''}`} onClick={() => setVue(v.id)}>
            <v.icone size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{v.label}
          </button>
        ))}
      </div>

      {vue === 'apprenants' && (
        <div className="card formation-suivi-carte">
          <div className="search-box formation-recherche">
            <Search size={18} className="search-icon" />
            <input type="search" className="input search-input" aria-label="Rechercher un apprenant"
              placeholder="Nom, e-mail ou numéro…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </div>
          <div className="categories-scroll is-wrap" style={{ marginBottom: 12 }} aria-label="Filtrer les apprenants">
            {FILTRES.map((f) => (
              <button key={f.id} type="button" className={`category-chip ${filtre === f.id ? 'active' : ''}`}
                aria-pressed={filtre === f.id} onClick={() => setFiltre(f.id)}>{f.label}</button>
            ))}
          </div>
          {(recherche.trim() || filtre !== 'tous') && apprenants.length > 0 && (
            <div className="text-sm text-secondary formation-compte" role="status">
              {apprenants.length} apprenant{apprenants.length > 1 ? 's' : ''} sur {equipe.total}
            </div>
          )}
          {apprenants.length === 0 ? (
            <p className="text-sm text-secondary" role="status">
              {!teamChargee ? 'Chargement de l’équipe…'
                : equipe.total === 0 ? 'Aucun membre dans l’équipe pour l’instant.'
                  : recherche.trim() ? `Aucun apprenant ne correspond à « ${recherche.trim()} ».`
                    : 'Personne dans ce filtre.'}
            </p>
          ) : (
            <ul className="formation-apprenants">
              {apprenants.map((a) => (
                <li key={a.id} className="formation-apprenant">
                  <button type="button" className="formation-apprenant-corps" onClick={() => setDetailId(a.id)}>
                    <span className="partner-avatar formation-avatar">{initials(a.nom)}</span>
                    <span className="formation-apprenant-infos">
                      <span className="formation-apprenant-nom">{a.nom}</span>
                      <span className="formation-apprenant-ligne">
                        {a.commence
                          ? `${a.leconsTerminees} leçon${a.leconsTerminees > 1 ? 's' : ''} · ${a.modulesTermines} module${a.modulesTermines > 1 ? 's' : ''} · ${a.coursTermines} cours terminé${a.coursTermines > 1 ? 's' : ''}`
                          : 'Pas encore commencé'}
                      </span>
                      <span className="formation-apprenant-ligne">
                        {a.quiz.length ? `Quiz : ${a.quizReussis}/${a.quiz.length} réussi${a.quizReussis > 1 ? 's' : ''} · moyenne ${a.scoreMoyenQuiz}\u202f%` : 'Aucun quiz'}
                        {' · '}dernière activité {depuis(a.derniereActivite)}
                      </span>
                      <Barre pct={a.pct} valeur={`${a.pct}\u202f%`} titre={`${a.nom} : ${a.leconsTerminees} leçon(s) terminée(s) sur ${a.totalLecons}`} />
                    </span>
                    <ChevronRight size={16} className="formation-apprenant-fleche" />
                  </button>
                  {a.telephone && (
                    <a className="btn btn-sm btn-outline formation-encourager" target="_blank" rel="noopener noreferrer"
                      href={whatsappLink(a.telephone, messageEncouragement(a, coursConseille))}
                      aria-label={`Encourager ${a.nom} sur WhatsApp`}>
                      <MessageCircle size={14} /> Encourager
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {vue === 'cours' && (
        <div className="card formation-suivi-carte">
          <p className="text-sm text-secondary" style={{ marginBottom: 12 }}>
            Du plus regardé au moins regardé : membres qui ont ouvert au moins une leçon du cours, sur {equipe.total}.
          </p>
          {s.cours.map((c) => (
            <div key={c.id} className="formation-cours-ligne">
              <div className="formation-cours-nom">{c.titre}</div>
              <Barre pct={c.pctEquipe} valeur={`${c.apprenants}/${equipe.total}`}
                titre={`${c.titre} : ouvert par ${c.apprenants} membre(s), terminé par ${c.termines}`} />
              <div className="formation-apprenant-ligne">
                {c.termines} l’{c.termines > 1 ? 'ont' : 'a'} terminé · {c.leconsTerminees} leçon{c.leconsTerminees > 1 ? 's' : ''} terminée{c.leconsTerminees > 1 ? 's' : ''} sur {c.lecons} au catalogue
                {c.apprenants === 0 && <span className="formation-a-relancer"> · personne ne l’a ouvert</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {vue === 'quiz' && (
        <div className="card formation-suivi-carte">
          <p className="text-sm text-secondary" style={{ marginBottom: 12 }}>
            Score moyen de l’équipe (meilleure tentative de chacun), du plus difficile au plus facile.
            Un quiz est réussi à partir de {Math.round(SEUIL_REUSSITE_QUIZ * 100)} % de bonnes réponses.
          </p>
          {quiz.parQuiz.length === 0 ? (
            <p className="text-sm text-secondary">Aucun quiz réalisé pour l’instant.</p>
          ) : quiz.parQuiz.map((q) => (
            <div key={q.leconId} className="formation-cours-ligne">
              <div className="formation-cours-nom">{q.titre}</div>
              <div className="formation-apprenant-ligne">{q.coursTitre}</div>
              <Barre pct={q.scoreMoyen} valeur={`${q.scoreMoyen}\u202f%`}
                titre={`${q.titre} : ${q.passes} passage(s), score moyen ${q.scoreMoyen} %, ${q.pctReussite}\u202f% de réussite`} />
              <div className="formation-apprenant-ligne">
                {q.passes} passé{q.passes > 1 ? 's' : ''} · {q.pctReussite}{'\u202f'}% de réussite
                {q.scoreMoyen < SEUIL_REUSSITE_QUIZ * 100 && (
                  <span className="formation-a-relancer"> · <AlertTriangle size={12} style={{ verticalAlign: -1 }} /> à revoir avec l’équipe</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={!!detail} onClose={() => setDetailId(null)} title={detail?.nom || ''}
        subtitle={detail ? `${detail.pct}\u202f% de l’Académie · dernière activité ${depuis(detail.derniereActivite)}` : ''}>
        {detail && (
          <>
            <div className="sheet-section-title"><BookOpen size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Cours</div>
            {detail.coursCommences.length === 0 ? (
              <p className="text-sm text-secondary">Aucun cours ouvert.</p>
            ) : detail.coursCommences.map((c) => (
              <div key={c.id} className="formation-cours-ligne">
                <div className="formation-cours-nom">
                  {c.titre} {c.pct >= 100 && <CheckCircle2 size={14} className="formation-termine" aria-label="Terminé" />}
                </div>
                <Barre pct={c.pct} valeur={`${c.faites}/${c.total}`} titre={`${c.titre} : ${c.faites} leçon(s) terminée(s) sur ${c.total}`} />
              </div>
            ))}
            <div className="sheet-section-title" style={{ marginTop: 16 }}><ListChecks size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Quiz réalisés</div>
            {detail.quiz.length === 0 ? (
              <p className="text-sm text-secondary">Aucun quiz pour l’instant.</p>
            ) : (
              <ul className="formation-quiz-liste">
                {detail.quiz.map((q) => (
                  <li key={q.leconId} className="formation-quiz">
                    <div>
                      <div className="formation-cours-nom">{q.titre}</div>
                      <div className="formation-apprenant-ligne">
                        {q.coursTitre} · {q.tentatives} tentative{q.tentatives > 1 ? 's' : ''} · {dateCourte(q.dernierLe)}
                      </div>
                    </div>
                    <span className={`formation-quiz-score ${q.reussi ? 'is-reussi' : 'is-rate'}`}>
                      {q.reussi ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                      {q.meilleurScore}/{q.total}
                      <span className="formation-quiz-mention">{q.reussi ? 'réussi' : 'à revoir'}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {detail.telephone && (
              <a className="btn btn-primary btn-block" style={{ marginTop: 16 }} target="_blank" rel="noopener noreferrer"
                href={whatsappLink(detail.telephone, messageEncouragement(detail, coursConseille))}>
                <MessageCircle size={16} /> Encourager sur WhatsApp
              </a>
            )}
          </>
        )}
      </Sheet>
    </>
  );
}
