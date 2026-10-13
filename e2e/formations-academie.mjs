/* Académie BestaSolar : les trois formations s'affichent à côté des cours
   existants, une leçon montre son plan et son schéma, le quiz se corrige
   avec ses explications et bloque la fin de leçon tant qu'il n'est pas
   vérifié, la progression avance et survit au rechargement — sur ordinateur,
   sur téléphone et en mode sombre. Nécessite `npm run dev` à côté. */
import { chromium } from '@playwright/test';

const B = 'http://localhost:3000';
const CAPTURES = process.env.CAPTURES || '/tmp';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const jsErr = [];
const USER = { id: 'acad-u1', email: 'koffi@bestasolar.bj', name: 'Koffi Agbo', role: 'technicien', phone: '+229', avatar: 'KA' };

const ouvrir = async ({ largeur = 1280, hauteur = 900, theme = 'clair', vierge = false } = {}, ctx = null) => {
  const contexte = ctx || await nav.newContext({ viewport: { width: largeur, height: hauteur } });
  const page = await contexte.newPage();
  page.on('pageerror', (e) => jsErr.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error' || /net::ERR_|Failed to load resource/.test(m.text())) return;
    jsErr.push('console: ' + m.text());
  });
  await page.goto(B + '/');
  await page.evaluate(({ user, theme, vierge }) => {
    if (vierge) localStorage.clear();
    localStorage.setItem('bestasolar_user', JSON.stringify(user));
    localStorage.setItem(`bestasolar_guide_accueil_v1:${user.id}`, 'termine');
    localStorage.setItem('bestasolar_theme', theme);
  }, { user: USER, theme, vierge });
  await page.goto(B + '/plus/formation');
  await page.waitForSelector('.course-grid', { timeout: 15000 });
  return page;
};
// Titre EXACT : « Bien démarrer avec BestaSolar Pro » contient « démarrer avec
// BestaSolar Pro », et hasText ignore la casse.
const exact = (t) => new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const carte = (page, titre) => page.locator('.course-card', { has: page.locator('.course-card-title', { hasText: exact(titre) }) });
const allerA = async (page, titre) => {
  const lecon = () => page.locator('.school-lecon', { has: page.locator('.school-lecon-title', { hasText: exact(titre) }) });
  if (!(await lecon().count())) {
    const fermes = page.locator('.school-module.closed .school-module-head');
    while (await fermes.count()) await fermes.first().click();
  }
  await lecon().first().click();
  await page.waitForSelector(`.school-content-title:text-is("${titre}")`);
};
const progression = async (page) => (await page.locator('.course-head-progress span').innerText()).trim();

// ---- 1. CATALOGUE : les trois formations, à côté des anciens cours ----
const page = await ouvrir({ vierge: true });
const titres = await page.locator('.course-card-title').allInnerTexts();
for (const t of ['Démarrer avec BestaSolar Pro', 'Créer des devis qui signent', 'Gagner de l’argent avec BestaSolar Pro']) {
  ok(titres.includes(t), `le catalogue affiche « ${t} »`);
}
ok(titres.includes('Bien démarrer avec BestaSolar Pro'), 'l’ancien cours « Bien démarrer avec BestaSolar Pro » est conservé');
for (const t of ['Démarrer avec BestaSolar Pro', 'Créer des devis qui signent', 'Gagner de l’argent avec BestaSolar Pro']) {
  const charge = await carte(page, t).locator('img.course-cover-photo').evaluate((img) => img.complete && img.naturalWidth > 0);
  ok(charge, `la couverture de « ${t} » s’affiche (SVG embarqué)`);
}
ok((await carte(page, 'Démarrer avec BestaSolar Pro').locator('.course-cover-duration').innerText()).includes('47 min'),
  'la durée de la formation 1 est annoncée (47 min)');
await page.screenshot({ path: `${CAPTURES}/academie-catalogue.png`, fullPage: true });

// ---- 2. UNE LEÇON : objectif, texte, « À retenir » ----
await carte(page, 'Démarrer avec BestaSolar Pro').locator('button.btn-primary').click();
await page.waitForSelector('.school-content-title');
ok(await page.locator('.school-content-title').innerText() === 'Créer son compte', 'le cours s’ouvre sur sa première leçon');
ok((await page.locator('.school-content-description').innerText()).startsWith('Objectif :'), 'la leçon annonce son objectif');
ok(await page.locator('.school-content', { hasText: 'Erreurs fréquentes sur le terrain' }).count() === 1, 'les erreurs du terrain sont listées');
const pointsCles = await page.locator('.lesson-action-content li').count();
ok(pointsCles > 0 && pointsCles <= 3, `l’encadré « À retenir » tient en ${pointsCles} point(s)`);
ok(await progression(page) === '0/16 · 0%', 'progression de départ : 0/16');

