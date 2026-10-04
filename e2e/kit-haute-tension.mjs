/* Kits Deye haute tension (60 et 128 kWh) : suggérés par l'assistant pour un gros
   besoin, et sa main d'œuvre reste la même au Togo qu'au Bénin (les autres
   kits la doublent au Togo). Lancer `npm run dev` à côté. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };
await page.goto(B + '/');
await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
// Aucun client béninois dans les données de démonstration : un client togolais
// en devient un (adresse et numéro +229), posé avant que l'app ne lise son état.
await ctx.addInitScript(() => {
  const brut = localStorage.getItem('bestasolar_data');
  if (!brut) return;
  const s = JSON.parse(brut);
  if (s.leads?.some((l) => l.id === 'e2e-benin')) return;
  const modele = s.leads.find((l) => String(l.phone || '').startsWith('+228'));
  s.leads = [...s.leads, { ...modele, id: 'e2e-benin', name: 'Client Cotonou', contact: 'Client Cotonou', phone: '+229 01 97 00 00 00', address: 'Akpakpa, Cotonou' }];
  localStorage.setItem('bestasolar_data', JSON.stringify(s));
});
const suivant = () => page.locator('button:has-text("Suivant")').first();
const chiffre = (t) => Number(String(t).replace(/\D/g, ''));

// Parcours jusqu'au choix du kit, pour un client donné (par son téléphone).
async function kitsProposes(indicatif, jour = '25', nuit = '42') {
  await page.goto(B + '/devis');
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("Créer un devis"), button:has-text("Nouveau devis")').first().click();
  await page.waitForTimeout(800);
  await page.locator(':text("Dimensionnement solaire")').first().click();
  await page.waitForTimeout(900);
  const leads = await page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')).leads);
  const lead = leads.find((l) => String(l.phone || '').replace(/\s/g, '').startsWith(indicatif));
  await page.locator('.page-content button', { hasText: lead.contact || lead.name }).first().click();
  await page.waitForTimeout(400);
  await suivant().click(); await page.waitForTimeout(700);
  await page.locator('button:has-text("Saisie directe")').click();
  await page.locator('.manual-consumption-grid input').nth(0).fill(jour);
  await page.locator('.manual-consumption-grid input').nth(1).fill(nuit);
  await page.waitForTimeout(300);
  await suivant().click(); await page.waitForTimeout(900);
  await suivant().click(); await page.waitForTimeout(1500);
  const resume = await page.locator('.kit-summary').innerText().catch(() => '');
  return page.evaluate((resume) => [...document.querySelectorAll('.kit-option')].map((b) => ({
    nom: b.querySelector('.kit-option-name')?.firstChild?.textContent?.trim(),
    total: b.querySelector('.kit-option-meta')?.innerText,
    resume,
  })), resume);
}

const togo = await kitsProposes('+228');
const benin = await kitsProposes('+229');
const t60 = togo.find((k) => /60 kWh/.test(k.nom));
const b60 = benin.find((k) => /60 kWh/.test(k.nom));
ok(!!t60, `kit 60 kWh suggéré pour un gros besoin [${togo.map((k) => k.nom).join(' · ')}]`);
ok(t60 && b60 && chiffre(t60.total) === chiffre(b60.total),
   `même prix au Togo et au Bénin : main d'œuvre non doublée [Togo ${t60?.total} · Bénin ${b60?.total}]`);

// Besoin intermédiaire (entre 60 et 120 kWh) : le 60 kWh reçoit des modules
// de 12 kWh au lieu de sauter au 128 kWh.
const moyen = await kitsProposes('+228', '40', '70');
const m60 = moyen.find((k) => /60 kWh/.test(k.nom));
const etendu = /batterie (\d+) kWh/.exec(m60?.resume || '');
ok(moyen.length === 1 && !!m60 && etendu && Number(etendu[1]) > 60 && Number(etendu[1]) <= 120 && Number(etendu[1]) % 12 === 0,
   `besoin intermédiaire : kit 60 kWh étendu, pas le 128 kWh [${moyen.map((k) => k.nom).join(' · ')} — ${m60?.resume.replace(/\s+/g, ' ')}]`);
const modules = Number(etendu?.[1]) / 12;
// Les panneaux complétés (75 000 F + 10 000 F de structure) s'ajoutent aussi.
const panneaux = Number(/(\d+) panneaux/.exec(m60?.resume || '')?.[1] || 42);
ok(m60 && chiffre(m60.total) === 15044000 + (modules - 5) * 1245000 + (panneaux - 42) * 85000,
   `prix : ${modules - 5} module(s) de 1 245 000 F et ${panneaux - 42} panneau(x) ajoutés [${m60?.total}]`);

// Très gros besoin : le kit 128 kWh, lui aussi au même prix des deux côtés.
const togoXL = await kitsProposes('+228', '60', '110');
const beninXL = await kitsProposes('+229', '60', '110');
const t128 = togoXL.find((k) => /128 kWh/.test(k.nom));
const b128 = beninXL.find((k) => /128 kWh/.test(k.nom));
ok(!!t128, `kit 128 kWh suggéré pour un très gros besoin [${togoXL.map((k) => k.nom).join(' · ')}]`);
ok(t128 && b128 && chiffre(t128.total) === chiffre(b128.total),
   `128 kWh : même prix au Togo et au Bénin [Togo ${t128?.total} · Bénin ${b128?.total}]`);

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Kit haute tension : suggéré, même main d’œuvre au Togo et au Bénin');
process.exit(echecs ? 1 : 0);
