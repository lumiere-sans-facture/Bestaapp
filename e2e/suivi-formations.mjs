/* Suivi des formations par le gérant.
     1. un technicien suit l'Académie : leçons ouvertes et terminées, quiz
        vérifié (2/3) puis refait (3/3) — tout est enregistré ;
     2. le technicien ne voit ni la carte du tableau de bord ni le suivi ;
     3. le gérant : carte « Formation de l'équipe » au tableau de bord (qui a
        commencé, modules terminés, quiz, cours les plus et moins suivis) ;
     4. Plus → « Suivi des formations » : apprenants, filtre « Pas commencé »,
        détail d'un apprenant (cours, quiz et tentatives), cours, quiz,
        message WhatsApp d'encouragement ;
     5. téléphone : aucun débordement.
   Nécessite `npm run dev` à côté (mode local, équipe de démonstration). */
import { chromium } from '@playwright/test';

const B = 'http://localhost:3000';
const CAPTURES = process.env.CAPTURES || '/tmp';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const jsErr = [];
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam Adébiyi', role: 'gerant', phone: '+228 97 12 34 56', avatar: 'AA' };
const FATOU = { id: 'u2', email: 'fatou@bestasolar.tg', name: 'Fatou Boko', role: 'technicien', phone: '+228 96 78 90 12', avatar: 'FB' };
const COURS = 'Démarrer avec BestaSolar Pro';

const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => jsErr.push(String(e)));
page.on('console', (m) => {
  if (m.type() !== 'error' || /net::ERR_|Failed to load resource/.test(m.text())) return;
  jsErr.push('console: ' + m.text());
});
const connecter = async (u, chemin) => {
  await page.goto(B + '/privacy.html');
  await page.evaluate((x) => {
    localStorage.setItem('bestasolar_user', JSON.stringify(x));
    localStorage.setItem(`bestasolar_guide_accueil_v1:${x.id}`, 'termine');
  }, u);
  await page.goto(B + chemin);
};
const fiches = () => page.evaluate(() => (JSON.parse(localStorage.getItem('bestasolar_data'))?.formationProgress || []));
const fiche = async (userId, leconId) => (await fiches()).find((f) => f.userId === userId && f.leconId === leconId);
// L'état s'enregistre sur l'appareil après 400 ms de calme : on attend la
// fiche attendue plutôt qu'un délai fixe.
const ficheQuand = async (userId, leconId, condition, delai = 5000) => {
  const fin = Date.now() + delai;
  let f = await fiche(userId, leconId);
  while (!condition(f) && Date.now() < fin) { await page.waitForTimeout(150); f = await fiche(userId, leconId); }
  return f;
};
const exact = (t) => new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

// ---- 1. LE TECHNICIEN SUIT L'ACADÉMIE ----
await page.goto(B + '/');
await page.evaluate(() => localStorage.clear());
await connecter(FATOU, '/plus/formation');
await page.waitForSelector('.course-grid', { timeout: 15000 });
await page.locator('.course-card', { has: page.locator('.course-card-title', { hasText: exact(COURS) }) }).locator('button.btn-primary').click();
await page.waitForSelector('.school-content-title');
ok((await ficheQuand('u2', 'ad-m1-l1', (f) => f?.status === 'vue'))?.status === 'vue', 'leçon ouverte : notée « vue » (même sans la terminer)');
await page.locator('.lesson-nav-main').click(); // leçon 1 terminée → leçon 2
await page.waitForTimeout(300);
await page.locator('.lesson-nav-main').click(); // leçon 2 terminée → quiz
await page.waitForSelector('.quiz');
const f1 = await ficheQuand('u2', 'ad-m1-l1', (f) => f?.status === 'complete');
ok(f1?.status === 'complete' && !!f1?.vueLe, 'leçon terminée : « complete », première ouverture gardée');
const questions = page.locator('.quiz-question');
await questions.nth(0).locator('.quiz-choix').nth(1).click(); // fausse
await questions.nth(1).locator('.quiz-choix').nth(2).click(); // juste
await questions.nth(2).locator('.quiz-choix').nth(1).click(); // juste
await page.locator('.quiz-verifier').click();
let q = (await ficheQuand('u2', 'ad-m1-quiz', (f) => !!f?.quiz))?.quiz;
ok(q?.score === 2 && q?.total === 3 && q?.tentatives === 1, `quiz vérifié : score enregistré [${q?.score}/${q?.total}, ${q?.tentatives} tentative]`);
await page.locator('button:has-text("Recommencer le quiz")').click();
await questions.nth(0).locator('.quiz-choix').nth(0).click();
await questions.nth(1).locator('.quiz-choix').nth(2).click();
await questions.nth(2).locator('.quiz-choix').nth(1).click();
await page.locator('.quiz-verifier').click();
q = (await ficheQuand('u2', 'ad-m1-quiz', (f) => f?.quiz?.tentatives === 2))?.quiz;
ok(q?.score === 3 && q?.meilleurScore === 3 && q?.tentatives === 2, `quiz refait : meilleur score et tentatives [${q?.meilleurScore}/${q?.total}, ${q?.tentatives} tentatives]`);
await page.locator('.lesson-nav-main').click(); // quiz terminé
const fq = await ficheQuand('u2', 'ad-m1-quiz', (f) => f?.status === 'complete');
ok(fq?.status === 'complete' && fq?.quiz?.tentatives === 2,
  'quiz terminé : le score reste sur la fiche');

