import { Send } from 'lucide-react';
import Sheet from './Sheet';
import { whatsappLink } from '../utils/paiement';

/**
 * PDF prêt à partir (voir screens/devis/useEnvoiPdf) : le navigateur réclame
 * un nouveau toucher pour partager, ou (ordinateur) ne sait pas joindre un
 * fichier — il vient alors d'être téléchargé, et WhatsApp s'ouvre sur la
 * conversation du client.
 * @param {object} p
 * @param {object|null} p.envoi       envoiPret du hook
 * @param {string} p.titre            « Envoyer le devis »
 * @param {string} p.libelle          « du devis » / « de la facture »
 */
export default function EnvoiPdfSheet({ envoi, titre, libelle, onPartager, onFermer }) {
  return (
    <Sheet open={!!envoi} onClose={onFermer} title={titre}>
      {envoi && (
        <div className="doc-actions-list">
          {envoi.mode === 'partage' ? (
            <>
              <p className="field-hint">Le PDF {libelle} est prêt.</p>
              <button className="btn btn-whatsapp btn-block" onClick={onPartager}><Send size={16} /> Envoyer sur WhatsApp</button>
            </>
          ) : (
            <>
              <p className="field-hint">
                Le PDF « {envoi.nom} » vient d’être téléchargé. Ouvrez la conversation,
                puis joignez-y le fichier (trombone ou glisser-déposer).
              </p>
              <a className="btn btn-whatsapp btn-block" href={whatsappLink(envoi.telephone, envoi.texte)}
                target="_blank" rel="noopener noreferrer" onClick={onFermer}>
                <Send size={16} /> Ouvrir WhatsApp
              </a>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
