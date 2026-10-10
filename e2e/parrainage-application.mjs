/* Code partenaire transmis à l'application Android installée par un lien :
   /telecharger?ref=CODE ouvre une page qui copie « Code partenaire
   BestaSolar : CODE » puis lance le téléchargement de l'APK ; au premier
   lancement, l'app relit ce texte et retient le code (inscription ouverte,
   code prérempli). Une seule lecture, jamais sur une installation déjà
   utilisée. L'espace partenaire donne le lien de l'app, et dans l'app ses
   liens visent le site public, plus « localhost ».
   Serveur : npm run dev */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const URL_APK = 'https://github.com/lumiere-sans-facture/Bestaapp/releases/latest/download/BestaSolar.apk';
const CODE = 'KODJO-K8R4MZ';
const TEXTE = `Code partenaire BestaSolar : ${CODE}`;
const ANDROID = () => { window.CapacitorCustomPlatform = { name: 'android', plugins: {} }; };
const contexte = async (opts = {}) => {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ...opts });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: B });
  await ctx.route(URL_APK, (r) => r.fulfill({ status: 200, contentType: 'application/vnd.android.package-archive', body: 'apk' }));
  // Supabase simulé, s'il est configuré : aucune session, listes vides.
  await ctx.route('http://127.0.0.1:54321/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  return ctx;
};
const lireRef = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_ref') || 'null'));

// ---- 1. La page de téléchargement ----
let ctx = await contexte();
let page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
await page.goto(`${B}/telecharger?ref=kodjo-k8r4mz`);
await page.waitForURL(/\/telecharger\.html\?ref=/, { timeout: 10000 }).catch(() => {});
await page.locator('#code').waitFor({ timeout: 10000 });
ok(await page.locator('#code').innerText() === CODE, `/telecharger?ref=… : page du partenaire, code affiché [${await page.locator('#code').innerText()}]`);
ok(await page.locator('#web').getAttribute('href') === `/?ref=${CODE}`, 'lien « version web » au même code');
ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'page lisible sur mobile, sans débordement');
await page.screenshot({ path: '/tmp/claude-0/telecharger-page.png', fullPage: true });
const versApk = page.waitForRequest(URL_APK, { timeout: 10000 }).then(() => true).catch(() => false);
await page.locator('#telecharger').click();
ok(await versApk, 'le bouton lance le téléchargement de l’APK');
const copie = await page.evaluate(() => navigator.clipboard.readText()).catch((e) => `ERREUR ${e}`);
ok(copie === TEXTE, `presse-papiers : « ${copie} »`);

// Code absent ou douteux : téléchargement direct, rien de copié.
const p2 = await ctx.newPage();
const direct = p2.waitForRequest(URL_APK, { timeout: 10000 }).then(() => true).catch(() => false);
await p2.goto(`${B}/telecharger.html?ref=%3Cscript%3E`).catch(() => {});
ok(await direct, 'code invalide : téléchargement direct de l’APK');
await ctx.close();

// ---- 2. Premier lancement de l'app installée (Android simulé) ----
ctx = await contexte();
await ctx.addInitScript(ANDROID);
page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
await page.goto(B + '/privacy.html');
await page.evaluate((t) => navigator.clipboard.writeText(t), TEXTE);
await page.goto(B + '/');
await page.locator('.login-card, .login-container, form').first().waitFor({ timeout: 15000 });
let ref = await lireRef(page);
ok(ref?.code === CODE && ref.clickPending === true, `premier lancement : code repris du téléchargement [${ref?.code}]`);
ok(await page.evaluate(() => localStorage.getItem('bestasolar_parrainage_installation') !== null), 'lecture marquée faite');
// Inscription ouverte, code prérempli — visible seulement avec un Supabase
// simulé (VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=x) :
// sans backend, l'app n'a pas d'inscription.
const champ = page.locator('#signup-ref');
const supabaseSimule = await champ.count() > 0;
if (supabaseSimule) {
  ok(await champ.inputValue() === CODE, `inscription ouverte, code partenaire prérempli [${await champ.inputValue()}]`);
} else {
  R.push('· inscription non vérifiée (serveur lancé sans Supabase simulé)');
}
await page.screenshot({ path: '/tmp/claude-0/premier-lancement.png' });

// Deuxième lancement : plus de lecture, même si le presse-papiers change.
await page.evaluate(() => { localStorage.removeItem('bestasolar_ref'); return navigator.clipboard.writeText('Code partenaire BestaSolar : AUTRE-23XYZQ'); });
await page.reload(); await page.waitForTimeout(1500);
ok(await lireRef(page) === null, 'lancement suivant : le presse-papiers n’est plus lu');
await ctx.close();

