/* Parrainage et commissions venus du SERVEUR (migration 20261013).
   Les fonctions SQL elles-mêmes sont testées sur un vrai PostgreSQL par
   supabase/tests/lancer.sh ; ce parcours vérifie ce que l'application en fait :
     1. un visiteur ANONYME sur /r/CODE ou ?ref=CODE : le clic part au serveur ;
     2. l'espace partenaire d'un technicien : filleuls, parrain, clics,
        inscriptions, commissions avec leur niveau et les sous-totaux ;
     3. « Parrainé par » : le parrain de la PERSONNE, définitif ;
     4. le gérant : sous-totaux par niveau, rattrapage fait par le serveur.
   Lancer avec un Supabase simulé :
     VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=x npm run dev */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); const exp = Math.floor(Date.now() / 1000) + 86400;

const BIO = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'bio@x.tg', name: 'Bio Bamba', role: 'technicien', org_id: 'org-1', phone: '', avatar: 'BB', is_platform_admin: false };
const GERANT = { id: 'u-gerant', email: 'gerant@x.tg', name: 'Gérant Besta', role: 'gerant', org_id: 'org-1', phone: '', avatar: 'GB', is_platform_admin: true };
const COMMISSIONS = [
  { id: 'c1', partnerId: `p-user-${BIO.id}`, leadId: 'lead-1', leadName: 'Client de Bio', devisId: 'd1', devisNumber: 'BS-20261013-0001', level: 1, taux: 0.03, amount: 30000, status: 'en_attente', createdAt: '2026-10-13', source: 'devis' },
  { id: 'c2', partnerId: `p-user-${BIO.id}`, leadId: 'lead-9', leadName: 'Client de Cica', devisId: 'd9', devisNumber: 'BS-20261013-0002', level: 2, taux: 0.015, amount: 15000, status: 'en_attente', createdAt: '2026-10-13', source: 'devis', vendeurId: 'cccc', vendeurNom: 'Cica Coffi' },
  { id: 'c3', partnerId: `p-user-${BIO.id}`, leadId: 'lead-8', leadName: 'Autre client de Cica', devisId: 'd8', level: 2, taux: 0.015, amount: 6000, status: 'payée', paidAt: '2026-10-13', createdAt: '2026-10-12', source: 'devis', vendeurNom: 'Cica Coffi' },
];

