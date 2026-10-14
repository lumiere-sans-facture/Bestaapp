/* Inscription confirmée par CODE, en plus du lien de l'e-mail.
     1. inscription → l'écran « Confirmer votre adresse » s'ouvre aussitôt ;
        un code faux est refusé, le bon ouvre l'app ; l'entreprise et le code
        partenaire saisis à l'inscription sont bien transmis au serveur ;
     2. « Renvoyer l'e-mail » : envoyé, puis « patientez une minute » ;
     3. connexion d'un compte jamais confirmé (bon mot de passe) : l'écran du
        code s'ouvre au lieu de « mot de passe incorrect » ;
     4. code tapé sur un AUTRE appareil (rien de l'inscription n'y est
        gardé) : l'adresse est confirmée, la dernière étape s'affiche ;
     5. téléphone : écran sans débordement ;
     6. Supabase n'arrive pas à envoyer l'e-mail (« Error sending
        confirmation email ») : message en français, rapport au journal.
   Lancer avec un Supabase simulé :
     VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=x npm run dev */
import { chromium } from '@playwright/test';

const B = 'http://localhost:3000';
const CAPTURES = process.env.CAPTURES || '/tmp';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const jsErr = [];
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const UID = '11111111-1111-4111-8111-111111111111';
const EMAIL = 'nouveau@x.tg';
const BON_CODE = '123456';
const JETON = `${b64({ alg: 'HS256' })}.${b64({ email: EMAIL, exp, sub: UID })}.x`;
const PROFIL = { id: UID, email: EMAIL, name: 'Kossi Nouveau', role: 'gerant', org_id: 'org-n', phone: '+22890123456', avatar: 'KN', is_platform_admin: false };

