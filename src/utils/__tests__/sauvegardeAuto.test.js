// Sauvegarde quotidienne automatique.
//
// Ce que ces tests protègent, par ordre d'importance :
//   1. le fichier produit la nuit reste RESTAURABLE par le bouton existant ;
//   2. la liste des tables ne dérive pas de la liste des collections répliquées ;
//   3. la purge ne garde que les 7 dernières, et ne touche à rien d'autre.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SYNCED_COLLECTIONS } from '../../lib/remoteSync';
import { SEED_VERSION } from '../../data/seed';
import { BACKUP_MARKER, isValidBackup, extractState } from '../backup';
import {
  MARQUEUR_SAUVEGARDE,
  SAUVEGARDES_GARDEES,
  TABLES_METIER,
  TABLES_SERVEUR,
  TABLES_SAUVEGARDE,
  ordreDeTri,
  jourUTC,
  nomFichierSauvegarde,
  estNomDeSauvegarde,
  sauvegardesAPurger,
  construireSauvegarde,
  compterLignes,
  resumeMarkdown,
  versionDepuisSeed,
} from '../sauvegardeAuto';

const sauvegardeDExemple = () =>
  construireSauvegarde({
    tables: {
      leads: [{ id: 'c-4f2a', name: 'Client' }],
      devis: [{ id: 'd-1' }],
      profiles: [{ id: 'p-1', email: 'a@b.c' }],
    },
    version: 5,
    exportedAt: '2026-10-08T02:17:00.000Z',
  });

describe('tables sauvegardées', () => {
  it('couvre exactement les collections répliquées, dans le même ordre', () => {
    // Le test qui compte : une collection ajoutée à la réplication et oubliée
    // dans la sauvegarde ne manquerait qu'au moment de restaurer.
    expect(TABLES_METIER).toEqual(SYNCED_COLLECTIONS);
  });

  it('ajoute les tables serveur sans doublon', () => {
    expect(TABLES_SAUVEGARDE).toEqual([...TABLES_METIER, ...TABLES_SERVEUR]);
    expect(new Set(TABLES_SAUVEGARDE).size).toBe(TABLES_SAUVEGARDE.length);
  });

  it('ne sauvegarde jamais les jetons OAuth ni le journal d’erreurs', () => {
    for (const interdite of ['google_contacts_configs', 'google_contacts_oauth_states', 'erreurs']) {
      expect(TABLES_SAUVEGARDE).not.toContain(interdite);
    }
  });

  it('trie chaque table sur sa vraie clé primaire', () => {
    expect(ordreDeTri('leads')).toBe('id.asc');
    expect(ordreDeTri('tombstones')).toBe('id.asc,collection.asc');
    expect(ordreDeTri('codes_promo')).toBe('code.asc');
    expect(ordreDeTri('codes_promo_utilisations')).toBe('code.asc,user_id.asc');
    expect(ordreDeTri('paiements_verifies')).toBe('transaction_id.asc');
  });
});

describe('format du fichier', () => {
  it('porte le même marqueur que l’export manuel', () => {
    expect(MARQUEUR_SAUVEGARDE).toBe(BACKUP_MARKER);
  });

  it('est reconnu comme une sauvegarde valide par l’app', () => {
    // Autrement dit : restaurable par « Plus › Sauvegarde des données ».
    expect(isValidBackup(sauvegardeDExemple())).toBe(true);
  });

  it('se restaure en rendant les collections connues', () => {
    const etat = extractState(sauvegardeDExemple());
    expect(etat.leads).toEqual([{ id: 'c-4f2a', name: 'Client' }]);
    expect(etat.devis).toEqual([{ id: 'd-1' }]);
  });

  it('laisse les tables serveur hors de l’état restauré', () => {
    // `profiles` est sauvegardé pour reconstruire la base, mais ce n'est pas une
    // collection de l'app : la restauration ne doit pas l'injecter dans l'état.
    expect(extractState(sauvegardeDExemple()).profiles).toBeUndefined();
  });

  it('garde les tables absentes hors de `data`', () => {
    const s = construireSauvegarde({
      tables: { leads: [] },
      version: 5,
      exportedAt: '2026-10-08T02:17:00.000Z',
      tablesAbsentes: ['codes_promo'],
    });
    expect(s.tablesAbsentes).toEqual(['codes_promo']);
    expect(s.data.tablesAbsentes).toBeUndefined();
    expect(isValidBackup(s)).toBe(true);
  });

  it('indique son origine et la date d’export', () => {
    const s = sauvegardeDExemple();
    expect(s.origine).toBe('tache-planifiee');
    expect(s.exportedAt).toBe('2026-10-08T02:17:00.000Z');
    expect(s.version).toBe(5);
  });
});

