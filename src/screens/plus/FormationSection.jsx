import { useState } from 'react';
import { ChevronLeft, Plus, Pencil, Check, PlayCircle, FileText, Clock, ExternalLink, Trash2, GraduationCap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { toEmbed } from '../../utils/video';
import Sheet from '../../components/Sheet';

const EMPTY_FORM = { title: '', description: '', type: 'video', url: '', duration: '' };

export default function FormationSection({ onBack }) {
  const { user } = useAuth();
  const {
    formations, formationProgress,
    addFormation, updateFormation, deleteFormation, setFormationProgress,
  } = useData();
  // null = fermé, 'new' = création, sinon id du module en édition
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  // Lecteur intégré : module en cours de visionnage
  const [watching, setWatching] = useState(null);

  const isManager = user.role === 'gerant';

  const progressFor = (formationId) =>
    (formationProgress || []).find((p) => p.userId === user.id && p.formationId === formationId)?.status || null;

  const completedCount = (formations || []).filter((f) => progressFor(f.id) === 'complete').length;

  const openModule = (formation) => {
    if (!progressFor(formation.id)) setFormationProgress(user.id, formation.id, 'en_cours');
    // Vidéos YouTube/Vimeo/mp4 : lecture directement dans l'app.
    // Seuls les documents (PDF…) s'ouvrent à l'extérieur.
    if (formation.type !== 'pdf' && toEmbed(formation.url)) {
      setWatching(formation);
    } else {
      window.open(formation.url, '_blank', 'noopener');
    }
  };

  const watchingEmbed = watching ? toEmbed(watching.url) : null;

  const openNew = () => { setForm(EMPTY_FORM); setEditing('new'); };
  const openEdit = (f) => {
    setForm({ title: f.title, description: f.description, type: f.type, url: f.url, duration: f.duration });
    setEditing(f.id);
  };

  const handleSave = (e) => {
    e.preventDefault();
    const data = {
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      url: form.url.trim(),
      duration: form.duration.trim(),
    };
    if (editing === 'new') addFormation(data);
    else updateFormation(editing, data);
    setEditing(null);
  };

  const handleDelete = () => {
    if (window.confirm('Supprimer ce module de formation ?')) {
      deleteFormation(editing);
      setEditing(null);
    }
  };

  return (
    <>
      <div className="partners-toolbar">
        <button className="btn btn-outline btn-sm back-button" onClick={onBack}>
          <ChevronLeft size={16} /> Retour
        </button>
        {isManager && (
          <button className="btn btn-accent btn-sm" onClick={openNew}>
            <Plus size={16} /> Ajouter un module
          </button>
        )}
      </div>
      <div className="section-title">Formation</div>

      <div className="formation-progress card">
        <div className="formation-progress-icon"><GraduationCap size={22} /></div>
        <div className="formation-progress-info">
          <div className="formation-progress-title">{completedCount} / {(formations || []).length} modules complétés</div>
          <div className="funnel-track">
            <div className="funnel-bar" style={{ width: `${(formations || []).length ? (completedCount / formations.length) * 100 : 0}%`, background: 'var(--success)' }} />
          </div>
        </div>
      </div>

      <div className="commissions-list">
        {(formations || []).map((f) => {
          const status = progressFor(f.id);
          return (
            <div key={f.id} className={`card formation-card ${status === 'complete' ? 'formation-done' : ''}`}>
              <div className="formation-header">
                <div className={`formation-type-icon ${f.type}`}>
                  {f.type === 'pdf' ? <FileText size={18} /> : <PlayCircle size={18} />}
                </div>
                <div className="formation-info">
                  <div className="formation-title">{f.title}</div>
                  <div className="formation-meta">
                    <Clock size={12} /> {f.duration} · {f.type === 'pdf' ? 'Document' : 'Vidéo'}
                    {status && (
                      <span className={`badge ${status === 'complete' ? 'badge-success' : 'badge-warning'}`}>
                        {status === 'complete' ? 'Complété ✓' : 'En cours'}
                      </span>
                    )}
                  </div>
                </div>
                {isManager && (
                  <button className="sheet-close" onClick={() => openEdit(f)} aria-label="Modifier le module">
                    <Pencil size={16} />
                  </button>
                )}
              </div>
              <p className="formation-desc">{f.description}</p>
              <div className="cart-actions">
                <button className="btn btn-primary btn-block" onClick={() => openModule(f)}>
                  {f.type !== 'pdf' && toEmbed(f.url) ? <PlayCircle size={15} /> : <ExternalLink size={15} />}
                  {' '}{status ? 'Reprendre' : 'Commencer'}
                </button>
                {status !== 'complete' ? (
                  <button className="btn btn-won btn-block" onClick={() => setFormationProgress(user.id, f.id, 'complete')}>
                    <Check size={15} /> Marquer terminé
                  </button>
                ) : (
                  <button className="btn btn-outline" onClick={() => setFormationProgress(user.id, f.id, 'en_cours')}>
                    Revoir
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {(formations || []).length === 0 && (
          <div className="empty-state card">Aucun module de formation pour le moment.</div>
        )}
      </div>

      {/* Lecteur vidéo intégré : la vidéo se regarde sans quitter l'app */}
      <Sheet
        open={!!watching}
        onClose={() => setWatching(null)}
        title={watching?.title}
        subtitle={watching?.duration ? `Durée : ${watching.duration}` : undefined}
      >
        {watchingEmbed && (
          <>
            <div className="video-embed">
              {watchingEmbed.kind === 'iframe' ? (
                <iframe
                  src={watchingEmbed.src}
                  title={watching.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                  allowFullScreen
                />
              ) : (
                <video src={watchingEmbed.src} controls autoPlay playsInline />
              )}
            </div>
            {watching.description && <p className="formation-desc video-desc">{watching.description}</p>}
            <div className="cart-actions">
              {progressFor(watching.id) !== 'complete' ? (
                <button
                  className="btn btn-won btn-block"
                  onClick={() => { setFormationProgress(user.id, watching.id, 'complete'); setWatching(null); }}
                >
                  <Check size={15} /> Marquer terminé
                </button>
              ) : (
                <button className="btn btn-outline btn-block" onClick={() => setWatching(null)}>
                  Fermer
                </button>
              )}
            </div>
          </>
        )}
      </Sheet>

      {/* Gestion des modules (gérant) */}
      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nouveau module' : 'Modifier le module'}
      >
        <form onSubmit={handleSave}>
          <div className="input-group">
            <label className="input-label">Titre *</label>
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex : Installer un kit 5 kWh" />
          </div>
          <div className="input-group">
            <label className="input-label">Description</label>
            <textarea className="input" rows="2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-row-2">
            <div className="input-group">
              <label className="input-label">Type</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="video">Vidéo</option>
                <option value="pdf">Document PDF</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Durée</label>
              <input className="input" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="Ex : 20 min" />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Lien (YouTube, Vimeo, mp4, PDF…) *</label>
            <input className="input" type="url" required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
            <div className="field-hint">Les vidéos YouTube/Vimeo se lisent directement dans l'application.</div>
          </div>
          <button type="submit" className="btn btn-primary btn-block">
            <Check size={18} /> {editing === 'new' ? 'Ajouter le module' : 'Enregistrer'}
          </button>
          {editing !== 'new' && (
            <button type="button" className="btn btn-lost btn-block delete-product-btn" onClick={handleDelete}>
              <Trash2 size={16} /> Supprimer ce module
            </button>
          )}
        </form>
      </Sheet>
    </>
  );
}