/** Un appareil avec son Supabase simulé ; `t` garde ce que le serveur a reçu. */
const appareil = async ({ viewport = { width: 1280, height: 900 }, compteNonConfirme = false, envoiEchoue = false } = {}) => {
  const ctx = await nav.newContext({ viewport });
  const t = { verify: [], resend: 0, rpc: [], profilCree: false, rapports: [] };
  await ctx.route('**/api/erreur**', (route) => { t.rapports.push(route.request().postData() || ''); return route.fulfill({ status: 204, body: '' }); });
  await ctx.route('http://127.0.0.1:54321/**', async (route) => {
    const req = route.request(); const c = new URL(req.url()).pathname;
    const corps = () => JSON.parse(req.postData() || '{}');
    const json = (b, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    const utilisateur = { id: UID, email: EMAIL, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
    const session = { access_token: JETON, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: { ...utilisateur, email_confirmed_at: new Date().toISOString() } };
    // Inscription avec « Confirm email » : un utilisateur, PAS de session.
    if (c === '/auth/v1/signup' && envoiEchoue) return json({ code: 500, error_code: 'unexpected_failure', msg: 'Error sending confirmation email' }, 500);
    if (c === '/auth/v1/signup') return json({ ...utilisateur, email_confirmed_at: null, identities: [{ id: UID, provider: 'email' }] });
    if (c === '/auth/v1/verify') {
      const b = corps(); t.verify.push(b);
      if (b.token === BON_CODE && b.email === EMAIL) return json(session);
      return json({ code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }, 403);
    }
    if (c === '/auth/v1/resend') {
      t.resend += 1;
      return t.resend === 1 ? json({}) : json({ code: 429, error_code: 'over_email_send_rate_limit', msg: 'For security purposes, you can only request this after 57 seconds.' }, 429);
    }
    if (c === '/auth/v1/token') {
      if (compteNonConfirme) return json({ code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' }, 400);
      return json(session);
    }
    if (c.startsWith('/auth/v1/user')) return json(utilisateur);
    if (c.startsWith('/auth/v1/')) return json({});
    if (c.startsWith('/rest/v1/rpc/')) {
      const nom = c.slice('/rest/v1/rpc/'.length);
      t.rpc.push({ nom, corps: corps() });
      if (nom === 'signup_create_org' || nom === 'signup_join_org') { t.profilCree = true; return json('org-n'); }
      if (nom === 'auth_org_id') return json(t.profilCree ? 'org-n' : null);
      return json(null);
    }
    if (c === '/rest/v1/profiles') return json(t.profilCree ? [PROFIL] : []);
    if (c === '/rest/v1/orgs') return json(t.profilCree ? [{ id: 'org-n', name: 'Kossi Nouveau', kind: 'interne' }] : []);
    return json([]);
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => jsErr.push(String(e)));
  return { ctx, page, t };
};
const dansApp = (page) => page.waitForFunction(() => !document.querySelector('.login-form') && document.querySelector('.app-main, .sidebar'), null, { timeout: 30000 }).then(() => true).catch(() => false);
const titre = (page) => page.locator('.login-form-title').innerText();

// ---- 1. INSCRIPTION → CODE ----
{
  const { ctx, page, t } = await appareil();
  await page.goto(B + '/inscription');
  await page.waitForSelector('#signup-name');
  await page.fill('#signup-name', 'Kossi Nouveau');
  await page.fill('#signup-phone', '90123456');
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', 'motdepasse123');
  await page.fill('#signup-ref', 'AWA-AAA111');
  await page.locator('button[type="submit"]', { hasText: 'Créer mon compte' }).click();
  await page.waitForSelector('#code-confirmation', { timeout: 15000 });
  ok(await titre(page) === 'Confirmer votre adresse', 'après l’inscription : l’écran « Confirmer votre adresse » s’ouvre');
  ok(await page.inputValue('#login-email') === EMAIL, 'l’adresse saisie est reprise');
  ok(/un e-mail de confirmation vient d’être envoyé/.test(await page.locator('.login-notice').innerText()), 'le message d’envoi est affiché');
  ok(await page.getAttribute('#code-confirmation', 'autocomplete') === 'one-time-code' && await page.getAttribute('#code-confirmation', 'inputmode') === 'numeric',
    'champ du code : clavier numérique, code proposé par le téléphone');
  await page.screenshot({ path: `${CAPTURES}/inscription-code.png` });

  await page.fill('#code-confirmation', '000000');
  await page.locator('button[type="submit"]').click();
  await page.waitForSelector('.login-error');
  ok(/Code incorrect ou expiré/.test(await page.locator('.login-error').innerText()), 'un code faux est refusé, sans quitter l’écran');
  ok(t.verify[0]?.type === 'email' && t.verify[0]?.token === '000000', `vérifié auprès de Supabase (type « ${t.verify[0]?.type} »)`);

  await page.fill('#code-confirmation', '12 34 56');
  ok(await page.inputValue('#code-confirmation') === BON_CODE, 'les espaces recopiés avec le code sont retirés');
  await page.locator('button[type="submit"]').click();
  ok(await dansApp(page), 'le bon code ouvre l’application, connecté');
  const creation = t.rpc.find((r) => r.nom === 'signup_create_org');
  ok(creation?.corps?.p_user_name === 'Kossi Nouveau' && creation?.corps?.p_ref_code === 'AWA-AAA111' && creation?.corps?.p_phone === '+22890123456',
    `entreprise créée avec le nom, le téléphone et le code partenaire de l’inscription [${JSON.stringify(creation?.corps || {})}]`);
  await ctx.close();
}

// ---- 2. RENVOYER L'E-MAIL ----
{
  const { ctx, page, t } = await appareil();
  await page.goto(B + '/login');
  await page.waitForSelector('.login-form');
  await page.locator('button', { hasText: 'J’ai reçu un code de confirmation' }).click();
  await page.waitForSelector('#code-confirmation');
  ok(await titre(page) === 'Confirmer votre adresse', 'depuis la connexion : « J’ai reçu un code de confirmation » ouvre l’écran du code');
  await page.locator('button', { hasText: 'Renvoyer l’e-mail' }).click();
  await page.waitForSelector('.login-error');
  ok(/adresse e-mail/.test(await page.locator('.login-error').innerText()) && t.resend === 0, 'sans adresse : rien n’est envoyé, l’adresse est demandée');
  await page.fill('#login-email', EMAIL);
  await page.locator('button', { hasText: 'Renvoyer l’e-mail' }).click();
  await page.waitForSelector('.login-notice');
  ok(t.resend === 1 && /DERNIER message/.test(await page.locator('.login-notice').innerText()), 'renvoyé : seul le code du dernier e-mail vaut');
  await page.locator('button', { hasText: 'Renvoyer l’e-mail' }).click();
  await page.waitForSelector('.login-error');
  ok(/Patientez une minute/.test(await page.locator('.login-error').innerText()), 'trop tôt : « patientez une minute », en français');
  await page.locator('button', { hasText: 'Retour à la connexion' }).click();
  ok(await titre(page) === 'Connexion', '« Retour à la connexion »');
  await ctx.close();
}

// ---- 3. CONNEXION D'UN COMPTE JAMAIS CONFIRMÉ ----
{
  const { ctx, page } = await appareil({ compteNonConfirme: true });
  await page.goto(B + '/login');
  await page.waitForSelector('.login-form');
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', 'motdepasse123');
  await page.locator('button[type="submit"]').click();
  await page.waitForSelector('#code-confirmation', { timeout: 15000 });
  ok(/pas encore confirmée/.test(await page.locator('.login-notice').innerText()) && await page.locator('.login-error').count() === 0,
    'adresse non confirmée : l’écran du code, pas « mot de passe incorrect »');
  await ctx.close();
}

// ---- 4. CODE TAPÉ SUR UN AUTRE APPAREIL ----
{
  const { ctx, page, t } = await appareil();
  await page.goto(B + '/login');
  await page.waitForSelector('.login-form');
  await page.locator('button', { hasText: 'J’ai reçu un code de confirmation' }).click();
  await page.fill('#login-email', EMAIL);
  await page.fill('#code-confirmation', BON_CODE);
  await page.locator('button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('.login-form-title')?.innerText === 'Terminer l\'inscription', null, { timeout: 15000 }).catch(() => {});
  ok(await titre(page) === 'Terminer l\'inscription' && !t.profilCree,
    'autre appareil : adresse confirmée, la dernière étape (nom, téléphone) s’affiche');
  await ctx.close();
}

// ---- 5. TÉLÉPHONE ----
{
  const { ctx, page } = await appareil({ viewport: { width: 375, height: 800 } });
  await page.goto(B + '/login');
  await page.waitForSelector('.login-form');
  await page.locator('button', { hasText: 'J’ai reçu un code de confirmation' }).click();
  await page.waitForSelector('#code-confirmation');
  const debord = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  ok(debord <= 0, `téléphone : aucun défilement horizontal (${debord} px)`);
  await page.screenshot({ path: `${CAPTURES}/inscription-code-mobile.png` });
  await ctx.close();
}

// ---- 6. ENVOI DE L'E-MAIL REFUSÉ PAR SUPABASE ----
{
  const { ctx, page, t } = await appareil({ envoiEchoue: true });
  await page.goto(B + '/inscription');
  await page.waitForSelector('#signup-name');
  await page.fill('#signup-name', 'Kossi Nouveau');
  await page.fill('#signup-phone', '90123456');
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', 'motdepasse123');
  await page.locator('button[type="submit"]', { hasText: 'Créer mon compte' }).click();
  await page.waitForSelector('.login-error', { timeout: 15000 });
  const message = await page.locator('.login-error').innerText();
  ok(/n’a pas pu être envoyé/.test(message) && !/Error sending/i.test(message), `envoi refusé : message en français [${message}]`);
  await page.waitForTimeout(1500);
  ok(t.rapports.some((r) => /envoi de l'e-mail refusé \(inscription\)/.test(r)) && !t.rapports.some((r) => r.includes(EMAIL)),
    'le gérant est prévenu au journal des erreurs, sans l’adresse du client');
  await ctx.close();
}

console.log('\n' + R.join('\n'));
console.log(jsErr.length ? `\n❌ erreurs JS : ${jsErr.join(' | ')}` : '\naucune erreur JS');
await nav.close();
const echecs = R.filter((r) => r.startsWith('❌')).length + jsErr.length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Inscription : confirmée par le code comme par le lien');
process.exit(echecs ? 1 : 0);