// ---- 3. LE QUIZ : bloqué tant qu'il n'est pas vérifié, puis expliqué ----
await page.locator('.lesson-nav-main').click();                 // leçon 1 terminée
await page.waitForSelector('.school-content-title:text-is("Gérant ou technicien : qui fait quoi")');
await page.locator('.lesson-nav-main').click();                 // leçon 2 terminée
await page.waitForSelector('.quiz');
ok(await progression(page) === '2/16 · 13%', 'chaque leçon terminée fait avancer la progression (2/16)');
const fin = page.locator('.lesson-nav-main');
ok(await fin.isDisabled(), 'quiz non vérifié : impossible de terminer la leçon');
const verifier = page.locator('.quiz-verifier');
ok(await verifier.isDisabled() && (await verifier.innerText()).includes('(0/3)'), 'le bouton de vérification attend les 3 réponses');
const questions = page.locator('.quiz-question');
await questions.nth(0).locator('.quiz-choix').nth(1).click();   // mauvaise réponse, volontairement
await questions.nth(1).locator('.quiz-choix').nth(2).click();   // bonne
ok((await verifier.innerText()).includes('(2/3)'), 'le compteur suit les réponses données (2/3)');
await questions.nth(2).locator('.quiz-choix').nth(1).click();   // bonne
await verifier.click();
ok(await page.locator('.quiz-explication').count() === 3, 'chaque question affiche son explication');
ok(await page.locator('.quiz-explication.is-faux').count() === 1 && await page.locator('.quiz-explication.is-juste').count() === 2,
  'la correction distingue la réponse fausse des deux justes');
ok((await page.locator('.quiz-explication.is-faux').innerText()).includes('Le pays se choisit dans le champ du numéro'),
  'l’erreur est expliquée');
ok((await page.locator('.quiz-score').innerText()).includes('2 / 3'), 'le score s’affiche : 2 / 3');
ok(await questions.nth(0).locator('.quiz-choix.is-juste').count() === 1, 'la bonne réponse est montrée');
ok(!(await fin.isDisabled()), 'quiz vérifié : la leçon peut se terminer');
await page.locator('.quiz-bilan button').click();
ok(await page.locator('.quiz-explication').count() === 0 && await verifier.isDisabled(), '« Recommencer le quiz » remet le quiz à zéro');
for (const [q, c] of [[0, 0], [1, 2], [2, 1]]) await questions.nth(q).locator('.quiz-choix').nth(c).click();
await verifier.click();
ok((await page.locator('.quiz-score').innerText()).includes('3 / 3'), 'trois bonnes réponses : 3 / 3');
await page.screenshot({ path: `${CAPTURES}/academie-quiz.png`, fullPage: true });
await fin.click();
await page.waitForSelector('.school-content-title:text-is("Le tableau de bord")');
ok(await progression(page) === '3/16 · 19%', 'le quiz terminé compte dans la progression (3/16)');

// ---- 4. LE SCHÉMA : dessiné dans la leçon, à la largeur de l'écran ----
await page.locator('.course-head').screenshot({ path: `${CAPTURES}/academie-entete-cours.png` });
await allerA(page, 'Les cinq onglets');
const schema = page.locator('.school-content figure.schema-formation');
ok(await schema.count() === 1, 'la leçon « Les cinq onglets » affiche son schéma');
ok((await schema.locator('figcaption').innerText()).includes('Les cinq onglets'), 'le schéma porte sa légende');
const tailles = await schema.evaluate((f) => ({ svg: f.querySelector('svg').getBoundingClientRect().width, carte: f.closest('.school-content').getBoundingClientRect().width }));
ok(tailles.svg > 200 && tailles.svg <= tailles.carte, `le schéma tient dans la leçon (${Math.round(tailles.svg)} px / ${Math.round(tailles.carte)} px)`);

// ---- 5. LA PROGRESSION SURVIT AU RECHARGEMENT ----
await page.reload();
await page.waitForSelector('.course-grid');
ok((await carte(page, 'Démarrer avec BestaSolar Pro').locator('.course-card-pct').innerText()).trim() === '19%',
  'après rechargement, la carte du cours affiche 19 %');
ok((await carte(page, 'Démarrer avec BestaSolar Pro').locator('button.btn-primary').innerText()).includes('Continuer'),
  'le cours propose « Continuer »');

// ---- 6. AUCUNE RÉGRESSION : l'ancien cours s'ouvre toujours ----
await carte(page, 'Bien démarrer avec BestaSolar Pro').locator('button.btn-primary').click();
await page.waitForSelector('.school-content-title');
ok(await page.locator('.school-content-title').innerText() === 'Tour du tableau de bord', 'l’ancien cours s’ouvre sur sa première leçon (vidéo)');
ok(await page.locator('.quiz').count() === 0, 'l’ancien cours n’a pas de quiz parasite');
await page.locator('.school-back, button:has-text("Tous les cours")').first().click();
await page.waitForSelector('.course-grid');

