/* Kits Deye haute tension (60, 128 et 208 kWh) : suggérés par l'assistant pour un gros
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
// … ainsi que les suppléments de main-d'œuvre d'un kit étendu (10 000 F par
// panneau + 3 500 F par kWc ; kit haute tension : jamais doublée au Togo).
const supplementMo = (panneaux - 42) * 10000 + Math.round((panneaux - 42) * 0.62 * 3500);
ok(m60 && chiffre(m60.total) === 15044000 + (modules - 5) * 1245000 + (panneaux - 42) * 85000 + supplementMo,
   `prix : ${modules - 5} module(s) de 1 245 000 F, ${panneaux - 42} panneau(x) et leur main-d’œuvre [${m60?.total}]`);

// Très gros besoin : le kit 128 kWh, lui aussi au même prix des deux côtés.
const togoXL = await kitsProposes('+228', '50', '94');
const beninXL = await kitsProposes('+229', '50', '94');
const t128 = togoXL.find((k) => /128 kWh/.test(k.nom));
const b128 = beninXL.find((k) => /128 kWh/.test(k.nom));
ok(!!t128, `kit 128 kWh suggéré pour un très gros besoin [${togoXL.map((k) => k.nom).join(' · ')}]`);
ok(t128 && b128 && chiffre(t128.total) === chiffre(b128.total),
   `128 kWh : même prix au Togo et au Bénin [Togo ${t128?.total} · Bénin ${b128?.total}]`);

// Entre 128 et 192 kWh : le 128 kWh reçoit des modules de 16 kWh.
const grand = await kitsProposes('+228', '70', '120');
const g128 = grand.find((k) => /128 kWh/.test(k.nom));
const cap = Number(/batterie (\d+) kWh/.exec(g128?.resume || '')?.[1] || 0);
ok(grand.length === 1 && !!g128 && cap > 128 && cap <= 192 && cap % 16 === 0 && /étendue depuis 128/.test(g128.resume),
   `entre 128 et 192 kWh : kit 128 kWh étendu, pas le 208 kWh [${grand.map((k) => k.nom).join(' · ')} — ${g128?.resume.replace(/\s+/g, ' ')}]`);

// Au-delà de 192 kWh : le kit 208 kWh (PCS 125 kW), même prix des deux côtés.
const togoXXL = await kitsProposes('+228', '100', '180');
const beninXXL = await kitsProposes('+229', '100', '180');
const t208 = togoXXL.find((k) => /208 kWh/.test(k.nom));
const b208 = beninXXL.find((k) => /208 kWh/.test(k.nom));
ok(!!t208, `kit 208 kWh suggéré au-delà de 192 kWh [${togoXXL.map((k) => k.nom).join(' · ')}]`);
const cap208 = Number(/batterie (\d+) kWh/.exec(t208?.resume || '')?.[1] || 0);
ok([224, 240, 256].includes(cap208) && /étendue depuis 208/.test(t208.resume),
   `très gros besoin : 208 kWh étendu par modules de 16 kWh [${t208?.resume.replace(/\s+/g, ' ')}]`);
ok(t208 && b208 && chiffre(t208.total) === chiffre(b208.total) && chiffre(t208.total) >= 50055000,
   `208 kWh : même prix au Togo et au Bénin [Togo ${t208?.total} · Bénin ${b208?.total}]`);

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Kit haute tension : suggéré, même main d’œuvre au Togo et au Bénin');
process.exit(echecs ? 1 : 0);
