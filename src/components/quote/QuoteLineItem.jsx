import { GripVertical, X } from 'lucide-react';
import { formatQuoteCurrency, quoteLineTotals } from '../../utils/quoteLines';

export default function QuoteLineItem({ line, index, currency, onEdit, onDelete, onDragStart, onDragEnter, onDragEnd, onPointerDown, onPointerMove, onPointerUp }) {
  const total = quoteLineTotals(line).totalTTC;
  return (
    <div className="quote-line-item" data-quote-line-index={index} draggable
      onDragStart={(event) => onDragStart(event, index)} onDragEnter={(event) => onDragEnter(event, index)}
      onDragOver={(event) => event.preventDefault()} onDragEnd={onDragEnd}>
      <button type="button" className="quote-line-delete" onClick={(event) => { event.stopPropagation(); onDelete(index); }}
        aria-label={`Supprimer ${line.designation}`}><X size={25} /></button>
      <button type="button" className="quote-line-content" onClick={() => onEdit(index)}>
        <span className="quote-line-name" title={line.designation}>{line.designation}</span>
        <span className="quote-line-amount">{formatQuoteCurrency(total, currency)}</span>
        <span className="quote-line-meta">{line.qty} {line.unit || 'pcs'}</span>
      </button>
      <button type="button" className="quote-line-grip" aria-label={`Déplacer ${line.designation}`}
        onPointerDown={(event) => onPointerDown(event, index)} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}>
        <GripVertical size={27} />
      </button>
    </div>
  );
}
