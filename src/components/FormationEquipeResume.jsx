import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ChevronRight } from 'lucide-react';
import { useData } from '../context/DataContext';
import { suiviFormation, JOURS_ACTIVITE_RECENTE } from '../utils/suiviFormation';

/** Combien de noms montrer dans « Pas encore commencé » avant « +N ». */
const NOMS_MAX = 5;

/**
 * « Mon profil » du gérant : les statistiques de formation de son équipe,
 * en résumé — chiffres clés, les plus avancés, qui n'a pas commencé. Le
 * détail (recherche, quiz, cours) est dans Plus → « Suivi des formations ».
 */
export default function FormationEquipeResume() {
  const { formations, formationProgress, team, teamChargee } = useData();
  const s = useMemo(
    () => suiviFormation({ formations, progression: formationProgress, membres: team }),
    [formations, formationProgress, team]
  );
  if (!s.cours.length) return null;
  const { equipe, quiz } = s;
  const plusAvances = s.apprenants.filter((a) => a.leconsTerminees > 0).slice(0, 3);
  const pasCommence = s.apprenants.filter((a) => !a.commence);

  const chiffres = [
    { cle: 'membres', valeur: equipe.total, label: `membre${equipe.total > 1 ? 's' : ''} à former` },
    { cle: 'commence', valeur: `${equipe.pctCommence} %`, label: `ont commencé (${equipe.ontCommence})` },
    { cle: 'actifs', valeur: equipe.actifsRecents, label: `actif${equipe.actifsRecents > 1 ? 's' : ''} sur ${JOURS_ACTIVITE_RECENTE} jours` },
    { cle: 'modules', valeur: equipe.modulesTermines, label: `module${equipe.modulesTermines > 1 ? 's' : ''} terminé${equipe.modulesTermines > 1 ? 's' : ''}` },
    { cle: 'quiz', valeur: quiz.realises, label: `quiz réalisé${quiz.realises > 1 ? 's' : ''}${quiz.scoreMoyen != null ? ` · moyenne ${quiz.scoreMoyen} %` : ''}` },
    { cle: 'cours', valeur: equipe.ontTermineUnCours, label: 'ont terminé un cours' },
  ];

  return (
    <div className="card my-partner-section formation-resume">
      <div className="profile-edit-header">
        <div className="card-title"><GraduationCap size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Formation de mon équipe</div>
      </div>
      {!teamChargee ? (
        <p className="text-sm text-secondary">Chargement de l’équipe…</p>
      ) : equipe.total === 0 ? (
        <p className="text-sm text-secondary">Aucun membre dans l’équipe pour l’instant : invitez vos techniciens depuis Plus → Équipe.</p>
      ) : (
        <>
          <div className="formation-chiffres formation-resume-chiffres">
            {chiffres.map((c) => (
              <div key={c.cle}><span className="formation-chiffre">{c.valeur}</span><span className="formation-chiffre-label">{c.label}</span></div>
            ))}
          </div>

          <div className="formation-cours-titre">Les plus avancés</div>
          {plusAvances.length ? plusAvances.map((a) => (
            <div key={a.id} className="formation-barre-bloc" title={`${a.nom} : ${a.leconsTerminees} leçon(s) terminée(s) sur ${a.totalLecons}`}>
              <div className="formation-barre-nom">{a.nom}</div>
              <div className="rating-bar-row formation-barre">
                <span className="rating-bar-track"><span className="rating-bar-fill" style={{ width: `${Math.max(3, a.pct)}%`, background: 'var(--primary)' }} /></span>
                <span className="rating-bar-val formation-barre-val">{a.pct}{' '}%</span>
              </div>
            </div>
          )) : <p className="text-sm text-secondary">Personne n’a encore terminé de leçon.</p>}

          {pasCommence.length > 0 && (
            <>
              <div className="formation-cours-titre">Pas encore commencé ({pasCommence.length})</div>
              <p className="text-sm formation-resume-noms">
                {pasCommence.slice(0, NOMS_MAX).map((a) => a.nom).join(', ')}
                {pasCommence.length > NOMS_MAX && ` et ${pasCommence.length - NOMS_MAX} autre${pasCommence.length - NOMS_MAX > 1 ? 's' : ''}`}
              </p>
            </>
          )}

          <Link to="/plus/suiviformation" className="btn btn-outline btn-block formation-resume-lien">
            Voir le suivi détaillé <ChevronRight size={16} />
          </Link>
        </>
      )}
    </div>
  );
}
