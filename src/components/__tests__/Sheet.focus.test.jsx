/**
 * Régression de saisie : dans un panneau (Sheet), taper un caractère ne doit
 * JAMAIS faire perdre le focus au champ.
 *
 * Le défaut : l'effet qui pose le piège à focus dépendait de `onClose`, une
 * fonction anonyme recréée à chaque rendu du parent. Chaque frappe relançait
 * l'effet, et son nettoyage rendait le focus au bouton déclencheur — il fallait
 * recliquer dans le champ après chaque lettre. Reproduit puis corrigé, vérifié
 * en navigateur réel (« ABCD » saisi en une fois).
 */
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import Sheet from '../Sheet';

describe('Sheet — stabilité de la saisie', () => {
  it('rend à l’identique quand le parent recrée onClose', () => {
    // Cas réel : une fonction fléchée écrite directement dans le JSX du parent,
    // donc une nouvelle référence à chaque frappe.
    const a = renderToString(<Sheet open onClose={() => {}} title="T"><input /></Sheet>);
    const b = renderToString(<Sheet open onClose={() => {}} title="T"><input /></Sheet>);
    expect(a).toBe(b);
  });

  it('l’effet de focus ne dépend que de l’ouverture', () => {
    // Garde-fou sur la cause exacte : si `onClose` revient dans les
    // dépendances, la perte de focus à chaque caractère revient avec.
    const src = Sheet.toString();
    expect(src).not.toMatch(/\[\s*open\s*,\s*onClose\s*\]/);
    expect(src).toMatch(/onCloseRef/);
  });

  it('affiche son contenu ouvert, et rien de fermé', () => {
    const ouvert = renderToString(<Sheet open onClose={() => {}} title="Titre"><input /></Sheet>);
    expect(ouvert).toContain('Titre');
    expect(ouvert).toContain('<input');
    expect(renderToString(<Sheet open={false} onClose={() => {}} title="T"><input /></Sheet>)).toBe('');
  });
});
