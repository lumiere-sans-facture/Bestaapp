/* Maintenance annuelle : une règle unique (utils/maintenance.js) —
   30 000 F sous 10 panneaux, 50 000 F + 2 000 F par panneau au-delà.
   Un même système donne la MÊME maintenance dans la fiche de
   dimensionnement et dans le simulateur ROI : un devis solaire est créé
   (deux climatiseurs 3 CV, plus de 10 panneaux), sa fiche est produite,
   puis le simulateur reprend l'étude de ce devis. Seul le montant
   s'affiche : la règle de calcul n'est écrite nulle part à l'écran.
   Serveur : npm run dev */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };
const regle = (n) => (n < 10 ? 30000 : 50000 + 2000 * (n - 10));
const chiffres = (t) => Number(String(t).replace(/[^\d]/g, ''));

const c = await nav.newContext({ viewport: { width: 1280, height: 950 }, acceptDownloads: true });
// Les données remises au moteur de la fiche sont relevées au passage.
await c.route(/\/src\/utils\/sizingSheet\/pdf\.js/, async (route) => {
  const reponse = await route.fetch();
  const source = (await reponse.text()).replace(
    /export async function construireFichePdf\(data, options = \{\}\) \{/,
    '$&\n  window.__fiches = [...(window.__fiches || []), JSON.parse(JSON.stringify(data))];',
  );
  await route.fulfill({ response: reponse, body: source });
});
const p = await c.newPage();
p.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
await p.goto(B + '/privacy.html');
await p.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);

// ---- 1. Devis solaire : deux climatiseurs 3 CV ----
const suivant = () => p.locator('button:has-text("Suivant")').first();
await p.goto(B + '/devis'); await p.waitForTimeout(1800);
await p.locator('button:has-text("Créer un devis"), button:has-text("Nouveau devis")').first().click(); await p.waitForTimeout(900);
await p.locator(':text("Dimensionnement solaire")').first().click(); await p.waitForTimeout(1000);
await p.locator('.page-content button').nth(1).click(); await p.waitForTimeout(400);
await suivant().click(); await p.waitForTimeout(900);
const ajouter = async (etiquette) => {
  const select = p.locator('select').first();
  const val = await select.evaluate((el, lbl) => [...el.options].find((x) => x.text.includes(lbl))?.value || '', etiquette);
  await select.selectOption(val); await p.waitForTimeout(300);
  await p.locator('.wizard-form button.btn-primary').first().click(); await p.waitForTimeout(500);
};
await ajouter('Climatiseur 3 CV');
await ajouter('Climatiseur 3 CV');
await suivant().click(); await p.waitForTimeout(900);
await suivant().click(); await p.waitForTimeout(1600);
await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.locator('button:has-text("Fiche de dimensionnement (PDF)")').click()]);
const fiche = await p.evaluate(async () => {
  const data = window.__fiches.at(-1);
  const [{ buildSizingSheetHtml }, { computeSheet }] = await Promise.all([import('/src/utils/sizingSheet/index.js'), import('/src/utils/sizingSheet/compute.js')]);
  const html = buildSizingSheetHtml(data);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const ligne = [...doc.querySelectorAll('tr')].find((tr) => /Maintenance \(/.test(tr.textContent));
  return { n: data.sizing.numberOfPanels, renta: computeSheet(data).renta.maintenanceAnnuelle, texte: ligne?.cells[0].innerText.replace(/\s+/g, ' ').trim() || '' };
});
const nFiche = fiche.n;
ok(nFiche >= 10 && fiche.renta === regle(nFiche), `fiche : ${nFiche} panneaux → ${fiche.renta} F/an (règle : ${regle(nFiche)})`);
const texteFiche = fiche.texte.replace(/[\u202f\u00a0]/g, ' ');
ok(texteFiche === `Maintenance (${regle(nFiche).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ')} F CFA/an dès la 2ᵉ année)`,
  `fiche imprimée : le montant seul, sans la règle [« ${texteFiche} »]`);
await p.locator('button:has-text("Créer le devis")').first().click(); await p.waitForTimeout(2000);
const devis = await p.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')).devis.find((d) => d.type === 'solar'));

// ---- 2. Simulateur ROI : l'étude du même devis ----
await p.goto(B + '/plus/roi'); await p.locator('#roi-etude').waitFor({ timeout: 15000 });
const option = await p.locator('#roi-etude option', { hasText: devis.devisNumber }).getAttribute('value');
await p.locator('#roi-etude').selectOption(option); await p.waitForTimeout(1200);
const entretien = p.locator('.roi-ligne', { hasText: 'Entretien de l’installation' });
const montant = chiffres(await entretien.locator('.roi-ligne-montant').innerText());
const nSimu = Number(/(\d+) panneaux/.exec(await p.locator('.roi-kit-spec').innerText())?.[1] || 0);
ok(nSimu === nFiche, `même système : ${nSimu} panneaux au simulateur, ${nFiche} sur la fiche`);
ok(montant === fiche.renta, `même maintenance : simulateur ${montant} F/an = fiche ${fiche.renta} F/an`);
await p.locator('.roi-hypotheses summary').click(); // section repliée par défaut
const ecran = (await p.locator('.roi-grid').innerText()).replace(/\s+/g, ' ');
ok(!(await entretien.locator('.roi-ligne-detail').count()) && !/supplémentaire|2 000 F par panneau|sous 10 panneaux/.test(ecran),
  'simulateur : le montant seul — la règle de calcul n’apparaît nulle part');
await entretien.screenshot({ path: '/tmp/claude-0/simulateur-entretien.png' });

await nav.close();
console.log(R.join('\n'));
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : `\n✅ Maintenance : même règle, même montant (${R.length} vérifications)`);
process.exit(echecs ? 1 : 0);
