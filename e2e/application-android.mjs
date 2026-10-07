/* Page d'accueil : section « Application Android » — logo Android (pas le
   Play Store), téléchargement direct de l'APK à l'adresse fixe de la
   dernière Release, version / taille / date lues sur GitHub (simulé ici).
   Si le serveur a été lancé avec VITE_ANDROID_BUILD (ex. 5), vérifie aussi
   le bandeau « Nouvelle version » de l'app installée (Capacitor simulé).
   Lancer `npm run dev` à côté. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const URL_APK = 'https://github.com/lumiere-sans-facture/Bestaapp/releases/latest/download/BestaSolar.apk';
const RELEASE = { tag_name: 'android-245', name: 'BestaSolar Android 1.1.0 (build 245)', published_at: '2026-10-07T16:00:00Z', assets: [{ name: 'BestaSolar.apk', size: 8808038 }] };
const simulerGithub = (ctx) => ctx.route('https://api.github.com/repos/lumiere-sans-facture/Bestaapp/releases/latest', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RELEASE) }));

const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await simulerGithub(ctx);
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
await page.goto(B + '/');
const section = page.locator('#application');
await section.waitFor({ timeout: 15000 });
await section.scrollIntoViewIfNeeded(); await page.waitForTimeout(800);
const texte = (await section.innerText()).replace(/\s+/g, ' ');
ok(await section.locator('svg[aria-label="Android"]').count() === 1, 'logo Android affiché');
ok(/sans passer par le Play Store/.test(texte) && !/Disponible sur Google Play|Google Play Store/.test(texte), 'APK direct, sans badge Play Store');
ok(await section.locator(`a[href="${URL_APK}"]`).count() === 1, 'bouton « Télécharger l’APK » vers la dernière Release');
ok(/Version 1\.1\.0 · build 245 · 8,4 Mo · mise à jour le 7 octobre 2026/.test(texte), `version, taille et date lues sur GitHub [${/Version[^·]*·[^·]*·[^·]*·[^·]*/.exec(texte)?.[0]}]`);
ok(await page.locator('a[href="#application"]').count() >= 1, 'lien « Application » dans le menu de la page d’accueil');
ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'section lisible sur mobile, sans débordement');
await section.screenshot({ path: '/tmp/claude-0/application-android.png' });
await ctx.close();

// Bandeau de mise à jour (seulement si l'app a un numéro de build).
const ctx2 = await nav.newContext({ viewport: { width: 390, height: 844 } });
await simulerGithub(ctx2);
await ctx2.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true }; });
const p2 = await ctx2.newPage();
await p2.goto(B + '/privacy.html');
await p2.evaluate(() => localStorage.setItem('bestasolar_user', JSON.stringify({ id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' })));
await p2.goto(B + '/dashboard'); await p2.waitForTimeout(2500);
const bandeau = p2.locator('[role="status"]', { hasText: 'Nouvelle version' });
if (await bandeau.count()) {
  ok(await bandeau.locator(`a[href="${URL_APK}"]`).count() === 1, `app installée plus ancienne : bandeau de mise à jour [${(await bandeau.innerText()).replace(/\s+/g, ' ')}]`);
  await bandeau.screenshot({ path: '/tmp/claude-0/bandeau-maj.png' });
} else {
  R.push('· bandeau non vérifié (serveur lancé sans VITE_ANDROID_BUILD)');
}
await ctx2.close();

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Application Android : APK téléchargeable depuis l’accueil');
process.exit(echecs ? 1 : 0);
