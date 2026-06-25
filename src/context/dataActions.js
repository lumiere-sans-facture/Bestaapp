// Assemblage des actions métier par domaine. createActions(setState) compose
// les sous-modules en une seule API d'actions, consommée par le Provider.
import { buildInitialState } from './dataState';
import { COMMISSION_RATES, newReferral } from './actions/shared';
import { createLeadActions } from './actions/leads';
import { createPartnerActions } from './actions/partners';
import { createCatalogueActions } from './actions/catalogue';
import { createDevisActions } from './actions/devis';
import { createFormationActions } from './actions/formations';
import { createProActions } from './actions/pro';

// Ré-exports conservés pour les consommateurs existants (Provider, écran Plus).
export { COMMISSION_RATES, newReferral };

export function createActions(setState) {
  return {
    ...createLeadActions(setState),
    ...createPartnerActions(setState),
    ...createCatalogueActions(setState),
    ...createDevisActions(setState),
    ...createFormationActions(setState),
    ...createProActions(setState),
    resetData: () => setState(buildInitialState()),
  };
}
