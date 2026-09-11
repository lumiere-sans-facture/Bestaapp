/* Le kit 48 kWh est proposé par l'assistant et chiffre comme son devis d'origine. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const page = await nav.newPage({ viewport: { width: 1280, height: 950 } });
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));

const GERANT = { id: 'u1', email: 'boss@bestasolar.bj', name: 'Adam', role: 'gerant', phone: '+229', avatar: 'A' };
await page.goto('http://localhost:3000');
await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);

// ---- 1. LE KIT EST DOTÉ DANS L'ÉTAT ----
await page.goto('http://localhost:3000/plus/kits');
await page.waitForSelector('.kits-list', { timeout: 15000 });
await page.waitForTimeout(900);

const kits = await page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')).kits || []);
const k48 = kits.find((k) => k.id === 'kit-48kwh');
ok(!!k48, `le kit 48 kWh est doté à l'ouverture [${kits.length} kits]`);
ok(k48?.battery === 48 && k48?.panels === 24 && k48?.inverter === 12,
   `caractéristiques : ${k48?.battery} kWh · ${k48?.panels} panneaux · ${k48?.inverter} kVA`);
const bordereau = (k48?.lines || []).reduce((s, l) => s + l.pu * l.qty, 0);
ok(bordereau === 7198700, `le bordereau vaut le devis d'origine [${bordereau.toLocaleString('fr-FR')} F]`);

// ---- 2. IL S'AFFICHE DANS « MES KITS » ----
const texte = await page.evaluate(() => document.querySelector('.page-content')?.innerText || '');
ok(/48 kWh/.test(texte), 'il apparaît dans la liste « Mes kits »');
ok(/7 198 700/.test(texte), `son total est affiché [${(texte.match(/7 [0-9 ]{3,}/) || ['absent'])[0]}]`);

// ---- 3. LA MAIN D'ŒUVRE DOUBLE AU TOGO, PAS AILLEURS ----
const mo = await page.evaluate(async () => {
  const { SOLAR_KITS } = await import('/src/data/kits.js');
  const { coefficientMainOeuvre } = await import('/src/utils/mainOeuvre.js');
  const k = SOLAR_KITS.find((x) => x.id === 'kit-48kwh');
  const base = k.lines.find((l) => l.labor).pu;
  return {
    base,
    benin: base * coefficientMainOeuvre({ ville: 'Cotonou', telephone: '+229 01 61 73 29 56' }),
    togo: base * coefficientMainOeuvre({ ville: 'Lomé', telephone: '+228 90 11 22 33' }),
  };
});
ok(mo.benin === 240000, `main d'œuvre au Bénin : ${mo.benin.toLocaleString('fr-FR')} F (prix de base)`);
ok(mo.togo === 480000, `main d'œuvre au Togo : ${mo.togo.toLocaleString('fr-FR')} F (doublée)`);

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Kit 48 kWh : doté, affiché, chiffré conforme au devis d’origine');
process.exit(echecs ? 1 : 0);
