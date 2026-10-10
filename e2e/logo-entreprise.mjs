/* Logo de l'entreprise Pro : importé, il est rogné de ses marges vides et
   garde sa transparence (PNG) ; un logo enregistré avant ce traitement est
   recadré une fois, à l'ouverture de « Mon entreprise » ; sur la facture, il
   prend une taille selon ses proportions (un sigle carré : 80 × 80 au lieu
   de 32 × 32), sans faire déborder la page.
   Serveur : npm run dev */
import { chromium } from '@playwright/test';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };

const ctx = await nav.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
await page.goto(B + '/privacy.html');

// Deux logos d'essai : un sigle carré au milieu de grandes marges transparentes
// (PNG), et un logo JPEG sur fond blanc avec des marges.
const [pngMarges, jpegMarges] = await page.evaluate(() => {
  const dessin = (type) => {
    const c = document.createElement('canvas'); c.width = 600; c.height = 600; const x = c.getContext('2d');
    if (type === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, 600, 600); }
    x.fillStyle = '#1b3a8f'; x.fillRect(200, 220, 200, 160); // le dessin : 200 × 160 au centre
    x.fillStyle = '#e02020'; x.fillRect(240, 260, 120, 30);
    return c.toDataURL(type, 0.92);
  };
  return [dessin('image/png'), dessin('image/jpeg')];
});
const dossier = mkdtempSync(join(tmpdir(), 'logo-'));
const fichierPng = join(dossier, 'logo-marges.png');
writeFileSync(fichierPng, Buffer.from(pngMarges.split(',')[1], 'base64'));

await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
await page.goto(B + '/dashboard'); await page.locator('.tab-bar').waitFor(); await page.waitForTimeout(1200);
const preparer = async (logo) => {
  await page.goto(B + '/privacy.html');
  await page.evaluate((logo) => {
    const s = JSON.parse(localStorage.getItem('bestasolar_data'));
    const maintenant = new Date().toISOString();
    s.subscriptions = [{ id: 'sub-e2e', userId: 'u1', status: 'actif', formule: 'essentiel', dateDebut: maintenant, dateFin: new Date(Date.now() + 30 * 864e5).toISOString() }];
    s.companies = [{ id: 'comp-u1', userId: 'u1', facturePrefix: 'FAC', factureCounter: 0, nomEntreprise: 'ORT Bâtiment', telephone: '+228 90 00 00 00', adresse: 'Lomé', modeleDefaut: 'studio', pays: 'tg', ...(logo ? { logo } : {}) }];
    localStorage.setItem('bestasolar_data', JSON.stringify(s));
    localStorage.setItem('bestasolar_mode_u1', 'pro');
  }, logo);
};
const entreprise = () => page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')).companies.find((c) => c.userId === 'u1'));
const dims = (logo) => page.evaluate(async (logo) => (await import('/src/utils/logo.js')).dimensionsImage(logo), logo);

// ---- 1. Import d'un logo à marges transparentes ----
await preparer(null);
await page.goto(B + '/pro/entreprise');
await page.locator('.photo-input').waitFor({ state: 'attached', timeout: 15000 });
await page.locator('.photo-input').setInputFiles(fichierPng);
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Enregistrer' }).click(); await page.waitForTimeout(800);
let c = await entreprise();
let d = await dims(c?.logo || '');
ok(c?.logo?.startsWith('data:image/png') && c.logoAjuste === true, `logo importé en PNG, marqué ajusté [${(c?.logo || '').slice(0, 22)}…]`);
ok(d && Math.abs(d.largeur / d.hauteur - 200 / 160) < 0.08, `marges rognées : le dessin 200 × 160 remplit l’image [${d?.largeur} × ${d?.hauteur}]`);
const transparent = await page.evaluate(async (logo) => {
  const img = new Image(); img.src = logo; await img.decode();
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
  return x.getImageData(0, 0, 1, 1).data[3];
}, c.logo);
ok(transparent < 20, `transparence gardée (coin alpha = ${transparent})`);
const vignette = await page.locator('.fp-logo').first().evaluate((i) => `${Math.round(i.getBoundingClientRect().width)}×${Math.round(i.getBoundingClientRect().height)}`).catch(() => '');
ok(/^(\d+)×(\d+)$/.test(vignette) && Number(vignette.split('×')[0]) > 34, `aperçu en direct : logo à ses proportions [${vignette}]`);

// Sur la facture : 80 px de haut au plus, proportions respectées, page sans débordement.
await page.getByRole('button', { name: /Voir un aperçu du document/ }).click();
const cadre = page.frameLocator('.apercu-doc-cadre');
await cadre.locator('.page img').first().waitFor({ timeout: 15000 });
const facture = await page.locator('.apercu-doc-cadre').evaluate((f) => {
  const doc = f.contentDocument; const img = doc.querySelector('.page img'); const pg = doc.querySelector('.page');
  return { largeur: parseFloat(img.style.width), hauteur: parseFloat(img.style.height), deborde: pg.scrollHeight > pg.clientHeight + 1 };
});
ok(facture.hauteur > 32 && facture.hauteur <= 80 && Math.abs(facture.largeur / facture.hauteur - d.largeur / d.hauteur) < 0.1, `facture : logo ${facture.largeur} × ${facture.hauteur} px (au lieu de 32 px de haut)`);
ok(!facture.deborde, 'facture : la page ne déborde pas');
await page.screenshot({ path: '/tmp/claude-0/logo-facture.png' });
await page.getByRole('button', { name: 'Retour' }).click(); await page.waitForTimeout(300);

// ---- 2. Logo enregistré avant : recadré à l'ouverture ----
await preparer(jpegMarges);
await page.goto(B + '/pro/entreprise');
const annonce = await page.locator('.toast', { hasText: 'logo' }).first().innerText({ timeout: 15000 }).catch(() => '');
await page.waitForTimeout(800);
c = await entreprise();
d = await dims(c?.logo || '');
ok(/recadré/.test(annonce), `ancien logo : recadré et annoncé [« ${annonce} »]`);
ok(c?.logoAjuste === true && d && Math.abs(d.largeur / d.hauteur - 200 / 160) < 0.08, `ancien logo JPEG à fond blanc : marges retirées [${d?.largeur} × ${d?.hauteur}]`);
await page.goto(B + '/pro/documents'); await page.goto(B + '/pro/entreprise'); await page.waitForTimeout(1200);
ok(await page.locator('.toast', { hasText: 'recadré' }).count() === 0, 'une seule fois : pas de nouveau recadrage à la visite suivante');

await nav.close();
console.log(R.join('\n'));
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : `\n✅ Logo : rogné, transparent, à sa juste taille (${R.length} vérifications)`);
process.exit(echecs ? 1 : 0);
