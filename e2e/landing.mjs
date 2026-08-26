/* Page publique d'accueil : elle s'affiche pour un visiteur non connecté,
   ses deux mécaniques (onglets des schémas, accordéon FAQ) répondent, et les
   appels à l'action mènent bien à l'inscription. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const jsErr = [];
const B = 'http://127.0.0.1:3000';

const page = await nav.newPage({ viewport: { width: 1366, height: 900 } });
page.on('pageerror', (e) => jsErr.push(String(e)));
// Les polices Google sont bloquées dans l'environnement de test : ces
// échecs de chargement réseau ne sont pas des erreurs de l'application.
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (/net::ERR_|Failed to load resource/.test(m.text())) return;
  jsErr.push('console: ' + m.text());
});

// ---- 1. LE VISITEUR ARRIVE SUR LA VITRINE, PAS SUR LE FORMULAIRE ----
await page.goto(B + '/');
await page.waitForSelector('.landing', { timeout: 15000 });
ok(await page.locator('h1').first().innerText() === 'Vendez plus de solaire, sans perdre un seul client en route.',
   'la promesse du bandeau est affichée');
ok(await page.locator('.login-form-title, input[type="password"]').count() === 0,
   'le formulaire de connexion ne s’affiche pas à la racine');
ok(await page.locator('img[src="/besta-solar-pro-logo.png"]').count() === 1, 'logo d’en-tête chargé');

// Les sections attendues sont toutes là.
for (const id of ['accueil', 'conseiller', 'schemas', 'avantages', 'tarifs', 'carriere', 'faq']) {
  ok(await page.locator(`#${id}`).count() === 1, `section #${id} présente`);
}

// ---- 2. ONGLETS DES SCHÉMAS ----
const panneauVisible = () => page.evaluate(() => {
  const t = document.querySelector('#schemas');
  const p = Array.from(t.querySelectorAll('div')).filter((d) => d.style.display === 'block');
  return p.length;
});
ok(await panneauVisible() === 1, 'un seul schéma visible au départ');
ok(await page.locator('button:has-text("Système hybride")').count() === 1, 'onglet « Système hybride » présent');
const avant = await page.locator('#schemas').innerText();
await page.locator('button:has-text("Pompage solaire")').click();
await page.waitForTimeout(250);
const apres = await page.locator('#schemas').innerText();
ok(avant !== apres, 'changer d’onglet change le schéma affiché');
ok(apres.includes('Pompe immergée'), 'le schéma « Pompage » montre bien la pompe');
ok(await panneauVisible() === 1, 'toujours un seul schéma visible après bascule');

// ---- 3. ACCORDÉON FAQ ----
const q2 = page.locator('#faq button').nth(1);
const rep2 = () => page.evaluate(() => {
  const b = document.querySelectorAll('#faq button')[1];
  return b.parentElement.querySelector('div[style*="max-height"]')?.style.maxHeight;
});
ok(await rep2() === '0px', 'la 2e question est fermée au départ');
await q2.click();
await page.waitForTimeout(450);
ok(await rep2() === '360px', 'cliquer ouvre la réponse');
await q2.click();
await page.waitForTimeout(450);
ok(await rep2() === '0px', 'recliquer la referme');

// ---- 4. LES APPELS À L'ACTION MÈNENT À L'INSCRIPTION ----
await page.locator('a:has-text("Démarrer maintenant")').first().click();
await page.waitForTimeout(600);
ok(page.url().endsWith('/inscription'), `le CTA mène à /inscription (${page.url()})`);
ok(await page.locator('input, .login-card, form').count() > 0, 'la page d’entrée est bien montée');

// ---- 5. LIEN LÉGAL ----
await page.goto(B + '/');
await page.waitForSelector('.landing');
ok(await page.locator('a[href="/privacy.html"]').count() === 1,
   'le lien « Mentions légales » pointe vers la page de confidentialité, pas la FAQ');

// ---- 6. UN LIEN DE PARRAINAGE OUVRE DIRECTEMENT L'INSCRIPTION ----
// L'affilié envoie son lien pour faire créer un compte : la vitrine
// s'intercalait entre le clic et le formulaire.
const vierge = await nav.newPage({ viewport: { width: 1366, height: 900 } });
await vierge.goto(B + '/?ref=BESTA-SIDDIK');
await vierge.waitForTimeout(1200);
const contenu = await vierge.locator('body').innerText();
ok(!contenu.includes('Vendez plus de solaire'), 'lien de parrainage : la vitrine ne s’intercale pas');
ok(/Créer mon compte|Code partenaire|Se connecter/.test(contenu), 'lien de parrainage : le formulaire est ouvert');
// …mais un retour ORDINAIRE, sans le paramètre, revoit bien la vitrine.
await vierge.goto(B + '/');
await vierge.waitForSelector('.landing', { timeout: 10000 });
ok(await vierge.locator('h1').first().innerText().then((t) => t.startsWith('Vendez plus')),
   'retour ordinaire : la vitrine s’affiche malgré l’attribution enregistrée');
await vierge.close();

// ---- 7. MOBILE : AUCUN DÉBORDEMENT HORIZONTAL ----
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(debord <= 1, `pas de défilement horizontal sur mobile (débordement ${debord}px)`);

// ---- 8. AUCUNE ERREUR JS ----
ok(jsErr.length === 0, `aucune erreur JS${jsErr.length ? ' — ' + jsErr.slice(0, 3).join(' | ') : ''}`);

console.log(R.join('\n'));
await nav.close();
process.exit(R.some((l) => l.startsWith('❌')) ? 1 : 0);
