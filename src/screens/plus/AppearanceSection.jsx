import { Sun, Moon, MonitorSmartphone, Palette, LayoutGrid, Check } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const THEMES = [
  { id: 'clair', icon: Sun, label: 'Clair', desc: 'Thème clair, pour une utilisation de jour' },
  { id: 'sombre', icon: Moon, label: 'Sombre', desc: 'Thème sombre, pour une utilisation de nuit' },
  { id: 'systeme', icon: MonitorSmartphone, label: 'Système', desc: 'Suivre la préférence de votre appareil' },
];

const DENSITES = [
  { id: 'compact', label: 'Compact', desc: 'Moins d’espacement, plus de contenu visible' },
  { id: 'defaut', label: 'Par défaut', desc: 'Espacement équilibré' },
  { id: 'confortable', label: 'Confortable', desc: 'Plus d’espacement, plus facile à lire' },
];

// Une carte d'option : icône facultative, libellé, description, et la pastille
// cochée de l'option retenue.
function Option({ icon: Icon, label, desc, actif, onClick }) {
  return (
    <button type="button" className={`appearance-option ${actif ? 'active' : ''}`} aria-pressed={actif} onClick={onClick}>
      {actif && <span className="appearance-option-check" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>}
      {Icon && <Icon size={24} className="appearance-option-icon" aria-hidden="true" />}
      <span className="appearance-option-label">{label}</span>
      <span className="appearance-option-desc">{desc}</span>
    </button>
  );
}

/**
 * Paramètres → Apparence : thème et densité de l'interface.
 * Deux réglages d'APPAREIL, stockés en local et jamais répliqués —
 * voir context/ThemeContext.jsx.
 */
export default function AppearanceSection() {
  const { theme, setTheme, density, setDensity } = useTheme();

  return (
    <>
      <div className="card appearance-group">
        <div className="appearance-group-title"><Palette size={17} /> Thème</div>
        <p className="appearance-group-hint">Choisissez entre le mode clair, sombre ou les préférences de votre système.</p>
        <div className="appearance-options" role="group" aria-label="Thème">
          {THEMES.map((t) => (
            <Option key={t.id} icon={t.icon} label={t.label} desc={t.desc} actif={theme === t.id} onClick={() => setTheme(t.id)} />
          ))}
        </div>
      </div>

      <div className="card appearance-group">
        <div className="appearance-group-title"><LayoutGrid size={17} /> Densité de l’interface</div>
        <p className="appearance-group-hint">Ajustez l’espacement et la taille des éléments.</p>
        <div className="appearance-options" role="group" aria-label="Densité de l’interface">
          {DENSITES.map((d) => (
            <Option key={d.id} label={d.label} desc={d.desc} actif={density === d.id} onClick={() => setDensity(d.id)} />
          ))}
        </div>
      </div>
    </>
  );
}
