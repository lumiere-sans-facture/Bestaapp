/* Agent devis (prototype), parcours complet dans l'app avec un CLAUDE SIMULÉ
   (l'appel à /api/agent-devis est intercepté : aucune clé, aucun coût).
   Vérifie : le navigateur n'envoie que la conversation ; les outils
   s'exécutent dans l'app avec les vrais kits ; le devis préparé n'est créé
   qu'au clic, en brouillon, avec sa piste. Lancer `npm run dev` à côté. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const ctx = await nav.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
const B = 'http://localhost:3000';

// ---- Claude simulé : enchaîne calcul → réponse chiffrée → devis ----
const requetes = [];
let optionRetenue = null;
await ctx.route('**/api/agent-devis', async (route) => {
  const corps = JSON.parse(route.request().postData() || '{}');
  requetes.push(corps);
  const msgs = corps.messages;
  const dernier = msgs[msgs.length - 1];
  const json = (content, stop_reason) => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ content, stop_reason, usage: { input_tokens: 1200, cache_read_input_tokens: 900, output_tokens: 150 } }) });
  const resultat = Array.isArray(dernier.content) && dernier.content.find((b) => b.type === 'tool_result');
  if (resultat) {
    const r = JSON.parse(resultat.content);
    if (r.options) {
      optionRetenue = r.options[0];
      return json([{ type: 'text', text: `Je vous propose le ${optionRetenue.nom} à ${optionRetenue.total_fcfa} F CFA. Il vous convient ?` }], 'end_turn');
    }
    if (r.ok) return json([{ type: 'text', text: 'Votre devis est prêt, un conseiller BESTA SOLAR le relit et vous le transmet.' }], 'end_turn');
    return json([{ type: 'text', text: `Erreur outil : ${resultat.content}` }], 'end_turn');
  }
  if (/frigo/i.test(dernier.content)) {
    return json([{ type: 'text', text: 'Je calcule votre installation.' }, { type: 'tool_use', id: 'tu_1', name: 'calculer_proposition', input: {
      appareils: [
        { nom: 'Réfrigérateur', puissance_w: 250, quantite: 1, heures_jour: 12, heures_nuit: 12 },
        { nom: 'Ampoule LED', puissance_w: 10, quantite: 4, heures_jour: 0, heures_nuit: 6 },
      ], conso_jour_kwh: 0, conso_nuit_kwh: 0, ville: 'Lomé', telephone: '', type_systeme: 'off-grid', support: 'tole' } }], 'tool_use');
  }
  if (/Afi/.test(dernier.content)) {
    return json([{ type: 'tool_use', id: 'tu_2', name: 'preparer_devis', input: {
      kit_id: optionRetenue.kit_id, client_nom: 'Afi Mensah', client_telephone: '+228 90 11 22 33', client_ville: 'Lomé' } }], 'tool_use');
  }
  return json([{ type: 'text', text: 'Pouvez-vous préciser ?' }], 'end_turn');
});

await page.goto(B + '/');
await page.evaluate(() => localStorage.setItem('bestasolar_user', JSON.stringify({ id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' })));
await page.goto(B + '/plus');
const entree = page.locator(':text("Agent devis (prototype)")');
ok(await entree.waitFor({ timeout: 10000 }).then(() => true).catch(() => false), 'gérant : « Agent devis (prototype) » dans le menu Plus');
const devisAuDepart = await page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')).devis.length);
await page.locator(':text("Agent devis (prototype)")').click(); await page.waitForTimeout(600);

const ecrire = async (t) => {
  await page.getByLabel('Message à l’agent').fill(t);
  await page.locator('.agent-saisie button[type="submit"]').click();
  await page.waitForFunction(() => !document.querySelector('.agent-saisie input')?.disabled, null, { timeout: 15000 });
  await page.waitForTimeout(300);
};

// ---- 1. Le client décrit son besoin ----
await ecrire('Bonjour, je veux alimenter un frigo et 4 ampoules à Lomé');
const chat1 = await page.locator('.agent-chat').innerText();
ok(/Dimensionnement et chiffrage des kits/.test(chat1), 'l’étape de calcul s’affiche');
ok(optionRetenue && /Kit/.test(optionRetenue.nom) && optionRetenue.total_fcfa > 0, `l’outil a chiffré avec les vrais kits [${optionRetenue?.nom} · ${optionRetenue?.total_fcfa} F]`);
ok(chat1.includes(String(optionRetenue?.total_fcfa)), 'la réponse de l’agent reprend le prix calculé par l’app');
ok(requetes.every((c) => Object.keys(c).join() === 'messages'), 'le navigateur n’envoie que la conversation (ni modèle, ni consignes, ni outils)');
const tr = requetes[1].messages.at(-1).content[0];
ok(tr.type === 'tool_result' && tr.tool_use_id === 'tu_1', 'résultat d’outil renvoyé à l’agent, rattaché à sa demande');
ok(requetes[1].messages[1].role === 'assistant' && requetes[1].messages[1].content[1]?.id === 'tu_1' && requetes[1].messages[1].content[1]?.input?.ville === 'Lomé',
   'la réponse de l’agent est renvoyée telle quelle au tour suivant');

// ---- 2. Il choisit et donne ses coordonnées ----
await ecrire('Oui ça me va. Je suis Afi Mensah, +228 90 11 22 33');
const carte = page.locator('.agent-proposition');
ok(await carte.count() === 1, 'carte « Devis préparé » affichée');
ok(/Afi Mensah · \+228 90 11 22 33/.test(await carte.innerText()), 'client repris sur la carte');
const avant = await page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')).devis.length);
ok(avant === devisAuDepart, `rien n’est enregistré avant le clic du gérant [${avant} devis, comme au départ]`);
await page.screenshot({ path: '/tmp/claude-0/agent-devis.png', fullPage: true });

// ---- 3. Le gérant valide : piste + devis en brouillon ----
await carte.locator('button:has-text("Créer la piste et le devis")').click(); await page.waitForTimeout(800);
const etat = await page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')));
const lead = etat.leads.find((l) => /90 ?11 ?22 ?33/.test(l.phone || ''));
const d = lead && etat.devis.find((x) => x.leadId === lead.id);
ok(!!lead && lead.name === 'Afi Mensah', 'piste créée pour Afi Mensah');
ok(!!d && d.statut === 'brouillon' && d.type === 'solar', 'devis enregistré en brouillon, rattaché à la piste');
ok(d && Math.round(d.total) === optionRetenue.total_fcfa && d.quotation?.components?.length > 0, `même montant que la proposition [${d?.total} F], lignes complètes`);
ok(/Enregistré en brouillon/.test(await carte.innerText()), 'la carte confirme l’enregistrement');
ok(/jetons lus/.test(await page.locator('.page-content').innerText()), 'consommation de jetons affichée');

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Agent devis : conversation, calculs de l’app, devis créé en brouillon');
process.exit(echecs ? 1 : 0);
