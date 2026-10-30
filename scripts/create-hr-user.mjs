// Creates an HR login, or resets the password if the username already exists.
//
//   node --env-file=.env.local scripts/create-hr-user.mjs <username> <password>
//
// Needs SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.local.
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const [usernameArg, password] = process.argv.slice(2);
const username = (usernameArg || '').trim().toLowerCase();

if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
  console.error('Username: 3-32 chars, lowercase letters, digits, dot, dash or underscore.');
  process.exit(1);
}
if (!password || password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local).');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const password_hash = await bcrypt.hash(password, 12);

const { error } = await sb
  .from('hr_users')
  .upsert({ username, password_hash, is_active: true }, { onConflict: 'username' });

if (error) {
  console.error('Failed:', error.message);
  process.exit(1);
}
console.log(`HR user "${username}" is ready.`);
