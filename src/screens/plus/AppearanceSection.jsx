import { Sun, Moon, MonitorSmartphone, Palette, Check } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const THEMES = [
  { id: 'clair', icon: Sun, label: 'Clair', desc: 'Thème clair, pour une utilisation de jour' },
  { id: 'sombre', icon: Moon, label: 'Sombre', desc: 'Thème sombre, pour une utilisation de nuit' },
  { id: 'systeme', icon: MonitorSmartphone, label: 'Système', desc: 'Suivre la préférence de votre appareil' },
];

// Une carte d'option : icône, libellé, description, et la pastille cochée de
// l'option retenue.
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
 * Paramètres → Apparence : le thème de l'application.
 * Un réglage d'APPAREIL, stocké en local et jamais répliqué —
 * voir context/ThemeContext.jsx.
 */
export default function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="settings-tab">
      <div className="card appearance-group">
        <div className="appearance-group-title"><Palette size={17} /> Thème</div>
        <p className="appearance-group-hint">Choisissez entre le mode clair, sombre ou les préférences de votre système.</p>
        <div className="appearance-options" role="group" aria-label="Thème">
          {THEMES.map((t) => (
            <Option key={t.id} icon={t.icon} label={t.label} desc={t.desc} actif={theme === t.id} onClick={() => setTheme(t.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}
