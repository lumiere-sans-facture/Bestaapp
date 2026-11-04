/* Application Android : le bouton « retour » ne fait plus quitter l'app
   depuis n'importe quel écran. Il ferme d'abord la fenêtre ouverte, ramène
   ensuite à la page d'accueil (tableau de bord, ou celui de l'espace Pro,
   ou l'écran de connexion sans compte), et ne fait quitter que depuis
   l'accueil. Sur le web, il n'est pas intercepté.
   Le téléphone est simulé par le pont natif de Capacitor lui-même : le
   module App y est déclaré, ses appels sont captés et le bouton « retour »
   est pressé en appelant l'écouteur que l'app a enregistré.
   Lancer `npm run dev` à côté. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };

/** Pont natif simulé : le module App existe, ses écouteurs et appels sont relevés. */
const pontNatif = (android) => {
  if (android) window.CapacitorCustomPlatform = { name: 'android', plugins: {} };
  const ecouteurs = new Map(); let n = 0;
  window.__natif = { ecouteurs, appels: [] };
  window.Capacitor = {
    PluginHeaders: [{ name: 'App', methods: [
      { name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' },
      { name: 'minimizeApp', rtype: 'promise' }, { name: 'exitApp', rtype: 'promise' },
    ] }],
    nativeCallback: (plugin, methode, options, rappel) => {
      n += 1;
      if (plugin === 'App' && methode === 'addListener' && options?.eventName === 'backButton') ecouteurs.set(String(n), rappel);
      return Promise.resolve(String(n));
    },
    nativePromise: (plugin, methode, options) => {
      if (methode === 'removeListener') ecouteurs.delete(String(options?.callbackId));
      else window.__natif.appels.push(`${plugin}.${methode}`);
      return Promise.resolve();
    },
  };
};

const ouvrir = async ({ android = true, connecte = true, pro = false } = {}) => {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(pontNatif, android);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
  await page.goto(B + '/privacy.html');
  if (connecte) {
    await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
    await page.goto(B + '/dashboard'); await page.locator('.tab-bar').waitFor({ timeout: 15000 }); await page.waitForTimeout(1000);
    if (pro) {
      await page.goto(B + '/privacy.html');
      await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('bestasolar_data'));
        const maintenant = new Date().toISOString();
        s.subscriptions = [{ id: 'sub', userId: 'u1', status: 'actif', formule: 'essentiel', dateDebut: maintenant, dateFin: new Date(Date.now() + 30 * 864e5).toISOString() }];
        s.companies = [{ id: 'comp-u1', userId: 'u1', nomEntreprise: 'Lumière Sans Facture', pays: 'tg' }];
        localStorage.setItem('bestasolar_data', JSON.stringify(s));
        localStorage.setItem('bestasolar_mode_u1', 'pro');
      });
      await page.goto(B + '/pro'); await page.locator('.tab-bar').waitFor({ timeout: 15000 }); await page.waitForTimeout(800);
    }
  } else {
    await page.goto(B + '/'); await page.locator('form').first().waitFor({ timeout: 15000 });
  }
  return { ctx, page };
};

const chemin = (page) => new URL(page.url()).pathname;
const appels = (page) => page.evaluate(() => window.__natif.appels.slice());
const retour = async (page) => {
  const n = await page.evaluate(() => {
    const liste = [...window.__natif.ecouteurs.values()];
    liste.forEach((f) => f({ canGoBack: false }));
    return liste.length;
  });
  await page.waitForTimeout(500);
  return n;
};
const ongletBas = (page, nom) => page.locator('.tab-bar').getByRole('link', { name: nom }).first();

// 1. Espace public : un onglet → retour à l'accueil, puis on quitte.
{
  const { ctx, page } = await ouvrir();
  await ongletBas(page, 'Devis').click(); await page.waitForURL('**/devis');
  const n = await retour(page);
  ok(n === 1, `un seul écouteur du bouton retour enregistré [${n}]`);
  ok(chemin(page) === '/dashboard' && !(await appels(page)).length, `depuis « Devis », retour à l’accueil sans quitter [${chemin(page)}]`);
  await retour(page);
  ok((await appels(page)).join() === 'App.minimizeApp' && chemin(page) === '/dashboard', `depuis l’accueil, l’app se ferme [${(await appels(page)).join()}]`);

  // Écran profond (paramètres) : retour direct à l'accueil.
  await page.goto(B + '/plus/parametres'); await page.locator('.page-content').first().waitFor(); await page.waitForTimeout(600);
  await retour(page);
  ok(chemin(page) === '/dashboard', `depuis « Plus › Paramètres », retour à l’accueil [${chemin(page)}]`);

  // Une fenêtre ouverte se ferme d'abord, sans changer d'écran.
  await page.goto(B + '/clients'); await page.locator('.page-content').first().waitFor(); await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Nouveau client/ }).first().click();
  await page.getByRole('dialog', { name: 'Nouveau client' }).waitFor();
  const avant = (await appels(page)).length;
  await retour(page);
  ok(await page.getByRole('dialog').count() === 0 && chemin(page) === '/clients', `fenêtre « Nouveau client » fermée, on reste sur Clients [${chemin(page)}]`);
  await retour(page);
  ok(chemin(page) === '/dashboard' && (await appels(page)).length === avant, `puis retour à l’accueil, toujours sans quitter [${chemin(page)}]`);
  await ctx.close();
}

// 2. Espace Pro : son accueil est son tableau de bord.
{
  const { ctx, page } = await ouvrir({ pro: true });
  await ongletBas(page, /Devis|Documents/).click(); await page.waitForURL('**/pro/documents');
  await retour(page);
  ok(chemin(page) === '/pro' && !(await appels(page)).length, `espace Pro : depuis « Devis & Factures », retour à son accueil [${chemin(page)}]`);
  await retour(page);
  ok((await appels(page)).join() === 'App.minimizeApp', 'espace Pro : depuis son accueil, l’app se ferme');
  await ctx.close();
}

// 3. Sans compte : de l'inscription à l'écran de connexion, puis on quitte.
{
  const { ctx, page } = await ouvrir({ connecte: false });
  await page.goto(B + '/inscription'); await page.locator('form').first().waitFor(); await page.waitForTimeout(600);
  await retour(page);
  ok(chemin(page) === '/' && !(await appels(page)).length, `sans compte : depuis l’inscription, retour à l’écran d’entrée [${chemin(page)}]`);
  await retour(page);
  ok((await appels(page)).join() === 'App.minimizeApp', 'sans compte : depuis l’écran d’entrée, l’app se ferme');
  await ctx.close();
}

// 4. Sur le web, le bouton du navigateur n'est pas intercepté.
{
  const { ctx, page } = await ouvrir({ android: false });
  const n = await page.evaluate(() => window.__natif.ecouteurs.size);
  ok(n === 0, `site web : aucun écouteur du bouton retour [${n}]`);
  await ctx.close();
}

console.log(R.join('\n'));
await nav.close();
process.exit(R.some((l) => l.startsWith('❌')) ? 1 : 0);
