// POST /api/agent-devis   { messages }
// En-tête : Authorization: Bearer <jeton Supabase d'un GÉRANT>
//
// Agent devis (PROTOTYPE) : relais vers Claude. Le serveur détient la clé
// et fixe seul le modèle, les consignes et les outils ; le navigateur
// n'envoie que la conversation. Les outils (dimensionnement, chiffrage)
// s'exécutent dans l'app, avec les kits de l'entreprise : la réponse est
// renvoyée telle quelle, l'app exécute les outils demandés et rappelle.
//
// Réservé aux gérants le temps du prototype : chaque appel est facturé.
import Anthropic from '@anthropic-ai/sdk';
import { MODELE_AGENT, SYSTEME_AGENT, OUTILS_AGENT, validerConversation } from '../src/utils/agentDevisDefinitions.js';
import { gerantDuJeton, accesConfigure } from './_lib/acces.js';
import { limiter, erreurServeur, refusAuth, journaliser, PLAFONDS } from './_lib/garde.js';

// Une réponse de Claude (réflexion comprise) peut dépasser le délai par
// défaut d'une fonction Vercel.
export const config = { maxDuration: 60 };

const safeJson = (t) => { try { return JSON.parse(t); } catch { return {}; } };

export default async function handler(req, res) {
  if (limiter(req, res, PLAFONDS.agentDevis, 'agent-devis')) return;
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY || !accesConfigure()) {
    journaliser('config-incomplete', req, { cle_claude: !!process.env.ANTHROPIC_API_KEY, supabase: accesConfigure() });
    res.status(503).json({ error: 'Agent devis non configuré sur ce serveur.' });
    return;
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const profil = await gerantDuJeton(token);
  if (!profil) {
    refusAuth(req, res, token ? 'jeton refuse ou role insuffisant' : 'jeton absent');
    return;
  }

  const corps = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  const motif = validerConversation(corps.messages);
  if (motif) {
    res.status(400).json({ error: `Conversation refusée : ${motif}.` });
    return;
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const reponse = await client.beta.messages.create({
      model: MODELE_AGENT,
      max_tokens: 16000,
      // Consignes et outils identiques d'un appel à l'autre : mis en cache
      // (les outils précèdent les consignes dans le préfixe).
      system: [{ type: 'text', text: SYSTEME_AGENT, cache_control: { type: 'ephemeral' } }],
      tools: OUTILS_AGENT,
      messages: corps.messages,
      output_config: { effort: 'medium' },
      // Un refus des filtres de sécurité est rejoué sur le modèle de repli
      // recommandé par Anthropic, plutôt que de laisser le client sans réponse.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    journaliser('agent-devis', req, {
      org: profil.org_id,
      modele: reponse.model,
      arret: reponse.stop_reason,
      jetons_entree: reponse.usage?.input_tokens,
      jetons_cache: reponse.usage?.cache_read_input_tokens,
      jetons_sortie: reponse.usage?.output_tokens,
    });
    res.status(200).json({
      // Le contenu est renvoyé INTÉGRALEMENT (réflexion comprise) : l'app le
      // renvoie tel quel au tour suivant, sans le modifier.
      content: reponse.content,
      stop_reason: reponse.stop_reason,
      usage: reponse.usage,
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      erreurServeur(req, res, 429, 'L’agent est très sollicité, réessayez dans un instant.', e);
    } else if (e instanceof Anthropic.BadRequestError) {
      erreurServeur(req, res, 400, 'La conversation n’a pas pu être traitée.', e);
    } else {
      erreurServeur(req, res, 502, 'L’agent devis ne répond pas pour le moment.', e);
    }
  }
}