// Mise à jour d'une app déjà utilisée : jamais de lecture.
ctx = await contexte();
await ctx.addInitScript(ANDROID);
page = await ctx.newPage();
await page.goto(B + '/privacy.html');
await page.evaluate((t) => {
  localStorage.setItem('bestasolar_user', JSON.stringify({ id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' }));
  return navigator.clipboard.writeText(t);
}, TEXTE);
await page.goto(B + '/'); await page.waitForTimeout(1500);
ok(await lireRef(page) === null && await page.evaluate(() => localStorage.getItem('bestasolar_parrainage_installation') === null), 'appareil déjà utilisé (mise à jour) : presse-papiers jamais lu');
await ctx.close();

// Navigateur : jamais de lecture.
ctx = await contexte();
page = await ctx.newPage();
await page.goto(B + '/privacy.html');
await page.evaluate((t) => navigator.clipboard.writeText(t), TEXTE);
await page.goto(B + '/'); await page.waitForTimeout(1500);
ok(await lireRef(page) === null, 'site web : presse-papiers jamais lu');
await ctx.close();

// ---- 3. Espace partenaire : le lien de l'app ----
const ETAT = {
  version: 5, leads: [], devis: [],
  partners: [{ id: 'p-user-u1', userId: 'u1', name: 'Adam Adébiyi', code: 'ADAM-K8R4MZ', status: 'actif', sponsorId: null, registeredAt: '2026-01-01' }],
  commissions: [], referrals: [], orders: [], products: [], formations: [], formationProgress: [],
  subscriptions: [], subscriptionPayments: [], companies: [], factures: [], proClients: [], devisCounter: 0, orderCounter: 0,
};
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam Adébiyi', role: 'gerant', phone: '+228', avatar: 'AA' };
// (Compte local : sans Supabase simulé seulement.)
for (const natif of supabaseSimule ? [] : [false, true]) {
  ctx = await contexte({ viewport: { width: 360, height: 800 } });
  if (natif) await ctx.addInitScript(ANDROID);
  page = await ctx.newPage();
  page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
  await page.goto(B + '/privacy.html');
  await page.evaluate(([e, u]) => {
    localStorage.setItem('bestasolar_data', JSON.stringify(e));
    localStorage.setItem('bestasolar_user', JSON.stringify(u));
  }, [ETAT, GERANT]);
  await page.goto(B + '/plus/mypartner');
  const boite = page.locator('.my-affiliate-box');
  await boite.waitFor({ timeout: 15000 });
  const liens = (await boite.locator('.affiliate-link').allInnerTexts()).map((t) => t.match(/https?:\/\/\S+/)?.[0]);
  const origine = natif ? 'https://app.bestasolar.com' : B;
  ok(liens[0] === `${origine}/?ref=ADAM-K8R4MZ` && liens[1] === `${origine}/telecharger?ref=ADAM-K8R4MZ`,
    `${natif ? 'app Android' : 'navigateur'} : liens site + app [${liens.join(' | ')}]`);
  if (!natif) {
    await boite.getByRole('button', { name: 'Lien de l’app' }).click();
    await page.waitForTimeout(300);
    ok(await page.evaluate(() => navigator.clipboard.readText()) === `${B}/telecharger?ref=ADAM-K8R4MZ` && await boite.getByRole('button', { name: 'Copié !' }).count() === 1, '« Lien de l’app » copié');
    // (wa.me intercepté : on lit l'adresse que l'app ouvrirait.)
    await page.evaluate(() => { window.__ouvert = []; window.open = (u) => { window.__ouvert.push(u); return null; }; });
    await boite.getByRole('button', { name: /Partager WhatsApp/ }).click();
    const adresse = await page.evaluate(() => window.__ouvert[0] || '');
    const texte = adresse ? new URL(adresse).searchParams.get('text') || '' : '';
    ok(texte.includes('/telecharger?ref=ADAM-K8R4MZ') && texte.includes('/?ref=ADAM-K8R4MZ'), 'message WhatsApp : lien du site ET lien de l’app');
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'boîte lisible sur 360 px');
    await boite.screenshot({ path: '/tmp/claude-0/liens-parrainage.png' });
  }
  await ctx.close();
}

if (supabaseSimule) R.push('· espace partenaire non vérifié ici (compte local : serveur sans Supabase simulé)');
await nav.close();
console.log(R.join('\n'));
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : `\n✅ Parrainage transmis à l’application (${R.length} vérifications)`);
process.exit(echecs ? 1 : 0);
