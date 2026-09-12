import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { formatCFA } from '../utils/format';
import { prixPublic } from '../utils/price';

const identifiantLigne = () => crypto.randomUUID();

/**
 * Proposition de devis modifiable, partagée par les parcours qui partent
 * d'une composition automatique. Les prix proposés viennent du catalogue ;
 * le professionnel peut ensuite adapter la ligne avant d'émettre son devis.
 */
export default function EditableQuotation({ lines, onChange, products = [] }) {
  const [productId, setProductId] = useState('');

  const update = (id, patch) => onChange(lines.map((line) => (
    line.id === id ? { ...line, ...patch } : line
  )));

  const remove = (id) => onChange(lines.filter((line) => line.id !== id));

  const productLine = (product) => ({
    id: identifiantLigne(),
    productId: product.id,
    designation: product.name,
    qty: 1,
    pu: prixPublic(product.basePrice),
  });

  const addProduct = () => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    onChange([...lines, productLine(product)]);
    setProductId('');
  };

  const replaceProduct = (lineId, nextProductId) => {
    const product = products.find((item) => item.id === nextProductId);
    if (!product) return;
    update(lineId, {
      productId: product.id,
      designation: product.name,
      pu: prixPublic(product.basePrice),
    });
  };

  return (
    <div className="editable-quotation">
      <div className="bom-title">Proposition modifiable</div>
      {lines.map((line) => (
        <div className="editable-quotation-row" key={line.id}>
          <div className="editable-quotation-main">
            <input
              className="input"
              value={line.designation}
              onChange={(event) => update(line.id, { designation: event.target.value })}
              aria-label="Désignation"
            />
            <button type="button" className="appliance-delete" onClick={() => remove(line.id)} aria-label={`Supprimer ${line.designation}`}>
              <Trash2 size={15} />
            </button>
          </div>
          <div className="editable-quotation-fields">
            <label>
              <span>Quantité</span>
              <input type="number" min="1" step="1" value={line.qty}
                onChange={(event) => update(line.id, { qty: Math.max(1, Number(event.target.value) || 1) })} />
            </label>
            <label>
              <span>Prix unitaire</span>
              <input type="number" min="0" step="1" value={line.pu}
                onChange={(event) => update(line.id, { pu: Math.max(0, Number(event.target.value) || 0) })} />
            </label>
            <label>
              <span>Remplacer par</span>
              <select value="" onChange={(event) => replaceProduct(line.id, event.target.value)}>
                <option value="">Un produit du catalogue…</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </label>
            <strong>{formatCFA((Number(line.qty) || 0) * (Number(line.pu) || 0))}</strong>
          </div>
        </div>
      ))}

      <div className="editable-quotation-add">
        <select className="input" value={productId} onChange={(event) => setProductId(event.target.value)}>
          <option value="">Ajouter un produit du catalogue…</option>
          {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
        </select>
        <button type="button" className="btn btn-outline" onClick={addProduct} disabled={!productId}>
          <Plus size={16} /> Ajouter
        </button>
      </div>
      {!lines.length && <div className="empty-state">Ajoutez au moins un produit à la proposition.</div>}
    </div>
  );
}

export const lignesDepuisDevisKit = (quotation) => [
  ...(quotation?.components || []),
  ...(quotation?.prestations || []),
].map((line) => ({
  id: identifiantLigne(),
  designation: line.name,
  qty: line.quantity,
  pu: line.unitPrice,
}));

export const lignesModifiables = (lines = []) => lines.map((line) => ({
  ...line,
  id: identifiantLigne(),
}));
