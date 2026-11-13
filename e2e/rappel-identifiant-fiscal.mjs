/* Espace Pro, « Devis & Factures » : le rappel d'identifiant fiscal porte le
   sigle et le pays de L'ENTREPRISE — IFU au Bénin, NIF au Togo, NCC en Côte
   d'Ivoire, NINEA au Sénégal… — et non plus « NIF … au Togo » pour tous.
   Il disparaît une fois l'identifiant renseigné. Lancer `npm run dev` à côté. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };
const plat = (t) => t.replace(/[\s  ]+/g, ' ').trim();

const ctx = await nav.newContext({ viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
await page.goto(B + '/privacy.html');
await page.evaluate((u) => {
  localStorage.setItem('bestasolar_user', JSON.stringify(u));
  localStorage.setItem(`bestasolar_guide_accueil_v1:${u.id}`, 'termine');
}, GERANT);
await page.goto(B + '/dashboard'); await page.locator('.tab-bar').waitFor({ timeout: 15000 }); await page.waitForTimeout(1000);

/** L'entreprise de l'abonné, dans tel pays, avec ou sans identifiant fiscal. */
const entreprise = async (pays, ifu = '') => {
  await page.goto(B + '/privacy.html');
  await page.evaluate(({ pays, ifu }) => {
    const s = JSON.parse(localStorage.getItem('bestasolar_data'));
    const maintenant = new Date().toISOString();
    s.subscriptions = [{ id: 'sub', userId: 'u1', status: 'actif', formule: 'essentiel', dateDebut: maintenant, dateFin: new Date(Date.now() + 30 * 864e5).toISOString() }];
    s.companies = [{ id: 'comp-u1', userId: 'u1', nomEntreprise: 'Lumière Sans Facture', pays, ifu }];
    localStorage.setItem('bestasolar_data', JSON.stringify(s));
    localStorage.setItem('bestasolar_mode_u1', 'pro');
  }, { pays, ifu });
  await page.goto(B + '/pro/documents');
  await page.getByRole('button', { name: /Nouveau devis/ }).first().waitFor({ timeout: 15000 });
};
const rappel = page.locator('.rappel-identifiant-fiscal');

const CAS = [
  ['bj', 'IFU', 'au Bénin'],
  ['tg', 'NIF', 'au Togo'],
  ['ci', 'NCC', 'en Côte d’Ivoire'],
  ['sn', 'NINEA', 'au Sénégal'],
  ['cm', 'NIU', 'au Cameroun'],
];
for (const [pays, sigle, dans] of CAS) {
  await entreprise(pays);
  const texte = plat(await rappel.innerText());
  ok(texte.startsWith(`Vos factures ne portent pas votre ${sigle}. Il est obligatoire sur une facture ${dans} — renseignez-le dans « Mon entreprise ».`),
    `${pays} : « ${texte.split(' — ')[0]} »`);
  if (pays === 'bj') {
    await rappel.screenshot({ path: (process.env.CAPTURES || '/tmp') + '/rappel-identifiant-fiscal.png' });
    // « Renseigner » mène au champ du même nom dans « Mon entreprise ».
    await rappel.getByRole('button', { name: 'Renseigner' }).click();
    await page.waitForURL('**/pro/entreprise');
    const champ = page.getByLabel('IFU (optionnel)');
    const vu = await champ.waitFor({ timeout: 10000 }).then(() => true, () => false);
    ok(vu, '« Renseigner » ouvre « Mon entreprise », où le champ s’appelle aussi IFU');
  }
}
ok(!/\bNIF\b|Togo/.test(plat(await (async () => { await entreprise('bj'); return rappel.innerText(); })())), 'entreprise au Bénin : ni « NIF » ni « Togo » dans le rappel');

await entreprise('bj', '3202412345678');
ok(await rappel.count() === 0, 'identifiant renseigné : le rappel disparaît');

console.log(R.join('\n'));
await nav.close();
process.exit(R.some((l) => l.startsWith('❌')) ? 1 : 0);
