import { useState } from 'react';
import { Search } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { formatCFA } from '../../utils/format';
import StageBadge from '../../components/StageBadge';

/**
 * Sélecteur de client des assistants de devis : toute la liste des clients
 * (ordre alphabétique, badge d'étape) avec recherche par nom, contact ou
 * téléphone.
 */
export default function LeadPicker({ leads, selectedLeadId, onSelect }) {
  const { stages, lostStage } = useData();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = leads
    .filter((l) => !q || [l.name, l.contact, l.phone].some((v) => (v || '').toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const stageInfo = (lead) => (lead.stage === 'perdu' ? lostStage : stages.find((s) => s.id === lead.stage));

  return (
    <>
      <div className="search-box lead-picker-search">
        <Search size={16} className="search-icon" />
        <input
          className="input search-input"
          placeholder="Rechercher un client (nom, contact, téléphone)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="lead-select">
        {list.map((lead) => {
          const st = stageInfo(lead);
          return (
            <button
              key={lead.id}
              className={`lead-select-item ${selectedLeadId === lead.id ? 'selected' : ''}`}
              onClick={() => onSelect(lead.id)}
            >
              <div className="lead-select-name">
                {lead.name}{' '}
                {st && <StageBadge stage={st} />}
              </div>
              <div className="lead-select-value">
                {lead.contact}{lead.phone ? ` · ${lead.phone}` : ''}{lead.estimatedValue > 0 ? ` — ${formatCFA(lead.estimatedValue)}` : ''}
              </div>
            </button>
          );
        })}
        {list.length === 0 && (
          <div className="lead-picker-empty">
            {q ? 'Aucun client ne correspond à cette recherche.' : 'Aucun client pour le moment — ajoutez-en depuis la page Clients.'}
          </div>
        )}
      </div>
    </>
  );
}
