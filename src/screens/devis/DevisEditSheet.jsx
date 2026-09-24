import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, MoreVertical, Plus, Save } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { TVA_RATE } from '../../config/company';
import { computeFactureTotals } from '../../utils/facture';
import { cleanQuoteLines, moveQuoteLine, normalizeQuoteLine, quoteLineId } from '../../utils/quoteLines';
import { dateEmissionDevis, depuisChampDate, problemeDateEmission, versChampDate } from '../../utils/dateEmission';
import { formatDate } from '../../utils/format';
import Sheet from '../../components/Sheet';
import Field from '../../components/Field';
import ConfirmSheet from '../../components/ConfirmSheet';
import QuoteLineForm from '../../components/quote/QuoteLineForm';
import QuoteLineItem from '../../components/quote/QuoteLineItem';
import QuoteTotals from '../../components/quote/QuoteTotals';

const emptyLine = (taxRate = 0) => ({
  id: quoteLineId(), designation: '', itemType: 'bien', qty: 1, unit: 'pcs', pu: 0, taxRate,
});

/** Éditeur mobile commun aux devis publics et Pro. L'ordre du tableau
 * `lignes` est déjà celui utilisé par les PDF : aucune migration n'est utile. */
export default function DevisEditSheet({ open, onClose, devis, editableClient = false, withTva = false }) {
  const { products, updateDevis } = useData();
  const [lignes, setLignes] = useState([]);
  const lignesRef = useRef([]);
  const [chargement, setChargement] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveState, setSaveState] = useState('');
  const [saveError, setSaveError] = useState('');
  const pendingSave = useRef(null);
  const [lineForm, setLineForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [client, setClient] = useState({ clientName: '', clientPhone: '', clientVille: '' });
  const [clientOpen, setClientOpen] = useState(false);
  // Date d'émission : celle imprimée sur le devis et dont part sa validité.
  const [dateOpen, setDateOpen] = useState(false);
  const [dateSaisie, setDateSaisie] = useState('');
  const [dateEnregistree, setDateEnregistree] = useState(null);
  const [dateErreur, setDateErreur] = useState('');
  const dragRef = useRef({ index: null, changed: false, original: null });

  const currency = devis?.currency || 'XOF';
  const hasTax = withTva && lignes.some((line) => Number(line.taxRate) > 0);
  const totals = computeFactureTotals(lignes, hasTax);

  useEffect(() => { lignesRef.current = lignes; }, [lignes]);

  useEffect(() => {
    if (!open || !devis) return;
    setClient({ clientName: devis.clientName || '', clientPhone: devis.clientPhone || '', clientVille: devis.clientVille || '' });
    setNote(devis.noteBasPage || '');
    setDateEnregistree(dateEmissionDevis(devis));
    setDateSaisie(versChampDate(dateEmissionDevis(devis)));
    setDateOpen(false);
    setDateErreur('');
    setSaveError('');
    setSaveState('');
    setLineForm(null);
    setChargement(true);
    import('../../utils/proDocPdf').then(({ devisToLignes }) => {
      const taxRate = withTva && devis.tvaActive ? TVA_RATE : 0;
      const next = devisToLignes(devis, products).map((line) => normalizeQuoteLine(line, { defaultTaxRate: taxRate }));
      setLignes(next);
      lignesRef.current = next;
    }).catch(() => setSaveError('Impossible de charger les lignes du devis.')).finally(() => setChargement(false));
  }, [open, devis, products, withTva]);

  const buildPatch = (nextLines, extra = {}) => {
    const cleaned = cleanQuoteLines(nextLines);
    const tvaActive = withTva && cleaned.some((line) => Number(line.taxRate) > 0);
    const nextTotals = computeFactureTotals(cleaned, tvaActive);
    return {
      lignes: cleaned,
      edited: true,
      subtotal: nextTotals.totalHT,
      tva: nextTotals.tva,
      tvaActive,
      total: nextTotals.totalTTC,
      ...extra,
    };
  };

  const persist = async (nextLines, extra = {}) => {
    if (savingRef.current) return false;
    const patch = buildPatch(nextLines, extra);
    pendingSave.current = { nextLines, extra };
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      await Promise.resolve(updateDevis(devis.id, patch));
      setLignes(patch.lignes);
      lignesRef.current = patch.lignes;
      setSaveState('Enregistré');
      pendingSave.current = null;
      return true;
    } catch {
      setSaveError('La modification n’a pas pu être enregistrée.');
      setSaveState('');
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const retry = () => pendingSave.current && persist(pendingSave.current.nextLines, pendingSave.current.extra);
  const openCreate = () => setLineForm({ mode: 'create', index: null, value: emptyLine(hasTax ? TVA_RATE : 0) });
  const openEdit = (index) => setLineForm({ mode: 'edit', index, value: { ...lignes[index] } });
  const submitLine = async () => {
    const next = lineForm.mode === 'edit'
      ? lignes.map((line, index) => (index === lineForm.index ? lineForm.value : line))
      : [...lignes, lineForm.value];
    if (await persist(next)) setLineForm(null);
  };

  const deleteLine = async () => {
    const next = lignes.filter((_, index) => index !== confirmDelete);
    setConfirmDelete(null);
    await persist(next);
  };

  const reorder = (from, to) => {
    if (from === to) return;
    setLignes((current) => {
      const next = moveQuoteLine(current, from, to);
      lignesRef.current = next;
      return next;
    });
    dragRef.current = { ...dragRef.current, index: to, changed: true };
  };
  const finishReorder = async () => {
    const { changed, original } = dragRef.current;
    dragRef.current = { index: null, changed: false, original: null };
    if (changed && !(await persist(lignesRef.current)) && original) {
      setLignes(original);
      lignesRef.current = original;
    }
  };
  const onDragStart = (event, index) => {
    dragRef.current = { index, changed: false, original: [...lignesRef.current] };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  };
  const onDragEnter = (_event, index) => {
    if (dragRef.current.index != null) reorder(dragRef.current.index, index);
  };
  const onPointerDown = (event, index) => {
    dragRef.current = { index, changed: false, original: [...lignesRef.current] };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (dragRef.current.index == null || !event.currentTarget.hasPointerCapture?.(event.pointerId)) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-quote-line-index]');
    const index = Number(target?.dataset?.quoteLineIndex);
    if (Number.isInteger(index) && index !== dragRef.current.index) reorder(dragRef.current.index, index);
  };

  const saveNote = async () => {
    if (await persist(lignes, { noteBasPage: note.trim() })) setNoteOpen(false);
  };
  const saveDate = async () => {
    const probleme = problemeDateEmission(dateSaisie);
    if (probleme) { setDateErreur(probleme); return; }
    const dateEmission = depuisChampDate(dateSaisie);
    if (await persist(lignes, { dateEmission })) {
      setDateEnregistree(dateEmission);
      setDateOpen(false);
    }
  };
  const saveClient = async () => {
    if (await persist(lignes, {
      clientName: client.clientName.trim(), clientPhone: client.clientPhone.trim(), clientVille: client.clientVille.trim(),
    })) setClientOpen(false);
  };
  const approve = async () => {
    if (await persist(lignes, { statut: 'finalise' })) onClose();
  };

  const menu = (
    <div className="quote-menu-wrap">
      <button type="button" className="sheet-close" onClick={() => setMenuOpen((value) => !value)} aria-label="Actions du devis"><MoreVertical size={25} /></button>
      {menuOpen && (
        <div className="quote-menu" role="menu">
          {devis?.statut === 'brouillon' && <button type="button" onClick={approve}>Approuver le devis</button>}
          {editableClient && <button type="button" onClick={() => { setClientOpen(true); setMenuOpen(false); }}>Modifier le client</button>}
          <button type="button" onClick={onClose}>Fermer</button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Sheet open={open} onClose={onClose} title={`Devis - ${devis?.devisNumber || ''}`} className="quote-editor-sheet"
        closePosition="left" headerActions={menu}>
        {lineForm ? (
          <>
            <div className="quote-subheader">
              <button type="button" onClick={() => setLineForm(null)} aria-label="Retour au devis"><ArrowLeft size={23} /></button>
              <strong>{lineForm.mode === 'edit' ? 'Modifier la ligne' : 'Ajouter une ligne au devis'}</strong>
            </div>
            <QuoteLineForm mode={lineForm.mode} value={lineForm.value}
              onChange={(value) => setLineForm({ ...lineForm, value })} onSubmit={submitLine}
              onCancel={() => setLineForm(null)} currency={currency} allowTax={withTva} saving={saving} />
          </>
        ) : (
          <div className="quote-editor">
            {chargement ? <div className="geo-loading">Chargement des lignes…</div> : (
              <>
                {editableClient && clientOpen && (
                  <div className="quote-editor-card quote-client-form">
                    <Field label="Client"><input className="input" value={client.clientName} onChange={(event) => setClient({ ...client, clientName: event.target.value })} /></Field>
                    <Field label="Téléphone"><input className="input" type="tel" value={client.clientPhone} onChange={(event) => setClient({ ...client, clientPhone: event.target.value })} /></Field>
                    <Field label="Ville"><input className="input" value={client.clientVille} onChange={(event) => setClient({ ...client, clientVille: event.target.value })} /></Field>
                    <button type="button" className="btn btn-primary btn-block" onClick={saveClient} disabled={saving}><Save size={16} /> Enregistrer le client</button>
                  </div>
                )}

                <div className="quote-note-card quote-date-card">
                  <button type="button" onClick={() => setDateOpen((value) => !value)} aria-expanded={dateOpen}>
                    <span>Date d'émission : <strong>{formatDate(dateEnregistree)}</strong></span><span>›</span>
                  </button>
                  {dateOpen && (
                    <div className="quote-note-editor">
                      <input className="input" type="date" aria-label="Date d'émission du devis" value={dateSaisie}
                        max={versChampDate(new Date())}
                        onChange={(event) => { setDateSaisie(event.target.value); setDateErreur(''); }} />
                      <div className="field-hint">Imprimée sur le devis ; sa validité de 30 jours part de cette date.</div>
                      {dateErreur && <div className="field-error" role="alert">{dateErreur}</div>}
                      <button type="button" className="btn btn-primary" onClick={saveDate} disabled={saving || !dateSaisie}><Save size={16} /> Enregistrer la date</button>
                    </div>
                  )}
                </div>

                <div className="quote-lines-card">
                  {lignes.map((line, index) => (
                    <QuoteLineItem key={line.id} line={line} index={index} currency={currency}
                      onEdit={openEdit} onDelete={setConfirmDelete} onDragStart={onDragStart}
                      onDragEnter={onDragEnter} onDragEnd={finishReorder}
                      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishReorder} />
                  ))}
                  {!lignes.length && <div className="empty-state">Aucune ligne dans ce devis.</div>}
                </div>

                <button type="button" className="quote-add-line" onClick={openCreate}><Plus size={25} /> Ajouter une ligne</button>

                <div className="quote-note-card">
                  <button type="button" onClick={() => setNoteOpen((value) => !value)}><span>Note de bas de page (facultatif)</span><span>›</span></button>
                  {noteOpen && (
                    <div className="quote-note-editor">
                      <textarea className="input" rows="4" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Conditions ou précision à conserver avec le devis" />
                      <button type="button" className="btn btn-primary" onClick={saveNote} disabled={saving}><Save size={16} /> Enregistrer la note</button>
                    </div>
                  )}
                </div>

                {saveError && <div className="storage-alert is-warning" role="alert"><span>{saveError}</span><button type="button" className="btn btn-sm btn-outline" onClick={retry}>Réessayer</button></div>}
                {saveState && !saveError && <div className="quote-save-state" role="status"><Check size={14} /> {saveState}</div>}
                <QuoteTotals totals={totals} currency={currency} />
                {devis?.statut === 'brouillon' ? (
                  <button type="button" className="btn btn-primary btn-block quote-primary-action" onClick={approve} disabled={saving || !lignes.length}>Approuver</button>
                ) : (
                  <button type="button" className="btn btn-primary btn-block quote-primary-action" onClick={onClose}>Terminer</button>
                )}
              </>
            )}
          </div>
        )}
      </Sheet>
      <ConfirmSheet open={confirmDelete != null} onClose={() => setConfirmDelete(null)} onConfirm={deleteLine}
        title="Supprimer cette ligne du devis ?" message="La ligne sera retirée et les totaux seront recalculés immédiatement."
        confirmLabel="Supprimer" danger />
    </>
  );
}
