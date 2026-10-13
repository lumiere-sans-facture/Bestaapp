import { useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw, ListChecks } from 'lucide-react';
import { corrigerQuiz } from '../../utils/formation';

/**
 * Leçon « quiz » : des QCM corrigés automatiquement.
 *
 * L'apprenant coche une réponse par question, puis « Vérifier mes réponses ».
 * Chaque question montre alors la bonne réponse et son explication — c'est
 * elle qui apprend quelque chose, le score seul ne dit rien. La leçon ne se
 * termine qu'une fois le quiz vérifié (`onVerifie`), réussi ou non : on
 * apprend aussi de ses erreurs, et bloquer sur un score enfermerait
 * l'apprenant dans le cours.
 *
 * Le composant est remonté à chaque leçon (clé = id de la leçon) : les
 * réponses d'un quiz ne débordent jamais sur le suivant.
 */
export default function QuizLecon({ questions = [], onVerifie }) {
  const [reponses, setReponses] = useState({});
  const [verifie, setVerifie] = useState(false);
  const correction = corrigerQuiz(questions, reponses);
  const parId = new Map(correction.resultats.map((r) => [r.id, r]));

  const choisir = (qid, i) => { if (!verifie) setReponses((r) => ({ ...r, [qid]: i })); };
  const verifier = () => { setVerifie(true); onVerifie?.(correction); };
  const recommencer = () => { setReponses({}); setVerifie(false); };

  if (!questions.length) return <p className="quiz-vide">Ce quiz ne contient pas encore de question.</p>;

  return (
    <div className="quiz">
      {questions.map((q, n) => {
        const r = parId.get(q.id);
        return (
          <fieldset key={q.id} className="quiz-question">
            <legend className="quiz-enonce"><span className="quiz-numero">{n + 1}</span>{q.question}</legend>
            <div className="quiz-choix-liste">
              {q.choix.map((choix, i) => {
                const choisi = reponses[q.id] === i;
                const etat = !verifie ? (choisi ? 'is-choisi' : '')
                  : i === q.bonne ? 'is-juste' : choisi ? 'is-faux' : 'is-eteint';
                return (
                  <button key={i} type="button" className={`quiz-choix ${etat}`}
                    aria-pressed={choisi} disabled={verifie} onClick={() => choisir(q.id, i)}>
                    <span className="quiz-choix-puce" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
                    <span className="quiz-choix-texte">{choix}</span>
                    {verifie && i === q.bonne && <CheckCircle2 size={17} className="quiz-choix-icone" aria-label="Bonne réponse" />}
                    {verifie && choisi && i !== q.bonne && <XCircle size={17} className="quiz-choix-icone" aria-label="Votre réponse" />}
                  </button>
                );
              })}
            </div>
            {verifie && (
              <div className={`quiz-explication ${r?.juste ? 'is-juste' : 'is-faux'}`} role="status">
                <strong>{r?.juste ? 'Bonne réponse. ' : 'Pas tout à fait. '}</strong>{q.explication}
              </div>
            )}
          </fieldset>
        );
      })}

      {verifie ? (
        <div className="quiz-bilan" role="status">
          <div className="quiz-score">
            <ListChecks size={18} /> {correction.score} / {correction.total} bonne{correction.score > 1 ? 's' : ''} réponse{correction.score > 1 ? 's' : ''}
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={recommencer}>
            <RotateCcw size={15} /> Recommencer le quiz
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-accent btn-block quiz-verifier" onClick={verifier} disabled={!correction.complet}>
          <ListChecks size={17} /> {correction.complet
            ? 'Vérifier mes réponses'
            : `Répondez à toutes les questions (${correction.resultats.filter((x) => x.choisie != null).length}/${correction.total})`}
        </button>
      )}
    </div>
  );
}
