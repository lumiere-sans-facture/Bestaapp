// Importé EN PREMIER par main.jsx : les modules s'évaluent dans l'ordre de
// leurs imports, donc ce nettoyage passe avant que le client Supabase ou
// l'app ne relisent le stockage (voir utils/suppressionCompte.js).
import { executerConsignePurge } from './utils/suppressionCompte';

executerConsignePurge();