// ---- 2. LE TECHNICIEN NE VOIT PAS LE SUIVI ----
await page.goto(B + '/dashboard');
await page.waitForSelector('.stat-strip');
ok(await page.locator('.card-title', { hasText: 'Formation de l’équipe' }).count() === 0, 'technicien : pas de carte « Formation de l’équipe »');
await page.goto(B + '/plus/suiviformation');
await page.waitForTimeout(800);
ok(new URL(page.url()).pathname === '/plus' && await page.locator('.section-title', { hasText: 'Suivi des formations' }).count() === 0,
  'technicien : le suivi est réservé au gérant (renvoi vers Plus)');

// ---- 3. LE GÉRANT : TABLEAU DE BORD ----
await connecter(GERANT, '/dashboard');
await page.waitForSelector('.formation-equipe');
const carte = page.locator('.formation-equipe');
const texte = (await carte.innerText()).replace(/\s+/g, ' ');
ok(/1 sur 2 membres a commencé l’Académie/.test(texte), `qui a commencé : 1 sur 2 (le gérant n’est pas compté) [${texte.slice(0, 80)}…]`);
ok(/1 n’a pas encore commencé \(50 %\)/.test(texte), 'qui n’a pas commencé : 1 (50 %)');
ok((await carte.locator('.ring-value').innerText()).trim() === '50%', 'anneau : 50 %');
ok(/1 module terminé/.test(texte) && /1 quiz réalisé · moyenne 100 %/.test(texte), 'modules terminés et quiz (meilleure tentative)');
const plusSuivi = (await carte.locator('.formation-barre-bloc').first().innerText()).replace(/\s+/g, ' ');
ok(plusSuivi.includes(COURS) && plusSuivi.includes('1/2'), `cours le plus suivi : ${COURS}, 1/2 [${plusSuivi}]`);
// Titres de liste en capitales (CSS) : innerText les rend en capitales.
const moins = texte.slice(texte.toLowerCase().indexOf('les moins suivis'));
ok(moins.length > 0 && /0\/2/.test(moins), `cours les moins suivis : personne ne les a ouverts (0/2) [${moins.slice(0, 120)}]`);
await carte.screenshot({ path: `${CAPTURES}/formation-tableau-de-bord.png` });

// ---- 4. PLUS → SUIVI DES FORMATIONS ----
await carte.locator('a', { hasText: 'Détail' }).click();
await page.waitForSelector('.section-title:text-is("Suivi des formations")');
ok(new URL(page.url()).pathname === '/plus/suiviformation', '« Détail » ouvre Plus → Suivi des formations');
const ligne = (nom) => page.locator('.formation-apprenant', { hasText: nom });
const fatou = (await ligne('Fatou Boko').innerText()).replace(/\s+/g, ' ');
ok(/3 leçons · 1 module · 0 cours terminé/.test(fatou) && /Quiz : 1\/1 réussi · moyenne 100 %/.test(fatou) && /aujourd’hui/.test(fatou),
  `Fatou : leçons, modules, quiz, dernière activité [${fatou.slice(0, 120)}…]`);