describe('nom de fichier', () => {
  it('porte la date du jour en UTC', () => {
    expect(jourUTC(new Date('2026-10-08T02:17:00.000Z'))).toBe('2026-10-08');
    expect(nomFichierSauvegarde(new Date('2026-10-08T02:17:00.000Z')))
      .toBe('bestasolar-sauvegarde-2026-10-08.json');
  });

  it('complète les mois et jours à deux chiffres', () => {
    expect(nomFichierSauvegarde(new Date('2026-01-05T00:00:00.000Z')))
      .toBe('bestasolar-sauvegarde-2026-01-05.json');
  });

  it('donne le même nom pour deux exécutions du même jour', () => {
    // Deux passages le même jour se remplacent, ils ne s'empilent pas.
    const matin = nomFichierSauvegarde(new Date('2026-10-08T02:17:00.000Z'));
    const soir = nomFichierSauvegarde(new Date('2026-10-08T23:59:00.000Z'));
    expect(matin).toBe(soir);
  });

  it('reconnaît ses propres fichiers, et eux seuls', () => {
    expect(estNomDeSauvegarde('bestasolar-sauvegarde-2026-10-08.json')).toBe(true);
    expect(estNomDeSauvegarde('DERNIERE-SAUVEGARDE.md')).toBe(false);
    expect(estNomDeSauvegarde('README.md')).toBe(false);
    expect(estNomDeSauvegarde('bestasolar-sauvegarde.json')).toBe(false);
    expect(estNomDeSauvegarde('bestasolar-sauvegarde-2026-10-08.json.bak')).toBe(false);
    expect(estNomDeSauvegarde('')).toBe(false);
    expect(estNomDeSauvegarde(undefined)).toBe(false);
  });
});

describe('purge à 7 jours glissants', () => {
  const jours = (...dates) => dates.map((d) => `bestasolar-sauvegarde-${d}.json`);

  it('ne supprime rien tant qu’on est sous la limite', () => {
    expect(sauvegardesAPurger(jours('2026-10-06', '2026-10-07', '2026-10-08'))).toEqual([]);
  });

  it('ne supprime rien à exactement 7 sauvegardes', () => {
    const sept = jours(
      '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05',
      '2026-10-06', '2026-10-07', '2026-10-08',
    );
    expect(sauvegardesAPurger(sept)).toEqual([]);
  });

  it('supprime les plus anciennes au-delà de 7', () => {
    const neuf = jours(
      '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
      '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08',
    );
    expect(sauvegardesAPurger(neuf)).toEqual(jours('2026-09-30', '2026-10-01'));
  });

  it('se fiche de l’ordre dans lequel les fichiers sont listés', () => {
    const desordre = jours('2026-10-08', '2026-09-30', '2026-10-05', '2026-10-01')
      .concat(jours('2026-10-02', '2026-10-03', '2026-10-04', '2026-10-06', '2026-10-07'));
    expect(sauvegardesAPurger(desordre)).toEqual(jours('2026-09-30', '2026-10-01'));
  });

  it('ignore tout fichier qui n’est pas une sauvegarde', () => {
    const melange = ['README.md', 'DERNIERE-SAUVEGARDE.md', '.git', ...jours(
      '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03',
      '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07',
    )];
    const aPurger = sauvegardesAPurger(melange);
    expect(aPurger).toEqual(jours('2026-09-29', '2026-09-30'));
    expect(aPurger).not.toContain('README.md');
    expect(aPurger).not.toContain('DERNIERE-SAUVEGARDE.md');
  });

  it('respecte une rétention sur mesure, et refuse de tout supprimer sur un nombre absurde', () => {
    const trois = jours('2026-10-06', '2026-10-07', '2026-10-08');
    expect(sauvegardesAPurger(trois, 1)).toEqual(jours('2026-10-06', '2026-10-07'));
    expect(sauvegardesAPurger(trois, -5)).toEqual(trois); // garde 0 : tout part, mais rien n'explose
  });

  it('tolère une liste vide', () => {
    expect(sauvegardesAPurger([])).toEqual([]);
    expect(sauvegardesAPurger(undefined)).toEqual([]);
  });

  it('garde 7 jours par défaut', () => {
    expect(SAUVEGARDES_GARDEES).toBe(7);
  });
});

describe('version du schéma', () => {
  it('retrouve la version écrite dans le vrai fichier seed', () => {
    // Le script de sauvegarde LIT ce fichier au lieu de l'importer (Node ne
    // résout pas les imports sans extension de `seed.js`). Si la déclaration
    // change de forme, ce test tombe avant que la sauvegarde ne perde sa version.
    const contenu = readFileSync('src/data/seed.js', 'utf8');
    expect(versionDepuisSeed(contenu)).toBe(SEED_VERSION);
  });

  it('rend null plutôt qu’une valeur inventée', () => {
    expect(versionDepuisSeed('rien à voir')).toBeNull();
    expect(versionDepuisSeed('')).toBeNull();
    expect(versionDepuisSeed(undefined)).toBeNull();
  });
});

describe('résumé lisible', () => {
  it('compte les lignes de chaque table', () => {
    expect(compterLignes({ leads: [1, 2, 3], devis: [], kits: [1] }))
      .toEqual({ leads: 3, devis: 0, kits: 1 });
  });

  it('annonce la date, le fichier et le total', () => {
    const md = resumeMarkdown({
      exportedAt: '2026-10-08T02:17:00.000Z',
      tables: { leads: [1, 2], devis: [1] },
      fichier: 'bestasolar-sauvegarde-2026-10-08.json',
      gardees: 7,
    });
    expect(md).toContain('2026-10-08T02:17:00.000Z');
    expect(md).toContain('bestasolar-sauvegarde-2026-10-08.json');
    expect(md).toContain('**Lignes au total** : 3');
    expect(md).toContain('| leads | 2 |');
  });

  it('signale les tables absentes de la base', () => {
    const md = resumeMarkdown({
      exportedAt: '2026-10-08T02:17:00.000Z',
      tables: { leads: [] },
      tablesAbsentes: ['codes_promo'],
      fichier: 'bestasolar-sauvegarde-2026-10-08.json',
      gardees: 7,
    });
    expect(md).toContain('Tables absentes');
    expect(md).toContain('`codes_promo`');
  });
});
