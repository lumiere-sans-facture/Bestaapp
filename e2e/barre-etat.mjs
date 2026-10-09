/* Barre d'état du téléphone (application Android, Android 15+) : l'app
   s'affiche dessous. Une bande bleue de sa hauteur est réservée en haut
   (--haut-securise) : le titre des pages commence SOUS la barre, le contenu
   qu'on fait défiler passe sous la bande, et les icônes passent en clair.
   Sur le web (et les Android plus anciens) : bande nulle, rien ne change.
   Capacitor est simulé : la hauteur est injectée comme il le fait
   (--safe-area-inset-top sur <html>) ; le style choisi pour les icônes se
   lit sur <html data-barre-etat> (l'appel natif lui-même n'existe que sur
   le téléphone).
   Serveur : npm run dev */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };
const BARRE = 32;

async function ouvrir({ android, barre }) {
  const ctx = await nav.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(({ android, barre }) => {
    if (android) window.CapacitorCustomPlatform = { name: 'android', plugins: {} };
    // Comme Capacitor : la hauteur arrive APRÈS le chargement de la page.
    if (barre) {
      document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
        document.documentElement.style.setProperty('--safe-area-inset-top', `${barre}px`);
      }, 300));
    }
  }, { android, barre });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
  return { ctx, page };
}

const mesures = (page) => page.evaluate(() => {
  const avant = getComputedStyle(document.body, '::before');
  const titre = document.querySelector('.page-header .page-title, .page-header h1');
  return {
    bande: parseFloat(avant.height) || 0,
    couleur: avant.backgroundColor,
    position: avant.position,
    titreHaut: titre ? titre.getBoundingClientRect().top : null,
    enteteHaut: document.querySelector('.page-header')?.getBoundingClientRect().top ?? null,
    defilement: document.scrollingElement.scrollHeight - window.innerHeight,
    style: document.documentElement.dataset.barreEtat || null,
  };
});

// --- Android 15+ : tableau de bord ------------------------------------------
{
  const { ctx, page } = await ouvrir({ android: true, barre: BARRE });
  await page.goto(B + '/');
  await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
  await page.goto(B + '/'); await page.waitForTimeout(2500);
  const m = await mesures(page);
  ok(m.bande === BARRE && m.position === 'fixed' && m.couleur === 'rgb(10, 36, 114)', `bande bleue fixe de la hauteur de la barre [${m.bande}px, ${m.position}, ${m.couleur}]`);
  ok(m.enteteHaut >= BARRE && m.titreHaut >= BARRE + 8, `le titre commence sous la barre d’état [en-tête ${m.enteteHaut}px, titre ${Math.round(m.titreHaut)}px]`);
  ok(m.style === 'DARK', `icônes de la barre d’état passées en clair [${m.style}]`);
  await page.screenshot({ path: '/tmp/claude-0/barre-android-haut.png', clip: { x: 0, y: 0, width: 412, height: 260 } });
  await page.mouse.wheel(0, 400); await page.waitForTimeout(600);
  const apres = await mesures(page);
  ok(apres.bande === BARRE, 'après défilement, la bande reste en place');
  await page.screenshot({ path: '/tmp/claude-0/barre-android-defile.png', clip: { x: 0, y: 0, width: 412, height: 260 } });

  // Éditeur de devis plein écran : son en-tête démarre aussi sous la bande.
  const editeur = await page.evaluate(() => {
    const s = document.createElement('div'); s.className = 'sheet quote-editor-sheet';
    const h = document.createElement('div'); h.className = 'sheet-header'; s.appendChild(h);
    document.body.appendChild(s);
    const p = getComputedStyle(h).paddingTop; s.remove(); return p;
  });
  ok(editeur === `${12 + BARRE}px`, `éditeur de devis plein écran : en-tête sous la bande [${editeur}]`);
  await ctx.close();
}

// --- Android 15+ : écran de connexion, aucune hauteur en trop ---------------
{
  const { ctx, page } = await ouvrir({ android: true, barre: BARRE });
  await page.goto(B + '/connexion'); await page.waitForTimeout(2000);
  const m = await mesures(page);
  ok(m.bande === BARRE && m.defilement <= 1, `connexion : bande réservée, pas de défilement vertical ajouté [${m.defilement}px]`);
  await page.screenshot({ path: '/tmp/claude-0/barre-android-connexion.png', clip: { x: 0, y: 0, width: 412, height: 300 } });
  await ctx.close();
}

// --- Android plus ancien : Android garde sa barre, rien de réservé ----------
{
  const { ctx, page } = await ouvrir({ android: true, barre: 0 });
  await page.goto(B + '/connexion'); await page.waitForTimeout(1500);
  const m = await mesures(page);
  ok(m.bande === 0 && m.style === 'DEFAULT', `Android sans affichage sous la barre : bande nulle, icônes par défaut [${m.bande}px, ${m.style}]`);
  await ctx.close();
}

// --- Web : inchangé -----------------------------------------------------------
{
  const { ctx, page } = await ouvrir({ android: false, barre: 0 });
  await page.goto(B + '/');
  await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
  await page.goto(B + '/pipeline'); await page.waitForTimeout(2000);
  const m = await mesures(page);
  ok(m.bande === 0 && m.enteteHaut === 0 && m.style === null, `web : rien de réservé, en-tête collé en haut [bande ${m.bande}px, en-tête ${m.enteteHaut}px]`);
  await ctx.close();
}

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Barre d’état : espace réservé dans l’app, web inchangé');
process.exit(echecs ? 1 : 0);
