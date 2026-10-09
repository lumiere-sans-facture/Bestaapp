// « Application Android » — l'APK à télécharger directement, sans Play Store.
//
// Le lien est sur NOTRE domaine (/telecharger) et mène toujours à la
// DERNIÈRE version publiée (Release GitHub, voir config/android.js) : rien à
// changer ici à chaque nouvelle version.
// Version, taille et date sont lues sur GitHub ; si la lecture échoue, le
// bouton reste — seule la ligne d'information disparaît.
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { CHEMIN_TELECHARGEMENT } from '../../config/android';
import { derniereReleaseAndroid } from '../../lib/releaseAndroid';
import { tailleLisible } from '../../utils/miseAJourAndroid';

/** Le robot Android (tête), dessiné en SVG : l'emblème d'Android, pas celui du Play Store. */
export function LogoAndroid({ taille = 56 }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 64 64" role="img" aria-label="Android">
      <rect width="64" height="64" rx="16" fill="#3DDC84" />
      <g fill="#073042">
        <path d="M11 46a21 21 0 0 1 42 0z" />
        <rect x="18" y="15" width="3.2" height="11" rx="1.6" transform="rotate(-30 19.6 20.5)" />
        <rect x="42.8" y="15" width="3.2" height="11" rx="1.6" transform="rotate(30 44.4 20.5)" />
      </g>
      <circle cx="23" cy="37" r="2.8" fill="#3DDC84" />
      <circle cx="41" cy="37" r="2.8" fill="#3DDC84" />
    </svg>
  );
}

const ETAPES = [
  ['Téléchargez', 'le fichier BestaSolar.apk avec le bouton ci-dessus.'],
  ['Installez', 'en ouvrant le fichier. Si Android le demande, autorisez l’installation depuis votre navigateur — c’est normal pour une application hors Play Store.'],
  ['Connectez-vous', 'avec votre compte habituel : vous retrouvez vos clients, devis et kits.'],
];

const dateFr = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
};

export default function LandingApplication() {
  const [release, setRelease] = useState(null);
  useEffect(() => {
    let actif = true;
    derniereReleaseAndroid().then((r) => { if (actif) setRelease(r); });
    return () => { actif = false; };
  }, []);

  const infos = release
    ? [release.version && `Version ${release.version}`, `build ${release.build}`, tailleLisible(release.tailleOctets), release.date && `mise à jour le ${dateFr(release.date)}`].filter(Boolean).join(' · ')
    : '';

  return (
    <section id="application" style={{ background: '#f4f7fb' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(48px, 6vw, 88px) clamp(20px, 5vw, 48px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 'clamp(28px, 4vw, 56px)', alignItems: 'center' }}>
        <div>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b87400', marginBottom: '14px' }}>Application mobile</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <LogoAndroid />
            <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', lineHeight: '1.12', fontWeight: '800', letterSpacing: '-0.012em', margin: '0' }}>BestaSolar Pro sur Android</h2>
          </div>
          <p style={{ fontSize: '1.0625rem', lineHeight: '1.65', color: '#4a5568', margin: '0 0 22px' }}>
            Installez l’application sur votre téléphone, directement depuis cette page : un simple fichier APK,
            sans passer par le Play Store. Les mêmes données qu’en ligne, utilisables même sans connexion sur
            le chantier — et l’application vous prévient d’elle-même à chaque nouvelle version.
          </p>
          <a href={CHEMIN_TELECHARGEMENT} download="BestaSolar.apk" className="lp-h3"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '16px 28px', borderRadius: '8px', background: '#0c3483', color: '#ffffff', fontWeight: '700', fontSize: '1.0625rem', textDecoration: 'none', boxShadow: '0 6px 16px rgba(12,52,131,.25)' }}>
            <Download size={20} /> Télécharger l’APK Android
          </a>
          <div style={{ marginTop: '12px', fontSize: '0.875rem', color: '#6b7280' }}>
            {infos || 'Dernière version'} · Android 7 ou plus récent · gratuit
          </div>
        </div>

        <ol style={{ listStyle: 'none', margin: '0', padding: '0', display: 'grid', gap: '14px' }}>
          {ETAPES.map(([titre, texte], i) => (
            <li key={titre} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', background: '#ffffff', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 2px rgba(0,23,68,.05),0 6px 18px rgba(0,23,68,.05)' }}>
              <span style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%', background: '#0c3483', color: '#ffffff', display: 'grid', placeItems: 'center', fontWeight: '700' }}>{i + 1}</span>
              <span style={{ lineHeight: '1.55', color: '#4a5568' }}><strong style={{ color: '#0f172a' }}>{titre}</strong> {texte}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
