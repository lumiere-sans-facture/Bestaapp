/* Simulateur ROI : le gain net se lit poste par poste.
   Économies sur la durée − prix de l'installation − entretien −
   remplacement de l'onduleur (tous les 5 ans, au prix de celui du kit,
   comme la fiche de dimensionnement) = gain net, au franc près, et c'est le
   gain de la tuile. Sur 10 ans un remplacement, sur 15 ans deux, sur 25 ans
   quatre. Lancer `npm run dev` à côté. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };
const plat = (t) => t.replace(/[\s  ]+/g, ' ').trim();
const montant = (t) => Number(plat(t).replace(/ F$/, '').replace('−', '-').replace(/ /g, ''));

const ctx = await nav.newContext({ viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
await page.goto(B + '/privacy.html');
await page.evaluate((u) => {
  localStorage.setItem('bestasolar_user', JSON.stringify(u));
  localStorage.setItem(`bestasolar_guide_accueil_v1:${u.id}`, 'termine');
}, GERANT);
await page.goto(B + '/plus/roi');
const bilan = page.locator('.roi-bilan');
await bilan.waitFor({ timeout: 15000 });

/** Les lignes du bilan : { label, detail, montant }. */
const lireBilan = async () => bilan.locator('.roi-ligne').evaluateAll((lignes) => lignes.map((l) => ({
  label: l.querySelector('.roi-ligne-label')?.firstChild?.textContent || '',
  detail: l.querySelector('.roi-ligne-detail')?.textContent || '',
  montant: l.querySelector('.roi-ligne-montant')?.textContent || '',
})));

const ATTENDU = { 10: [5], 15: [5, 10], 25: [5, 10, 15, 20] };
for (const duree of [25, 10, 15]) {
  await page.getByRole('button', { name: `${duree} ans`, exact: true }).click();
  await page.waitForTimeout(300);
  const lignes = await lireBilan();
  const par = (debut) => lignes.find((l) => l.label.startsWith(debut));
  const eco = par('Économies'); const inst = par('Prix de l'); const entr = par('Entretien');
  const ond = par('Remplacement de l'); const gain = par('Gain net');
  if (!ok(eco && inst && entr && ond && gain, `${duree} ans : le bilan a ses cinq lignes [${lignes.map((l) => l.label).join(' | ')}]`)) continue;
  const [e, i, m, o, g] = [eco, inst, entr, ond, gain].map((l) => montant(l.montant));
  ok(i < 0 && m < 0 && o < 0 && e > 0, `${duree} ans : installation, entretien et onduleur sont déduits [${plat(inst.montant)} · ${plat(entr.montant)} · ${plat(ond.montant)}]`);
  ok(e + i + m + o === g, `${duree} ans : ${e} − ${-i} − ${-m} − ${-o} = ${g} (gain net, au franc près)`);
  const annees = ATTENDU[duree];
  const prix = -o / annees.length;
  ok(Number.isInteger(prix) && plat(ond.detail).includes(`${annees.length} × `) && plat(ond.detail).includes(`au bout de ${annees.length > 1 ? `${annees.slice(0, -1).join(', ')} et ${annees.at(-1)}` : annees[0]} ans`),
    `${duree} ans : ${annees.length} remplacement(s) de l’onduleur [${plat(ond.detail)}]`);
  // La tuile affiche le même gain, abrégé (« 12,3 M F »).
  const tuile = plat(await page.locator('.kpi-card.is-success .kpi-value').innerText());
  const tuileM = Number(tuile.replace(/ M F$/, '').replace(',', '.')) * 1e6;
  ok(Math.abs(tuileM - g) < 50001, `${duree} ans : la tuile « Gain net » reprend ce gain [${tuile}]`);
  ok(/^Gain net sur/.test(plat(await page.locator('.kpi-card.is-success .kpi-label').innerText())), `${duree} ans : la tuile dit « Gain net »`);
  const legende = plat(await page.locator('.roi-legende-onduleur').innerText());
  const attenduLegende = annees.length > 1 ? `Les creux : onduleur remplacé (années ${annees.join(', ')})` : `Le creux : onduleur remplacé (année ${annees[0]})`;
  ok(legende === attenduLegende, `${duree} ans : la courbe signale ${annees.length > 1 ? 'ses creux' : 'son creux'} [${legende}]`);
}

// Le prix de l'onduleur est celui du kit proposé (pas un forfait).
await page.locator('.roi-hypotheses summary').click();
const hypo = plat(await page.locator('.roi-hypotheses').innerText());
ok(/L’onduleur dure environ 5 ans : il est remplacé au bout de 5 et 10 ans, au prix de celui du kit \(\d[\d ]* F\)/.test(hypo), 'hypothèses : l’onduleur, sa durée de vie et son prix sont écrits');
await page.locator('.roi-bilan').scrollIntoViewIfNeeded();
await page.screenshot({ path: (process.env.CAPTURES || '/tmp') + '/simulateur-bilan.png', fullPage: false });

console.log(R.join('\n'));
await nav.close();
process.exit(R.some((l) => l.startsWith('❌')) ? 1 : 0);
