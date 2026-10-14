import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ChevronRight } from 'lucide-react';
import { useData } from '../context/DataContext';
import { suiviFormation } from '../utils/suiviFormation';
import Ring from './Ring';

/** Un cours et le nombre de membres qui l'ont ouvert : le nom au-dessus,
 *  en entier (lisible sur téléphone), la barre et la valeur dessous. */
function BarreCours({ cours, total }) {
  const largeur = total ? Math.max(cours.apprenants ? 4 : 0, Math.round((cours.apprenants / total) * 100)) : 0;
  return (
    <div className="formation-barre-bloc" title={`${cours.titre} : ${cours.apprenants} membre(s) sur ${total} l’ont ouvert, ${cours.termines} l’ont terminé`}>
      <div className="formation-barre-nom">{cours.titre}</div>
      <div className="rating-bar-row formation-barre">
        <span className="rating-bar-track"><span className="rating-bar-fill" style={{ width: `${largeur}%`, background: 'var(--primary)' }} /></span>
        <span className="rating-bar-val formation-barre-val">{cours.apprenants}/{total}</span>
      </div>
    </div>
  );
}

/**
 * Tableau de bord du gérant : la formation de l'équipe en un coup d'œil —
 * qui s'est lancé, ce qui est terminé, les quiz, les cours les plus et les
 * moins suivis. Le détail (par personne, par quiz) est dans Plus → « Suivi
 * des formations ».
 */
export default function FormationEquipeCarte() {
  const { formations, formationProgress, team, teamChargee } = useData();
  const s = useMemo(
    () => suiviFormation({ formations, progression: formationProgress, membres: team }),
    [formations, formationProgress, team]
  );
  const { equipe, quiz } = s;
  if (!s.cours.length) return null;

  return (
    <div className="dash-row formation-equipe">
      <div className="card">
        <div className="dash-card-head">
          <span className="dash-dot dot-primary" />
          <span className="card-title">Formation de l’équipe</span>
          <Link to="/plus/suiviformation" className="dash-head-meta formation-lien">Détail <ChevronRight size={13} /></Link>
        </div>
        {!teamChargee ? (
          <p className="text-sm text-secondary">Chargement de l’équipe…</p>
        ) : equipe.total === 0 ? (
          <p className="text-sm text-secondary">Aucun membre dans l’équipe pour l’instant : invitez vos techniciens depuis Plus → Équipe.</p>
        ) : (
          <>
            <div className="formation-equipe-tete">
              <Ring value={equipe.pctCommence} color="var(--primary)" size={92} stroke={9}>
                <span className="ring-value">{equipe.pctCommence}%</span>
              </Ring>
              <div className="formation-equipe-texte">
                <strong>{equipe.ontCommence} sur {equipe.total}</strong> membre{equipe.total > 1 ? 's' : ''} {equipe.ontCommence > 1 ? 'ont' : 'a'} commencé l’Académie.
                {equipe.pasCommence > 0 && (
                  <span className="formation-equipe-relance">
                    {equipe.pasCommence} n’{equipe.pasCommence > 1 ? 'ont' : 'a'} pas encore commencé ({equipe.pctPasCommence}{'\u202f'}%).
                  </span>
                )}
              </div>
            </div>
            <div className="formation-chiffres">
              <div><span className="formation-chiffre">{equipe.actifsRecents}</span><span className="formation-chiffre-label">actif{equipe.actifsRecents > 1 ? 's' : ''} sur 30 jours</span></div>
              <div><span className="formation-chiffre">{equipe.modulesTermines}</span><span className="formation-chiffre-label">module{equipe.modulesTermines > 1 ? 's' : ''} terminé{equipe.modulesTermines > 1 ? 's' : ''}</span></div>
              <div><span className="formation-chiffre">{quiz.realises}</span><span className="formation-chiffre-label">quiz réalisé{quiz.realises > 1 ? 's' : ''}{quiz.scoreMoyen != null ? ` · moyenne ${quiz.scoreMoyen}\u202f%` : ''}</span></div>
              <div><span className="formation-chiffre">{equipe.ontTermineUnCours}</span><span className="formation-chiffre-label">ont terminé un cours</span></div>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="dash-card-head">
          <span className="dash-dot dot-accent" />
          <span className="card-title"><GraduationCap size={15} style={{ verticalAlign: -2, marginRight: 4 }} />Cours de l’Académie</span>
          <span className="dash-head-meta">membres qui l’ont ouvert</span>
        </div>
        <div className="formation-cours-titre">Les plus suivis</div>
        {s.plusSuivis.length
          ? s.plusSuivis.map((c) => <BarreCours key={c.id} cours={c} total={equipe.total} />)
          : <p className="text-sm text-secondary">Aucun cours ouvert pour l’instant.</p>}
        <div className="formation-cours-titre">Les moins suivis</div>
        {s.moinsSuivis.map((c) => <BarreCours key={c.id} cours={c} total={equipe.total} />)}
      </div>
    </div>
  );
}