const session = async (profil) => {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  const t = { rpc: [] };
  const JETON = `${b64({ alg: 'HS256' })}.${b64({ email: profil?.email || 'anon', exp, sub: profil?.id || 'x' })}.x`;
  await ctx.route('**/api/erreur**', (route) => route.fulfill({ status: 204, body: '' }));
  await ctx.route('http://127.0.0.1:54321/**', async (route) => {
    const req = route.request(); const c = new URL(req.url()).pathname;
    const json = (b, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    const unique = (req.headers().accept || '').includes('vnd.pgrst.object');
    if (c === '/auth/v1/token') return json({ access_token: JETON, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: { id: profil.id, email: profil.email, aud: 'authenticated', app_metadata: {}, user_metadata: {} } });
    if (c.startsWith('/auth/v1/')) return json({});
    if (c.startsWith('/rest/v1/rpc/')) {
      const nom = c.slice('/rest/v1/rpc/'.length);
      t.rpc.push({ nom, corps: JSON.parse(req.postData() || '{}') });
      if (nom === 'compter_clic_parrainage') return json(true);
      if (nom === 'mes_filleuls') return json([{ filleul_id: 'cccc', nom: 'Cica Coffi', telephone: '', inscrit_le: '2026-10-01T10:00:00Z', source: 'inscription', statut: 'actif', pro_actif: false, commissions_generees: 21000, commissions_nombre: 2 }]);
      if (nom === 'mon_parrain') return json([{ partenaire_id: 'p-user-aaaa', code: 'AWA-AAA111', nom: 'Awa Agbo', source: 'inscription', depuis: '2026-09-20T10:00:00Z' }]);
      if (nom === 'mes_stats_parrainage') return json([{ clics: 4, inscriptions: 1, filleuls: 1, taux_conversion: 0.25 }]);
      if (nom === 'rattraper_parrainage_commissions') return json([
        { etape: 'commission créée', objet: 'devis BS-20260901-0007', detail: '1 niveau(x)' },
        { etape: 'à vérifier', objet: 'devis BS-20260801-0003', detail: 'niveau 1 déjà payé par GERANT-AB12CD ; selon la règle, il revient à BIO-BBB222' },
      ]);
      return json(null);
    }
    if (c === '/rest/v1/profiles') return json(unique ? profil : [profil]);
    if (c === '/rest/v1/orgs') { const o = { id: 'org-1', name: 'BestaSolar', kind: 'interne' }; return json(unique ? o : [o]); }
    if (c === '/rest/v1/commissions' && req.method() === 'GET') return json(COMMISSIONS.map((d) => ({ id: d.id, org_id: 'org-1', data: d })));
    if (c === '/rest/v1/partners' && req.method() === 'GET') return json([
      { id: `p-user-${BIO.id}`, org_id: 'org-1', data: { id: `p-user-${BIO.id}`, userId: BIO.id, name: 'Bio Bamba', code: 'BIO-BBB222', status: 'actif', sponsorId: 'p-user-aaaa', sponsorCode: 'AWA-AAA111' } },
      { id: 'p-user-u-gerant', org_id: 'org-1', data: { id: 'p-user-u-gerant', userId: 'u-gerant', name: 'Gérant Besta', code: 'GERANT-AB12CD', status: 'actif' } },
    ]);
    if (c === '/functions/v1/google-contacts-sync') return json({ status: 'synced' });
    return json([]);
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
  if (profil) {
    await page.goto(B + '/login'); await page.waitForSelector('.login-form');
    await page.fill('input[type="email"]', profil.email);
    await page.fill('input[type="password"]', 'motdepasse123');
    await page.click('button[type="submit"]');
    await page.locator('.sidebar').waitFor({ timeout: 30000 });
  }
  return { ctx, page, t };
};
const texte = (page) => page.evaluate(() => document.body.innerText);
const attendreRpc = async (t, nom, delai = 8000) => {
  const fin = Date.now() + delai;
  while (Date.now() < fin) { const r = t.rpc.find((x) => x.nom === nom); if (r) return r; await new Promise((s) => setTimeout(s, 100)); }
  return null;
};

// 1. Visiteurs anonymes
{
  const { ctx, page, t } = await session(null);
  await page.goto(B + '/r/awa-aaa111');
  const clic = await attendreRpc(t, 'compter_clic_parrainage');
  ok(clic?.corps?.p_code === 'AWA-AAA111', `lien court /r/CODE : clic envoyé au serveur (${clic?.corps?.p_code})`);
  ok(/^[0-9a-f-]{36}$/.test(clic?.corps?.p_visiteur || ''), 'avec l’identifiant anonyme du navigateur (dédoublonnage)');
  ok(new URL(page.url()).pathname === '/' || new URL(page.url()).pathname === '/inscription', `l’adresse est nettoyée (${new URL(page.url()).pathname})`);
  const retenu = await page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_ref') || '{}').code);
  ok(retenu === 'AWA-AAA111', 'le code est gardé pour l’inscription (30 jours)');
  t.rpc.length = 0;
  await page.goto(B + '/?ref=awa-aaa111');
  const clic2 = await attendreRpc(t, 'compter_clic_parrainage');
  ok(clic2?.corps?.p_code === 'AWA-AAA111' && clic2?.corps?.p_visiteur === clic?.corps?.p_visiteur, '?ref=CODE : même visiteur, le serveur ne comptera qu’un clic sur 24 h');
  await ctx.close();
}

// 2 & 3. Technicien : espace partenaire et parrain
{
  const { ctx, page, t } = await session(BIO);
  await page.goto(B + '/plus');
  await page.waitForFunction(() => document.body.innerText.includes('Parrainé par'), null, { timeout: 15000 });
  const plus = await texte(page);
  ok(/Parrainé par\s+Awa Agbo\s*AWA-AAA111/.test(plus), '« Parrainé par » : le parrain de la personne, avec son nom et son code');
  ok(!plus.includes('Attribuer'), 'parrain définitif : plus de saisie de code');
  await page.goto(B + '/plus/mypartner');
  await page.waitForFunction(() => document.body.innerText.includes('Mes filleuls'), null, { timeout: 15000 });
  await page.waitForTimeout(800);
  // Ouvrir les sections repliables
  // (sections bâties sur <details>/<summary> : on les ouvre comme un utilisateur)
  for (const titre of ['Historique de mes commissions', 'Mes filleuls', 'Mon réseau et mon paiement']) {
    await page.locator('summary.accordion-head', { hasText: titre }).first().click();
  }
  await page.waitForTimeout(400);
  const esp = await texte(page);
  ok(esp.includes('Cica Coffi') && /vous a rapporté\s*21[\s  ]?000/.test(esp), 'Mes filleuls : nom et commissions générées');
  ok(/Mon parrain\s*Awa Agbo/.test(esp), 'Mon réseau : mon parrain');
  ok(/\b4\b[\s\S]{0,40}Clics sur mon lien/.test(esp), 'clics comptés par le serveur');
  ok(/1 · 25 %/.test(esp), 'inscriptions par mon lien et taux de conversion');
  ok(/N1 · 30[\s  ]?000[\s\S]{0,20}\(1\)/.test(esp) && /N2 · 21[\s  ]?000[\s\S]{0,20}\(2\)/.test(esp), 'sous-totaux par niveau (N1 30 000, N2 21 000)');
  ok(/N2 · 1,5[\s  ]?%/.test(esp) && esp.includes('via Cica Coffi'), 'niveau 2 : taux et filleul d’origine');
  ok(esp.includes('BS-20261013-0001'), 'devis d’origine affiché');
  ok(['mes_filleuls', 'mon_parrain', 'mes_stats_parrainage'].every((n) => t.rpc.some((r) => r.nom === n)), 'données lues sur le serveur, pas déduites de l’organisation');
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/parrainage-espace-partenaire.png`, fullPage: true });
  await ctx.close();
}

// 4. Gérant : écran Commissions
{
  const { ctx, page, t } = await session(GERANT);
  await page.goto(B + '/plus/commissions');
  await page.waitForFunction(() => document.body.innerText.includes('Par niveau'), null, { timeout: 15000 });
  const com = await texte(page);
  ok(/N1 · 30[\s  ]?000/.test(com) && /N2 · 21[\s  ]?000/.test(com), 'gérant : sous-totaux par niveau');
  await page.getByRole('button', { name: /Synchroniser/ }).click();
  const r = await attendreRpc(t, 'rattraper_parrainage_commissions');
  ok(r?.corps?.p_appliquer === true, 'rattrapage demandé au serveur');
  await page.waitForFunction(() => /point\(s\) à vérifier/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
  const apres = await texte(page);
  ok(/1 correction\(s\) appliquée\(s\)/.test(apres) && /1 point\(s\) à vérifier/.test(apres), 'compte rendu du rattrapage affiché');
  await ctx.close();
}

await nav.close();
console.log(R.join('\n'));
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(`\n${echecs ? '❌' : '✅'} Parrainage serveur (${R.length - echecs}/${R.length} vérifications)`);
process.exit(echecs ? 1 : 0);
