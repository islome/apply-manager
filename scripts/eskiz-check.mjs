// Checks the Eskiz SMS setup without sending anything: login, account status and balance,
// and whether ESKIZ_SMS_TEXT matches an approved template.
//
//   npm run eskiz:check        (same as: node --env-file=.env.local scripts/eskiz-check.mjs)
//
// Reads ESKIZ_EMAIL, ESKIZ_PASSWORD (the secret key from the cabinet), ESKIZ_SMS_TEXT and ESKIZ_FROM.
// Never prints the password or the token.

const API = 'https://notify.eskiz.uz/api';
const DEFAULT_SMS_TEXT = 'Apply Manager: kirish kodi {code}. Kodni hech kimga bermang.'; // keep in sync with lib/otp-delivery.ts

const STATUS = {
  moderation: 'under review',
  inproccess: 'in progress',
  service: 'approved (service)',
  reklama: 'approved (advertising)',
  rejected: 'rejected',
};

const ok = (s) => console.log(`  ✓ ${s}`);
const bad = (s) => console.log(`  ✗ ${s}`);
const info = (s) => console.log(`    ${s}`);

async function call(path, { method = 'GET', token, form } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
    signal: AbortSignal.timeout(10_000),
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

const email = process.env.ESKIZ_EMAIL;
const password = process.env.ESKIZ_PASSWORD;
const text = process.env.ESKIZ_SMS_TEXT || DEFAULT_SMS_TEXT;
const from = process.env.ESKIZ_FROM || '4546';

console.log('\n1. Settings');
if (!email || !password) {
  bad('ESKIZ_EMAIL and ESKIZ_PASSWORD must both be set (run with --env-file=.env.local).');
  process.exit(1);
}
ok('ESKIZ_EMAIL and ESKIZ_PASSWORD are set');
if (!text.includes('{code}')) bad(`ESKIZ_SMS_TEXT has no {code}, so the code would never reach the HR: "${text}"`);
else ok(`SMS text${process.env.ESKIZ_SMS_TEXT ? '' : ' (default)'}: "${text}"`);
ok(`Sender: ${from}${process.env.ESKIZ_FROM ? '' : ' (default)'}`);

console.log('\n2. Login');
const form = new FormData();
form.set('email', email);
form.set('password', password);
const login = await call('/auth/login', { method: 'POST', form });
const token = login.json?.data?.token;
if (!login.res.ok || !token) {
  bad(`Eskiz refused the login (HTTP ${login.res.status}): ${JSON.stringify(login.json?.message ?? login.json)}`);
  info('ESKIZ_PASSWORD must be the secret key from the Eskiz cabinet, not your cabinet password.');
  process.exit(1);
}
ok('Logged in');

console.log('\n3. Account');
const user = await call('/auth/user', { token });
const u = user.json?.data;
if (!user.res.ok || !u) {
  bad(`Could not read the account (HTTP ${user.res.status})`);
} else {
  (u.status === 'active' ? ok : bad)(`Status: ${u.status}`);
  (Number(u.balance) > 0 ? ok : bad)(`Balance: ${u.balance} so'm`);
  if (!(Number(u.balance) > 0)) info('Top up the balance in the cabinet, or real SMS will not go out.');
}

console.log('\n4. Templates');
const tpl = await call('/user/templates', { token });
const list = Array.isArray(tpl.json?.result) ? tpl.json.result : null;
if (!tpl.res.ok || !list) {
  bad(`Could not read templates (HTTP ${tpl.res.status})`);
} else if (list.length === 0) {
  bad('No templates yet. Submit one in the cabinet under SMS → My texts, e.g.:');
  info(`"${text.replaceAll('{code}', '123456')}"`);
} else {
  // the app's text with {code} as "any digits" (Eskiz shows templates with a sample code or a placeholder)
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${text.split('{code}').map(esc).join('\\S+')}$`);
  const norm = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');
  let match = null;
  for (const t of list) {
    const shown = norm(t.original_text || t.template);
    const same = pattern.test(shown) || pattern.test(norm(t.template));
    if (same) match = t;
    info(`${same ? '→' : ' '} #${t.id} ${STATUS[t.status] ?? t.status}: "${shown}"`);
  }
  if (!match) {
    bad('None of these matches ESKIZ_SMS_TEXT. Set ESKIZ_SMS_TEXT to the approved wording, with {code} in place of the number.');
  } else if (match.status === 'service' || match.status === 'reklama') {
    ok(`ESKIZ_SMS_TEXT matches approved template #${match.id}`);
  } else {
    bad(`ESKIZ_SMS_TEXT matches template #${match.id}, but it is ${STATUS[match.status] ?? match.status}`);
  }
}

console.log('\nNo SMS was sent.\n');