ok(/Pas encore commencé/.test(await ligne('Ibrahim').innerText()), 'Ibrahim : pas encore commencé');
ok(await ligne('Adam').count() === 0, 'le gérant n’est pas dans la liste des apprenants');
const lien = decodeURIComponent(await ligne('Ibrahim').locator('a.formation-encourager').getAttribute('href'));
ok(lien.startsWith('https://wa.me/22895556677?text=Bonjour Ibrahim,') && lien.includes(`commencez par « ${COURS} »`),
  `« Encourager » : WhatsApp prérempli, prénom seul, cours conseillé [${lien.slice(0, 110)}…]`);
const lienFatou = decodeURIComponent(await ligne('Fatou').locator('a.formation-encourager').getAttribute('href'));
ok(/bravo pour votre progression.*3 leçons terminées.*Continuez « Démarrer avec BestaSolar Pro »/.test(lienFatou), 'message pour qui a commencé : bravo et cours à continuer');

await page.locator('.category-chip', { hasText: 'Pas commencé' }).click();
ok(await page.locator('.formation-apprenant').count() === 1 && await ligne('Ibrahim').count() === 1, 'filtre « Pas commencé » : Ibrahim seul');
await page.locator('.category-chip', { hasText: 'Tous' }).click();
await page.mouse.move(0, 0);
await page.waitForTimeout(300);
await page.screenshot({ path: `${CAPTURES}/suivi-formations.png`, fullPage: true });

await ligne('Fatou').locator('.formation-apprenant-corps').click();
await page.waitForSelector('.sheet .formation-quiz');
const sheet = (await page.locator('.sheet').innerText()).replace(/\s+/g, ' ');
ok(sheet.includes(COURS) && /Quiz — Votre compte/.test(sheet) && /2 tentatives/.test(sheet) && /3\/3/.test(sheet) && /réussi/.test(sheet),
  `détail de Fatou : cours, quiz, meilleur score, tentatives [${sheet.slice(0, 140)}…]`);
await page.locator('.sheet').screenshot({ path: `${CAPTURES}/suivi-formations-detail.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

await page.locator('[role="tab"]', { hasText: 'Cours' }).click();
const cours = page.locator('.formation-cours-ligne');
ok((await cours.first().innerText()).includes(COURS), 'vue Cours : le plus regardé en tête');
ok(await page.locator('.formation-a-relancer', { hasText: 'personne ne l’a ouvert' }).count() > 0, 'vue Cours : les cours que personne n’a ouverts sont signalés');
await page.locator('[role="tab"]', { hasText: 'Quiz' }).click();
const quiz = (await page.locator('.formation-cours-ligne').first().innerText()).replace(/\s+/g, ' ');
ok(/Quiz — Votre compte/.test(quiz) && /100 %/.test(quiz) && /1 passé/.test(quiz), `vue Quiz : score moyen et réussite [${quiz}]`);

// ---- 5. TÉLÉPHONE ----
const mobile = await ctx.newPage();
await mobile.setViewportSize({ width: 375, height: 800 });
mobile.on('pageerror', (e) => jsErr.push(String(e)));
for (const chemin of ['/dashboard', '/plus/suiviformation']) {
  await mobile.goto(B + chemin);
  await mobile.waitForTimeout(1200);
  const debord = await mobile.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  ok(debord <= 0, `téléphone ${chemin} : aucun défilement horizontal (${debord} px)`);
}
await mobile.screenshot({ path: `${CAPTURES}/suivi-formations-mobile.png`, fullPage: true });
await mobile.goto(B + '/dashboard');
await mobile.waitForSelector('.formation-equipe');
await mobile.locator('.formation-equipe').screenshot({ path: `${CAPTURES}/formation-tableau-de-bord-mobile.png` });

console.log('\n' + R.join('\n'));
console.log(jsErr.length ? `\n❌ erreurs JS : ${jsErr.join(' | ')}` : '\naucune erreur JS');
await nav.close();
const echecs = R.filter((r) => r.startsWith('❌')).length + jsErr.length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Suivi des formations : progression, quiz et cours, au tableau de bord du gérant');
process.exit(echecs ? 1 : 0);
