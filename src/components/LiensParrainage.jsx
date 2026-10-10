// Code partenaire et ses deux liens à partager : le site (demande de devis)
// et l'application Android — installée par ce lien, elle ouvre l'inscription
// avec le code déjà rempli (public/telecharger.html).
import { useState } from 'react';
import { Check, Copy, MessageCircle, Smartphone } from 'lucide-react';
import { lienInstallationApp, messageParrainage, partnerLink } from '../utils/referral';
import { useToast } from './Toast';

export default function LiensParrainage({ code, className = '', children }) {
  const toast = useToast();
  const [copie, setCopie] = useState(null); // 'site' | 'app' | null
  const liens = { site: partnerLink(code), app: lienInstallationApp(code) };

  const copier = async (quoi) => {
    try {
      await navigator.clipboard.writeText(liens[quoi]);
      setCopie(quoi);
      setTimeout(() => setCopie((c) => (c === quoi ? null : c)), 2000);
    } catch {
      toast(`Copie impossible — lien : ${liens[quoi]}`, { type: 'error' });
    }
  };

  const partagerWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(messageParrainage(code))}`, '_blank');
  };

  const icone = (quoi) => (copie === quoi ? <Check size={14} /> : <Copy size={14} />);

  return (
    <div className={`affiliate-box ${className}`.trim()}>
      <div className="affiliate-code">{code}</div>
      <div className="affiliate-link"><span className="affiliate-link-titre">Site</span>{liens.site}</div>
      <div className="affiliate-link">
        <span className="affiliate-link-titre"><Smartphone size={12} /> App Android, code prérempli</span>{liens.app}
      </div>
      <div className="affiliate-actions">
        <button className="btn btn-sm btn-outline" onClick={() => copier('site')}>
          {icone('site')} {copie === 'site' ? 'Copié !' : 'Copier le lien'}
        </button>
        <button className="btn btn-sm btn-outline" onClick={() => copier('app')}>
          {icone('app')} {copie === 'app' ? 'Copié !' : 'Lien de l’app'}
        </button>
        <button className="btn btn-sm btn-whatsapp" onClick={partagerWhatsApp}>
          <MessageCircle size={14} /> Partager WhatsApp
        </button>
      </div>
      {children}
    </div>
  );
}
