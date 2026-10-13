// Schémas pédagogiques des formations, dessinés en SVG et livrés AVEC
// l'application.
//
// Une leçon les cite par leur nom, sur une ligne seule : « [[schema:kit]] »
// (voir utils/formation.js#blocsLecon). La base ne stocke donc que ce nom,
// jamais de dessin : rien de ce qu'elle contient n'est injecté tel quel dans
// la page, et les schémas s'affichent hors ligne, sans image à télécharger.
//
// Les couleurs passent par les jetons du thème (classes « sf-* » dans
// index.css) : le même dessin se lit en clair comme en sombre. Les dessins
// sont pensés pour un écran de téléphone (viewBox de 360 de large, texte de
// 12 à 15) : sur ordinateur, la figure est simplement centrée.

const Fleche = ({ id }) => (
  <defs>
    <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" className="sf-pointe" />
    </marker>
  </defs>
);

/** F1 — Carte de l'interface : les cinq onglets et à quoi ils servent. */
function Interface() {
  const onglets = [
    ['Tableau de bord', 'Vos chiffres du mois et vos alertes'],
    ['Suivi clients', 'Vos affaires, étape par étape'],
    ['Devis', 'Dimensionner et chiffrer (bouton +)'],
    ['Boutique', 'Le catalogue et les commandes'],
    ['Plus', 'Clients, formation, simulateur, réglages'],
  ];
  return (
    <svg viewBox="0 0 360 352" className="sf" role="img"
      aria-label="Carte de l'application : Tableau de bord, Suivi clients, Devis, Boutique et Plus, avec la barre d'onglets en bas de l'écran">
      {onglets.map(([nom, role], i) => {
        const y = 6 + i * 54;
        const central = nom === 'Devis';
        return (
          <g key={nom}>
            <rect x="6" y={y} width="348" height="46" rx="10" className="sf-carte" />
            <rect x="16" y={y + 9} width="28" height="28" rx="8" className={central ? 'sf-accent' : 'sf-primaire'} />
            <text x="30" y={y + 28} textAnchor="middle" className="sf-texte-inverse sf-gras">{central ? '+' : nom[0]}</text>
            <text x="56" y={y + 20} className="sf-texte sf-gras">{nom}</text>
            <text x="56" y={y + 37} className="sf-texte-doux sf-petit">{role}</text>
          </g>
        );
      })}
      {/* La barre d'onglets du téléphone, telle qu'en bas de l'écran. */}
      <rect x="6" y="284" width="348" height="62" rx="12" className="sf-primaire" />
      {['Tableau', 'Suivi', 'Devis', 'Boutique', 'Plus'].map((nom, i) => {
        const x = 6 + (348 * (i + 0.5)) / 5;
        const central = nom === 'Devis';
        return (
          <g key={nom}>
            {central
              ? <circle cx={x} cy="306" r="15" className="sf-accent" />
              : <circle cx={x} cy="306" r="5" className="sf-point-clair" />}
            {central && <text x={x} y="312" textAnchor="middle" className="sf-texte-sombre sf-gras">+</text>}
            <text x={x} y="336" textAnchor="middle" className="sf-texte-inverse sf-petit">{nom}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Une suite d'étapes numérotées, reliées de haut en bas. */
function Etapes({ etapes, label, accentDerniere = true }) {
  const pas = 60;
  const hauteur = etapes.length * pas;
  return (
    <svg viewBox={`0 0 360 ${hauteur}`} className="sf" role="img" aria-label={label}>
      <line x1="28" y1="28" x2="28" y2={hauteur - 32} className="sf-trait" />
      {etapes.map(([titre, detail], i) => {
        const y = i * pas;
        const derniere = accentDerniere && i === etapes.length - 1;
        return (
          <g key={titre}>
            <circle cx="28" cy={y + 28} r="17" className={derniere ? 'sf-accent' : 'sf-primaire'} />
            <text x="28" y={y + 33} textAnchor="middle" className={`${derniere ? 'sf-texte-sombre' : 'sf-texte-inverse'} sf-gras`}>{i + 1}</text>
            <rect x="56" y={y + 4} width="298" height="48" rx="10" className="sf-carte" />
            <text x="68" y={y + 24} className="sf-texte sf-gras">{titre}</text>
            <text x="68" y={y + 42} className="sf-texte-doux sf-petit">{detail}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** F1 — Parcours d'un premier client, de l'inscription à la vente. */
const Parcours = () => (
  <Etapes
    label="Parcours : créer son compte, ajouter le client, ouvrir la piste, dimensionner, envoyer le devis, relancer jusqu'à la vente"
    etapes={[
      ['Créer son compte', 'Écran de connexion › Créer un compte'],
      ['Ajouter le client', 'Clients › Nouveau client'],
      ['Ouvrir l’affaire', 'Suivi clients › Nouvelle piste'],
      ['Dimensionner', 'Devis › Dimensionnement solaire'],
      ['Envoyer le devis', 'Envoyer le devis sur WhatsApp'],
      ['Relancer, puis gagner', 'Relancer par WhatsApp › Gagné'],
    ]}
  />
);

/** F2 — Du client à la signature. */
const FluxDevis = () => (
  <Etapes
    label="Flux d'un devis : le client, le dimensionnement, le devis, l'envoi sur WhatsApp, la relance, puis la signature"
    etapes={[
      ['Le client', 'Ses appareils ou sa facture SBEE / CEET'],
      ['Le dimensionnement', 'Panneaux, batterie, onduleur conseillés'],
      ['Le devis', 'Le kit suggéré, chiffré ligne par ligne'],
      ['L’envoi', 'Le PDF part sur WhatsApp'],
      ['La relance', 'Sans réponse après 7 jours : relancer'],
      ['La signature', 'Le gérant convertit en vente'],
    ]}
  />
);

/** F2 — Le chemin de l'énergie dans un kit hybride. */
function Kit() {
  return (
    <svg viewBox="0 0 360 372" className="sf" role="img"
      aria-label="Schéma d'un kit : les panneaux envoient du courant continu au régulateur MPPT de l'onduleur hybride, qui charge la batterie et alimente la maison en 230 volts ; le réseau SBEE ou CEET peut aussi entrer dans l'onduleur">
      <Fleche id="sf-fleche-kit" />
      {/* Soleil */}
      <circle cx="40" cy="40" r="17" className="sf-accent" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = (a * Math.PI) / 180;
        return <line key={a} x1={40 + Math.cos(r) * 23} y1={40 + Math.sin(r) * 23} x2={40 + Math.cos(r) * 30} y2={40 + Math.sin(r) * 30} className="sf-rayon" />;
      })}
      {/* Panneaux */}
      <g>
        <rect x="104" y="14" width="152" height="54" rx="4" className="sf-primaire" />
        {[1, 2, 3].map((i) => <line key={i} x1={104 + i * 38} y1="14" x2={104 + i * 38} y2="68" className="sf-grille" />)}
        <line x1="104" y1="41" x2="256" y2="41" className="sf-grille" />
        <text x="180" y="84" textAnchor="middle" className="sf-texte sf-gras">Panneaux solaires</text>
      </g>
      <line x1="180" y1="90" x2="180" y2="124" className="sf-fleche" markerEnd="url(#sf-fleche-kit)" />
      <text x="190" y="112" className="sf-texte-doux sf-petit">courant continu</text>
      {/* Onduleur hybride, MPPT intégré */}
      <rect x="96" y="130" width="168" height="78" rx="12" className="sf-carte sf-carte-forte" />
      <rect x="110" y="142" width="64" height="26" rx="6" className="sf-accent" />
      <text x="142" y="160" textAnchor="middle" className="sf-texte-sombre sf-gras sf-petit">MPPT</text>
      <text x="182" y="160" className="sf-texte-doux sf-petit">régulateur</text>
      <text x="180" y="194" textAnchor="middle" className="sf-texte sf-gras">Onduleur hybride</text>
      {/* Batterie */}
      <rect x="290" y="140" width="56" height="58" rx="8" className="sf-carte" />
      <rect x="308" y="134" width="20" height="7" rx="2" className="sf-primaire" />
      <rect x="298" y="174" width="40" height="16" rx="3" className="sf-succes" />
      <text x="318" y="216" textAnchor="middle" className="sf-texte sf-gras sf-petit">Batterie</text>
      <line x1="268" y1="169" x2="286" y2="169" className="sf-fleche" markerStart="url(#sf-fleche-kit)" markerEnd="url(#sf-fleche-kit)" />
      {/* Réseau, s'il existe */}
      <rect x="8" y="146" width="66" height="44" rx="8" className="sf-carte sf-pointille" />
      <text x="41" y="166" textAnchor="middle" className="sf-texte sf-gras sf-petit">Réseau</text>
      <text x="41" y="181" textAnchor="middle" className="sf-texte-doux sf-petit">SBEE/CEET</text>
      <line x1="76" y1="169" x2="92" y2="169" className="sf-fleche sf-pointille" markerEnd="url(#sf-fleche-kit)" />
      {/* Sortie vers la maison */}
      <line x1="180" y1="210" x2="180" y2="250" className="sf-fleche" markerEnd="url(#sf-fleche-kit)" />
      <text x="190" y="236" className="sf-texte-doux sf-petit">230 V alternatif</text>
      <path d="M128 296 L180 256 L232 296 Z" className="sf-primaire" />
      <rect x="140" y="294" width="80" height="54" className="sf-carte sf-carte-forte" />
      <rect x="171" y="318" width="18" height="30" className="sf-accent" />
      <text x="180" y="366" textAnchor="middle" className="sf-texte sf-gras">Maison : lampes, frigo, TV</text>
    </svg>
  );
}

/** F3 — L'entonnoir de vente, et l'indicateur de l'app à chaque étage. */
function Entonnoir() {
  const etages = [
    ['Contacts', 'quartier, WhatsApp, parrainage', 340],
    ['Pistes actives', 'Suivi clients', 280],
    ['Devis envoyés', 'Devis · ce mois', 214],
    ['Affaires gagnées', 'Gagnées · ce mois', 150],
  ];
  return (
    <svg viewBox="0 0 360 300" className="sf" role="img"
      aria-label="Entonnoir de vente : beaucoup de contacts, moins de pistes actives, moins de devis envoyés, et les affaires gagnées ; le taux de conversion mesure le passage du devis à la vente">
      {etages.map(([nom, indic, largeur], i) => {
        const y = 8 + i * 62;
        const suivante = etages[i + 1]?.[2] ?? largeur - 60;
        const x1 = (360 - largeur) / 2;
        const x2 = (360 - suivante) / 2;
        const derniere = i === etages.length - 1;
        return (
          <g key={nom}>
            <path d={`M${x1} ${y} L${360 - x1} ${y} L${360 - x2} ${y + 54} L${x2} ${y + 54} Z`}
              className={derniere ? 'sf-accent' : i % 2 ? 'sf-primaire-clair' : 'sf-primaire'} />
            <text x="180" y={y + 24} textAnchor="middle" className={`${derniere ? 'sf-texte-sombre' : 'sf-texte-inverse'} sf-gras`}>{nom}</text>
            <text x="180" y={y + 42} textAnchor="middle" className={`${derniere ? 'sf-texte-sombre' : 'sf-texte-inverse'} sf-petit`}>{indic}</text>
          </g>
        );
      })}
      <text x="180" y="290" textAnchor="middle" className="sf-texte-doux sf-petit">Du devis à la vente : le « Taux de conversion » du tableau de bord</text>
    </svg>
  );
}

/** F3 — Ce qu'une vente type fait entrer : un EXEMPLE, jamais une promesse. */
function Marge() {
  const max = 75000;
  const lignes = [
    ['Pose (ligne « Main d’œuvre »)', 75000, '75 000 F'],
    ['Commission partenaire (3 %)', 35400, '35 400 F'],
    ['Maintenance annuelle', 30000, '30 000 F / an'],
  ];
  const largeur = (v) => Math.round((v / max) * 200);
  return (
    <svg viewBox="0 0 360 286" className="sf" role="img"
      aria-label="Exemple pour un kit 5 kWh vendu 1 180 000 francs au Bénin : 75 000 F de pose, 35 400 F de commission partenaire, 30 000 F de maintenance par an, et une marge sur le matériel qui dépend de vos prix d'achat">
      <text x="6" y="18" className="sf-texte sf-gras">Exemple : Kit 5 kWh vendu 1 180 000 F</text>
      <text x="6" y="36" className="sf-texte-doux sf-petit">Chantier au Bénin — au Togo, la pose est doublée</text>
      {lignes.map(([nom, valeur, montant], i) => {
        const y = 54 + i * 54;
        return (
          <g key={nom}>
            <text x="6" y={y + 12} className="sf-texte sf-petit sf-gras">{nom}</text>
            <rect x="6" y={y + 20} width={largeur(valeur)} height="20" rx="5" className={i === 0 ? 'sf-primaire' : 'sf-primaire-clair'} />
            <text x={14 + largeur(valeur)} y={y + 35} className="sf-texte sf-gras sf-petit">{montant}</text>
          </g>
        );
      })}
      <g>
        <text x="6" y="228" className="sf-texte sf-petit sf-gras">Marge sur le matériel</text>
        <rect x="6" y="236" width="200" height="20" rx="5" className="sf-hachure" />
        <text x="214" y="251" className="sf-texte sf-gras sf-petit">selon vos prix</text>
      </g>
      <text x="6" y="280" className="sf-texte-doux sf-petit">Montants avant vos frais (transport, outillage) : pas un gain garanti.</text>
    </svg>
  );
}

const SCHEMAS = {
  interface: { Dessin: Interface, legende: 'Les cinq onglets de l’application, et à quoi sert chacun.' },
  parcours: { Dessin: Parcours, legende: 'Le parcours d’un premier client, de votre inscription à la vente.' },
  'flux-devis': { Dessin: FluxDevis, legende: 'Du client à la signature : chaque étape a son écran dans l’application.' },
  kit: { Dessin: Kit, legende: 'Le chemin de l’énergie dans un kit hybride.' },
  entonnoir: { Dessin: Entonnoir, legende: 'L’entonnoir de vente, et l’indicateur de l’application à chaque étage.' },
  marge: { Dessin: Marge, legende: 'Ce qu’une vente type fait entrer — un exemple, à refaire avec vos propres prix.' },
};

/** Noms acceptés dans « [[schema:nom]] ». */
export const NOMS_SCHEMAS = Object.keys(SCHEMAS);

export default function SchemaFormation({ nom }) {
  const schema = SCHEMAS[nom];
  // Un nom inconnu (faute de frappe du gérant) : rien plutôt qu'un cadre vide.
  if (!schema) return null;
  const { Dessin, legende } = schema;
  return (
    <figure className="schema-formation">
      <Dessin />
      <figcaption>{legende}</figcaption>
    </figure>
  );
}