// ---- 7. LE DOCUMENT PDF de la formation 3 ----
await carte(page, 'Gagner de l’argent avec BestaSolar Pro').locator('button.btn-primary').click();
await page.waitForSelector('.school-content-title');
await allerA(page, 'La checklist des 30 jours (PDF)');
const lien = page.locator('.school-content a:has-text("Ouvrir le document")');
ok(await lien.getAttribute('href') === '/formations/checklist-30-jours.pdf', 'la leçon PDF pointe vers la checklist');
const reponse = await page.request.get(B + '/formations/checklist-30-jours.pdf');
ok(reponse.ok() && (reponse.headers()['content-type'] || '').includes('pdf'), 'la checklist PDF est servie');
await allerA(page, 'D’où vient l’argent');
ok(await page.locator('.school-content figure.schema-formation figcaption', { hasText: 'un exemple' }).count() === 1,
  'le schéma des revenus se présente comme un exemple');
await page.close();

// ---- 8. TÉLÉPHONE : pas de débordement, leçon lisible ----
const mobile = await ouvrir({ largeur: 375, hauteur: 780 });
await carte(mobile, 'Créer des devis qui signent').locator('button.btn-primary').click();
await mobile.waitForSelector('.school-program-title');
await allerA(mobile, 'Ce que le client doit lire');
ok(await mobile.locator('.school-content figure.schema-formation').isVisible(), 'mobile : le schéma du kit est visible');
const debord = await mobile.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
ok(debord <= 0, `mobile : aucun défilement horizontal (${debord} px)`);
await mobile.screenshot({ path: `${CAPTURES}/academie-mobile-schema.png`, fullPage: true });
await mobile.locator('button:has-text("Programme du cours")').click();
await allerA(mobile, 'Quiz — Le bon devis');
const debordQuiz = await mobile.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
ok(debordQuiz <= 0, `mobile : le quiz tient dans l’écran (${debordQuiz} px)`);
await mobile.close();

// ---- 9. MODE SOMBRE : schéma et quiz lisibles ----
const sombre = await ouvrir({ largeur: 390, hauteur: 844, theme: 'sombre' });
ok(await sombre.evaluate(() => document.documentElement.dataset.theme === 'dark'), 'le mode sombre est actif');
await carte(sombre, 'Gagner de l’argent avec BestaSolar Pro').locator('button.btn-primary').click();
await sombre.waitForSelector('.school-program-title');
await allerA(sombre, 'Les bons chiffres à regarder');
const couleurs = await sombre.evaluate(() => {
  // Texte posé directement sur la carte (pas sur un aplat de couleur).
  const t = document.querySelector('.school-content .sf [class*="sf-texte"]:not(.sf-texte-inverse):not(.sf-texte-sombre)');
  const fond = getComputedStyle(document.querySelector('.school-content')).backgroundColor;
  return { texte: getComputedStyle(t).fill, fond };
});
const lum = (c) => { const [r, g, b] = c.match(/\d+/g).map(Number); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
ok(Math.abs(lum(couleurs.texte) - lum(couleurs.fond)) > 0.4, `sombre : le texte du schéma contraste avec la carte (${couleurs.texte} sur ${couleurs.fond})`);
const encadre = await sombre.evaluate(() => {
  const li = document.querySelector('.school-content .lesson-action-content li');
  const boite = document.querySelector('.school-content .lesson-action');
  // Fond réel de l'encadré : son voile translucide posé sur la carte.
  const fondCarte = getComputedStyle(document.querySelector('.school-content')).backgroundColor.match(/\d+(\.\d+)?/g).map(Number);
  const voile = getComputedStyle(boite).backgroundColor.match(/\d+(\.\d+)?/g).map(Number);
  const a = voile[3] ?? 1;
  const fond = [0, 1, 2].map((i) => Math.round(voile[i] * a + fondCarte[i] * (1 - a)));
  return { texte: getComputedStyle(li).color, fond: `rgb(${fond.join(', ')})` };
});
ok(Math.abs(lum(encadre.texte) - lum(encadre.fond)) > 0.5, `sombre : l’encadré « À retenir » est lisible (${encadre.texte} sur ${encadre.fond})`);
await sombre.screenshot({ path: `${CAPTURES}/academie-sombre-schema.png`, fullPage: true });
await sombre.locator('button:has-text("Programme du cours")').click();
await allerA(sombre, 'Quiz — Les indicateurs');
const qs = sombre.locator('.quiz-question');
for (let i = 0; i < await qs.count(); i++) await qs.nth(i).locator('.quiz-choix').first().click();
await sombre.locator('.quiz-verifier').click();
await sombre.screenshot({ path: `${CAPTURES}/academie-sombre-quiz.png`, fullPage: true });
ok(await sombre.locator('.quiz-explication').count() === await qs.count(), 'sombre : le quiz se corrige aussi');
ok(!(await sombre.locator('.lesson-nav-main').isDisabled()), 'sombre : quiz vérifié, la leçon peut se terminer');
await sombre.close();

console.log('\n' + R.join('\n'));
console.log(jsErr.length ? `\n❌ erreurs JS : ${jsErr.join(' | ')}` : '\naucune erreur JS');
await nav.close();
const echecs = R.filter((r) => r.startsWith('❌')).length + jsErr.length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ formations de l’Académie conformes');
process.exit(echecs ? 1 : 0);
