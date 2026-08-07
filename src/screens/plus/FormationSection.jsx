import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, Pencil, Check, PlayCircle, FileText, AlignLeft,
  Clock, ExternalLink, GraduationCap, CheckCircle2, Circle, BookOpen, Layers, Crown, Lock, EyeOff,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useMode } from '../../context/ModeContext';
import { toEmbed } from '../../utils/video';
import {
  allLecons, isLeconDone, courseProgress, resumeLecon, nextLecon, prevLecon,
  courseDuration, courseCounts, parseChaptersText, chaptersToText, formatTimecode,
  coursVisible, coursVerrouille,
} from '../../utils/formation';
import Sheet from '../../components/Sheet';
import Field from '../../components/Field';
import EmptyState from '../../components/EmptyState';
import DangerZone from '../../components/DangerZone';

const LECON_ICON = { video: PlayCircle, texte: AlignLeft, pdf: FileText };
const LECON_TYPE_LABEL = { video: 'Vidéo', texte: 'Lecture', pdf: 'Document' };
const EMPTY_COURSE = { title: '', description: '', author: '', acces: 'tous', masque: false };
const EMPTY_LECON = { title: '', type: 'video', url: '', content: '', duration: '', chaptersText: '' };

/** Contenu d'une leçon texte : paragraphes + listes (« - … »), sans dépendance. */
function TexteContent({ content }) {
  const blocks = String(content || '').split(/\n{2,}/);
  return (
    <div className="lecon-texte">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        const items = lines.filter((l) => l.startsWith('- '));
        const rest = lines.filter((l) => !l.startsWith('- ')).join(' ').trim();
        return (
          <div key={i}>
            {rest && <p>{rest}</p>}
            {items.length > 0 && <ul>{items.map((l, j) => <li key={j}>{l.slice(2)}</li>)}</ul>}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Espace formation façon « école » : catalogue de cours → programme (modules,
 * leçons cochées) → page de lecture avec navigation précédent / terminer & continuer.
 * Le gérant gère cours, modules et leçons directement dans chaque vue.
 */
export default function FormationSection({ onBack }) {
  const { user } = useAuth();
  const { proActive } = useMode();
  const {
    formations, formationProgress,
    addFormation, updateFormation, deleteFormation,
    addModule, updateModule, deleteModule,
    addLecon, updateLecon, deleteLecon, setLeconDone,
  } = useData();

  const isManager = user.role === 'gerant';
  const courses = formations || [];
  // Un cours `partage` appartient au catalogue de formation BestaSolar, reçu
  // en lecture : le gérant d'une autre entreprise le suit, mais ne le modifie
  // pas (le serveur refuserait l'écriture, et l'édition serait perdue au
  // rechargement). Ses propres cours, eux, restent pleinement modifiables.
  const peutGerer = (c) => isManager && !c?.partage;
  // Verrou Pro : un cours `acces: 'pro'` se voit mais ne s'ouvre pas sans
  // abonnement actif. Le gestionnaire du cours n'est jamais verrouillé.
  const verrouille = (c) => coursVerrouille(c, { proActif: proActive, gere: peutGerer(c) });

  const [courseId, setCourseId] = useState(null);
  const [leconId, setLeconId] = useState(null);
  const [mobileFocus, setMobileFocus] = useState(false); // mobile : contenu plein écran
  const [startAt, setStartAt] = useState(0); // démarrage vidéo (sommaire minuté)
  const [openModules, setOpenModules] = useState(new Set()); // modules dépliés

  // Formulaires gérant
  const [courseEdit, setCourseEdit] = useState(null); // null | 'new' | id
  const [courseForm, setCourseForm] = useState(EMPTY_COURSE);
  const [moduleEdit, setModuleEdit] = useState(null); // null | { id:'new'|id }
  const [moduleTitle, setModuleTitle] = useState('');
  const [leconEdit, setLeconEdit] = useState(null); // null | { moduleId, id:'new'|id }
  const [leconForm, setLeconForm] = useState(EMPTY_LECON);

  const course = courses.find((c) => c.id === courseId) || null;
  const lecons = useMemo(() => (course ? allLecons(course) : []), [course]);
  const lecon = lecons.find((l) => l.id === leconId) || null;
  const progress = course ? courseProgress(course, formationProgress, user.id) : null;

  const done = (id) => isLeconDone(formationProgress, user.id, id);

  const openCourse = (c) => {
    if (verrouille(c)) return; // bouton désactivé, mais on ne compte pas dessus
    setCourseId(c.id);
    const resume = resumeLecon(c, formationProgress, user.id);
    setLeconId(resume?.id || null);
    // Seul le module de la leçon en cours est déplié (comme sur systeme.io).
    setOpenModules(new Set(resume ? [resume.moduleId] : (c.modules[0] ? [c.modules[0].id] : [])));
    setMobileFocus(false);
  };
  const openLecon = (l) => { setLeconId(l.id); setMobileFocus(true); };
  const toggleModule = (id) =>
    setOpenModules((prev) => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });

  // Changement de leçon : repartir du début de la vidéo et déplier son module.
  useEffect(() => {
    setStartAt(0);
    if (lecon) setOpenModules((prev) => (prev.has(lecon.moduleId) ? prev : new Set([...prev, lecon.moduleId])));
  }, [leconId]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishAndNext = () => {
    setLeconDone(user.id, course.id, lecon.id, true);
    const next = nextLecon(course, lecon.id);
    if (next) setLeconId(next.id);
  };

  // ---------- Gérant : formulaires ----------
  const saveCourse = (e) => {
    e.preventDefault();
    const data = {
      title: courseForm.title.trim(),
      description: courseForm.description.trim(),
      author: courseForm.author.trim(),
      acces: courseForm.acces === 'pro' ? 'pro' : 'tous',
      masque: !!courseForm.masque,
    };
    if (!data.title) return;
    if (courseEdit === 'new') addFormation(data);
    else updateFormation(courseEdit, data);
    setCourseEdit(null);
  };
  // Suppressions : la confirmation est portée par <DangerZone> dans chaque panneau.
  const removeCourse = () => {
    deleteFormation(courseEdit);
    setCourseEdit(null);
    if (courseId === courseEdit) { setCourseId(null); setLeconId(null); }
  };

  const saveModule = (e) => {
    e.preventDefault();
    const title = moduleTitle.trim();
    if (!title) return;
    if (moduleEdit.id === 'new') addModule(course.id, { title });
    else updateModule(course.id, moduleEdit.id, { title });
    setModuleEdit(null);
  };
  const removeModule = () => {
    deleteModule(course.id, moduleEdit.id);
    setModuleEdit(null);
    setLeconId(null);
  };

  const saveLecon = (e) => {
    e.preventDefault();
    const data = {
      title: leconForm.title.trim(),
      type: leconForm.type,
      duration: leconForm.duration.trim(),
      url: leconForm.type === 'texte' ? '' : leconForm.url.trim(),
      content: leconForm.type === 'texte' ? leconForm.content : '',
      chapters: leconForm.type === 'video' ? parseChaptersText(leconForm.chaptersText) : [],
    };
    if (!data.title) return;
    if (leconEdit.id === 'new') addLecon(course.id, leconEdit.moduleId, data);
    else updateLecon(course.id, leconEdit.moduleId, leconEdit.id, data);
    setLeconEdit(null);
  };
  const removeLecon = () => {
    deleteLecon(course.id, leconEdit.moduleId, leconEdit.id);
    if (leconId === leconEdit.id) setLeconId(null);
    setLeconEdit(null);
  };

  // ================= Vue catalogue =================
  if (!course) {
    // Cours masqués : visibles de leurs seuls gestionnaires (brouillons).
    const visibles = courses.filter((c) => coursVisible(c, peutGerer(c)));
    // La jauge globale ne compte que les cours réellement ouvrables : un cours
    // verrouillé (Pro) ou masqué ne doit pas plomber la progression affichée.
    const ouvrables = visibles.filter((c) => !verrouille(c));
    const totalDone = ouvrables.reduce((s, c) => s + courseProgress(c, formationProgress, user.id).done, 0);
    const totalLecons = ouvrables.reduce((s, c) => s + allLecons(c).length, 0);
    return (
      <>
        <div className="partners-toolbar">
          <button className="btn btn-outline btn-sm back-button back-to-plus" onClick={onBack}>
            <ChevronLeft size={16} /> Retour
          </button>
          {isManager && (
            <button className="btn btn-accent btn-sm" onClick={() => { setCourseForm(EMPTY_COURSE); setCourseEdit('new'); }}>
              <Plus size={16} /> Nouveau cours
            </button>
          )}
        </div>
        <div className="section-title">Formation</div>

        <div className="formation-progress card">
          <div className="formation-progress-icon"><GraduationCap size={22} /></div>
          <div className="formation-progress-info">
            <div className="formation-progress-title">{totalDone} / {totalLecons} leçons terminées</div>
            <div className="funnel-track">
              <div className="funnel-bar" style={{ width: `${totalLecons ? (totalDone / totalLecons) * 100 : 0}%`, background: 'var(--success)' }} />
            </div>
          </div>
        </div>

        <div className="course-grid">
          {visibles.map((c) => {
            const p = courseProgress(c, formationProgress, user.id);
            const counts = courseCounts(c);
            const duration = courseDuration(c);
            const verrou = verrouille(c);
            return (
              <div key={c.id} className="card course-card">
                <div className="course-card-cover">
                  <BookOpen size={36} strokeWidth={1.6} />
                  {duration && <span className="course-cover-duration"><Clock size={12} /> {duration}</span>}
                  {peutGerer(c) && (
                    <button className="course-cover-edit" aria-label="Modifier le cours"
                      onClick={() => { setCourseForm({ title: c.title, description: c.description || '', author: c.author || '', acces: c.acces === 'pro' ? 'pro' : 'tous', masque: !!c.masque }); setCourseEdit(c.id); }}>
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
                <div className="course-card-body">
                  <div className="course-card-title">{c.title}</div>
                  {c.author && <div className="course-card-author">Par {c.author}</div>}
                  {c.description && <p className="formation-desc">{c.description}</p>}
                  <div className="course-card-meta">
                    <span><Layers size={13} /> {counts.modules} module{counts.modules > 1 ? 's' : ''}</span>
                    <span><PlayCircle size={13} /> {counts.lecons} leçon{counts.lecons > 1 ? 's' : ''}</span>
                    {/* Cours du catalogue BestaSolar : suivi ici, entretenu
                        là-bas. Sans repère, l'absence de bouton « modifier »
                        passerait pour une panne. */}
                    {c.partage && <span className="flat-badge">Catalogue BestaSolar</span>}
                    {c.acces === 'pro' && <span className="flat-badge badge-cours-pro"><Crown size={11} /> Pro</span>}
                    {/* Badge réservé au gestionnaire : les autres ne voient
                        simplement pas le cours. */}
                    {c.masque && <span className="flat-badge badge-cours-masque"><EyeOff size={11} /> Masqué</span>}
                  </div>
                  <div className="course-card-progress">
                    <div className="funnel-track">
                      <div className="funnel-bar" style={{ width: `${p.pct}%`, background: p.pct === 100 ? 'var(--success)' : 'var(--accent)' }} />
                    </div>
                    <span className="course-card-pct">{p.pct}%</span>
                  </div>
                  {verrou ? (
                    <button className="btn btn-outline btn-block" disabled>
                      <Lock size={15} /> Réservé aux membres Pro
                    </button>
                  ) : (
                    <button className="btn btn-primary btn-block" onClick={() => openCourse(c)} disabled={!counts.lecons}>
                      {p.pct === 100 ? 'Revoir le cours' : p.done > 0 ? 'Continuer' : 'Commencer'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {visibles.length === 0 && <EmptyState card>Aucun cours pour le moment.</EmptyState>}
        </div>

        <CourseFormSheet open={!!courseEdit} isNew={courseEdit === 'new'} form={courseForm} setForm={setCourseForm}
          onClose={() => setCourseEdit(null)} onSubmit={saveCourse} onDelete={removeCourse} />
      </>
    );
  }

  // ================= Vue cours (programme + lecture) =================
  const embed = lecon?.type === 'video' && lecon.url ? toEmbed(lecon.url, startAt) : null;
  const prev = lecon ? prevLecon(course, lecon.id) : null;
  const next = lecon ? nextLecon(course, lecon.id) : null;
  const courseFini = progress.total > 0 && progress.done === progress.total;
  const gereCeCours = peutGerer(course);

  return (
    <>
      <div className="partners-toolbar">
        <button className="btn btn-outline btn-sm back-button"
          onClick={() => (mobileFocus ? setMobileFocus(false) : (setCourseId(null), setLeconId(null)))}>
          <ChevronLeft size={16} /> {mobileFocus ? 'Programme du cours' : 'Tous les cours'}
        </button>
      </div>

      <div className="course-head">
        <div className="course-head-title">{course.title}</div>
        {course.author && <div className="course-head-author">Par {course.author}</div>}
        <div className="course-head-progress">
          <div className="funnel-track">
            <div className="funnel-bar" style={{ width: `${progress.pct}%`, background: progress.pct === 100 ? 'var(--success)' : 'var(--accent)' }} />
          </div>
          <span>{progress.done}/{progress.total} · {progress.pct}%</span>
        </div>
      </div>

      <div className={`school-layout ${mobileFocus ? 'focus-content' : ''}`}>
        {/* Programme (modules + leçons) */}
        <aside className="school-side">
          {(course.modules || []).map((m, mi) => {
            const done_m = (m.lecons || []).filter((l) => done(l.id)).length;
            const ouvert = openModules.has(m.id);
            return (
            <div key={m.id} className={`school-module ${ouvert ? '' : 'closed'}`}>
              <div className="school-module-head" role="button" tabIndex={0}
                onClick={() => toggleModule(m.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleModule(m.id); } }}>
                <span className="school-module-label">Module {mi + 1}</span>
                <span className="school-module-title">{m.title}</span>
                <span className="school-module-count">{done_m}/{(m.lecons || []).length}</span>
                {gereCeCours && (
                  <button className="school-edit-btn" aria-label="Modifier le module"
                    onClick={(e) => { e.stopPropagation(); setModuleTitle(m.title); setModuleEdit({ id: m.id }); }}>
                    <Pencil size={13} />
                  </button>
                )}
                <ChevronDown size={15} className={`school-module-chevron ${ouvert ? 'open' : ''}`} />
              </div>
              {ouvert && (m.lecons || []).map((l) => {
                const Icon = LECON_ICON[l.type] || PlayCircle;
                const active = l.id === leconId;
                return (
                  <div key={l.id} className={`school-lecon ${active ? 'active' : ''} ${done(l.id) ? 'done' : ''}`}
                    role="button" tabIndex={0} onClick={() => openLecon(l)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLecon(l); } }}>
                    {done(l.id) ? <CheckCircle2 size={17} className="school-lecon-check ok" /> : <Circle size={17} className="school-lecon-check" />}
                    <span className="school-lecon-title">{l.title}</span>
                    <span className="school-lecon-meta"><Icon size={13} /> {LECON_TYPE_LABEL[l.type] || 'Leçon'}{l.duration ? ` · ${l.duration}` : ''}</span>
                    {gereCeCours && (
                      <button className="school-edit-btn" aria-label="Modifier la leçon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLeconForm({ title: l.title, type: l.type || 'video', url: l.url || '', content: l.content || '', duration: l.duration || '', chaptersText: chaptersToText(l.chapters || []) });
                          setLeconEdit({ moduleId: m.id, id: l.id });
                        }}>
                        <Pencil size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
              {ouvert && gereCeCours && (
                <button className="school-add-lecon" onClick={() => { setLeconForm(EMPTY_LECON); setLeconEdit({ moduleId: m.id, id: 'new' }); }}>
                  <Plus size={14} /> Ajouter une leçon
                </button>
              )}
            </div>
            );
          })}
          {gereCeCours && (
            <button className="btn btn-outline btn-sm btn-block" onClick={() => { setModuleTitle(''); setModuleEdit({ id: 'new' }); }}>
              <Plus size={15} /> Ajouter un module
            </button>
          )}
        </aside>

        {/* Contenu de la leçon */}
        <div className="school-main">
          {lecon ? (
            <div className="card school-content">
              <div className="school-content-top">
                <div className="school-content-kicker">{lecon.moduleTitle} · {LECON_TYPE_LABEL[lecon.type] || 'Leçon'}{lecon.duration ? ` · ${lecon.duration}` : ''}</div>
                <div className="lesson-topnav">
                  <button className="btn btn-sm btn-outline" disabled={!prev} onClick={() => prev && setLeconId(prev.id)} aria-label="Leçon précédente"><ChevronLeft size={15} /></button>
                  <button className="btn btn-sm btn-outline" disabled={!next} onClick={() => next && setLeconId(next.id)} aria-label="Leçon suivante"><ChevronRight size={15} /></button>
                </div>
              </div>
              <h2 className="school-content-title">{lecon.title}</h2>

              {lecon.type === 'video' && embed && (
                <div className="video-embed">
                  {embed.kind === 'iframe' ? (
                    <iframe key={`${lecon.id}:${startAt}`} src={embed.src} title={lecon.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                      allowFullScreen />
                  ) : (
                    <video key={`${lecon.id}:${startAt}`} src={embed.src} controls playsInline
                      onLoadedMetadata={(e) => { if (embed.start) e.currentTarget.currentTime = embed.start; }} />
                  )}
                </div>
              )}
              {lecon.type === 'video' && embed && (lecon.chapters || []).length > 0 && (
                <div className="video-chapters">
                  <div className="video-chapters-title"><Clock size={14} /> Sommaire de la vidéo</div>
                  {lecon.chapters.map((c) => (
                    <button key={c.t} type="button" className={`video-chapter ${startAt === c.t ? 'active' : ''}`} onClick={() => setStartAt(c.t)}>
                      <span className="video-chapter-time">{formatTimecode(c.t)}</span>
                      <span className="video-chapter-label">{c.label}</span>
                      <PlayCircle size={14} className="video-chapter-play" />
                    </button>
                  ))}
                </div>
              )}
              {lecon.type === 'video' && !embed && lecon.url && (
                <a className="btn btn-outline" href={lecon.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={15} /> Ouvrir la vidéo
                </a>
              )}
              {lecon.type === 'texte' && <TexteContent content={lecon.content} />}
              {lecon.type === 'pdf' && lecon.url && (
                <a className="btn btn-outline" href={lecon.url} target="_blank" rel="noopener noreferrer">
                  <FileText size={15} /> Ouvrir le document
                </a>
              )}

              <div className="lesson-nav">
                <button className="btn btn-outline" disabled={!prev} onClick={() => prev && setLeconId(prev.id)}>
                  <ChevronLeft size={15} /> Précédent
                </button>
                {!done(lecon.id) ? (
                  <button className="btn btn-primary lesson-nav-main" onClick={finishAndNext}>
                    <Check size={16} /> {next ? 'Terminer et continuer' : 'Terminer la leçon'}
                  </button>
                ) : next ? (
                  <button className="btn btn-primary lesson-nav-main" onClick={() => setLeconId(next.id)}>
                    Leçon suivante <ChevronRight size={15} />
                  </button>
                ) : (
                  <button className="btn btn-outline lesson-nav-main" onClick={() => setLeconDone(user.id, course.id, lecon.id, false)}>
                    Marquer non terminée
                  </button>
                )}
              </div>
              {courseFini && (
                <div className="course-finished">
                  <CheckCircle2 size={18} /> Félicitations, vous avez terminé ce cours !
                </div>
              )}
            </div>
          ) : (
            <EmptyState card>Choisissez une leçon dans le programme{gereCeCours ? ' — ou ajoutez un module pour commencer.' : '.'}</EmptyState>
          )}
        </div>
      </div>

      {/* Formulaire module */}
      <Sheet open={!!moduleEdit} onClose={() => setModuleEdit(null)} title={moduleEdit?.id === 'new' ? 'Nouveau module' : 'Modifier le module'}>
        <form onSubmit={saveModule}>
          <Field label="Titre du module *">
            <input className="input" required value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} placeholder="Ex : Dimensionner une installation" />
          </Field>
          <button type="submit" className="btn btn-primary btn-block"><Check size={17} /> Enregistrer</button>
        </form>
        {moduleEdit?.id !== 'new' && (
          <DangerZone
            label="Supprimer le module"
            message="Le module et toutes ses leçons seront supprimés."
            onConfirm={removeModule}
          />
        )}
      </Sheet>

      {/* Formulaire leçon */}
      <Sheet open={!!leconEdit} onClose={() => setLeconEdit(null)} title={leconEdit?.id === 'new' ? 'Nouvelle leçon' : 'Modifier la leçon'}>
        <form onSubmit={saveLecon}>
          <Field label="Titre *">
            <input className="input" required value={leconForm.title} onChange={(e) => setLeconForm({ ...leconForm, title: e.target.value })} placeholder="Ex : Choisir l'onduleur" />
          </Field>
          <div className="form-row-2">
            <Field label="Type">
              <select className="input" value={leconForm.type} onChange={(e) => setLeconForm({ ...leconForm, type: e.target.value })}>
                <option value="video">Vidéo</option>
                <option value="texte">Texte (dans l'app)</option>
                <option value="pdf">Document PDF</option>
              </select>
            </Field>
            <Field label="Durée">
              <input className="input" value={leconForm.duration} onChange={(e) => setLeconForm({ ...leconForm, duration: e.target.value })} placeholder="Ex : 12 min" />
            </Field>
          </div>
          {leconForm.type === 'video' && (
            <Field label="Sommaire minuté (facultatif)">
              <textarea className="input" rows="4" value={leconForm.chaptersText}
                onChange={(e) => setLeconForm({ ...leconForm, chaptersText: e.target.value })}
                placeholder={'00:00 Introduction\n01:32 Récupérer ses emails\n02:51 Changer ses DNS'} />
              <div className="field-hint">Une ligne par chapitre : « mm:ss Titre ». Cliquer un chapitre lance la vidéo à cet instant.</div>
            </Field>
          )}
          {leconForm.type === 'texte' ? (
            <Field label="Contenu de la leçon *">
              <textarea className="input" rows="8" required value={leconForm.content}
                onChange={(e) => setLeconForm({ ...leconForm, content: e.target.value })}
                placeholder={'Paragraphes séparés par une ligne vide.\nListes avec « - » en début de ligne.'} />
            </Field>
          ) : (
            <Field label="Lien (YouTube, Vimeo, mp4, PDF…) *">
              <input className="input" type="url" required value={leconForm.url} onChange={(e) => setLeconForm({ ...leconForm, url: e.target.value })} placeholder="https://…" />
              <div className="field-hint">Les vidéos YouTube/Vimeo se lisent directement dans l'application.</div>
            </Field>
          )}
          <button type="submit" className="btn btn-primary btn-block"><Check size={17} /> Enregistrer</button>
        </form>
        {leconEdit?.id !== 'new' && (
          <DangerZone
            label="Supprimer la leçon"
            message="La leçon et la progression associée seront supprimées."
            onConfirm={removeLecon}
          />
        )}
      </Sheet>

      <CourseFormSheet open={!!courseEdit} isNew={courseEdit === 'new'} form={courseForm} setForm={setCourseForm}
        onClose={() => setCourseEdit(null)} onSubmit={saveCourse} onDelete={removeCourse} />
    </>
  );
}

/** Formulaire cours (création / édition) — partagé entre catalogue et vue cours. */
function CourseFormSheet({ open, isNew, form, setForm, onClose, onSubmit, onDelete }) {
  return (
    <Sheet open={open} onClose={onClose} title={isNew ? 'Nouveau cours' : 'Modifier le cours'}>
      <form onSubmit={onSubmit}>
        <Field label="Titre du cours *">
          <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex : Devenir installateur solaire" />
        </Field>
        <Field label="Formateur / auteur">
          <input className="input" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Ex : Siddo Boubacar" />
        </Field>
        <Field label="Description">
          <textarea className="input" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="form-row-2">
          <Field label="Accès">
            <select className="input" value={form.acces === 'pro' ? 'pro' : 'tous'} onChange={(e) => setForm({ ...form, acces: e.target.value })}>
              <option value="tous">Tous les membres</option>
              <option value="pro">Membres Pro uniquement</option>
            </select>
          </Field>
          <Field label="Visibilité">
            <select className="input" value={form.masque ? 'masque' : 'visible'} onChange={(e) => setForm({ ...form, masque: e.target.value === 'masque' })}>
              <option value="visible">Visible</option>
              <option value="masque">Masqué (brouillon)</option>
            </select>
          </Field>
        </div>
        <div className="field-hint">
          « Membres Pro uniquement » : les autres voient la carte du cours, verrouillée, avec la mention
          Réservé aux membres Pro. « Masqué » : le cours n'apparaît que pour vous — la progression des
          membres est conservée si vous le réaffichez plus tard.
        </div>
        <button type="submit" className="btn btn-primary btn-block"><Check size={17} /> Enregistrer</button>
      </form>
      {!isNew && (
        <DangerZone
          label="Supprimer le cours"
          message="Le cours, ses modules et ses leçons seront supprimés."
          onConfirm={onDelete}
        />
      )}
    </Sheet>
  );
}
